import type { AgentStatus, EngineInterface, Register } from 'claude-code'
import { atom, read, update } from 'claude-code'

import type { AgentRun, Build, Job, Ledger, LogEntry, RunStatus, Ticket, TrackLine, Tracks } from '../types'
import { AgentRow } from './components/AgentRow'
import { AgentGroup, AgentsHeader } from './components/AgentsHeader'
import { BuildView } from './components/BuildView'
import { LogView } from './components/LogView'
import { TracksView } from './components/TracksView'
import { TranscriptView } from './components/TranscriptView'
import type { Draw } from './components/ui'
import { changesOf, nameOf } from './events'
import type { Change } from './events'
import { NO_TOKENS, addUsage, describe, pathArgs, tokens, total, usageTotal } from './format'
import {
  STAGES,
  awaitingOf,
  field,
  findRef,
  findingsOf,
  heading,
  isUnlanded,
  jobOf,
  keyOf,
  lastNote,
  listField,
  repoField,
  repoOf,
  shortSha,
  stageOf,
  trackStateOf,
  waitsOnUser,
} from './sdd'
import { STATUS_LINE_GLYPH, roleOf } from './theme'

const PANE = 'build-watch'
const TITLE = 'Build watch'
const AGENT_PANE = 'build-watch-agent'
const KEEP = 50
const LOG_KEEP = 30
// The key of `expanded` that lengthens the Recent log.
const LONG_LOG = '#log'
// Change a tag when that value's fields change: it declines what an earlier
// version stored, which outlives a reload.
const runs = atom({ plugin: 'alper-brain', key: 'runs' } as const, [], { shape: 'runs-2' })
const now = atom({ plugin: 'alper-brain', key: 'now' } as const, 0)
const builds = atom({ plugin: 'alper-brain', key: 'builds' } as const, [], { shape: 'builds-2' })
const ledgers = atom({ plugin: 'alper-brain', key: 'ledgers' } as const, {}, { shape: 'ledgers-1' })
const tracks = atom({ plugin: 'alper-brain', key: 'tracks' } as const, null, { shape: 'tracks-1' })
const log = atom({ plugin: 'alper-brain', key: 'log' } as const, [], { shape: 'log-1' })
const main = atom({ plugin: 'alper-brain', key: 'main' } as const, { activity: '', at: 0 })
const expanded = atom({ plugin: 'alper-brain', key: 'expanded' } as const, [])
const paused = atom({ plugin: 'alper-brain', key: 'paused' } as const, 0)
// The id of the agent whose transcript the second pane shows.
const viewed = atom({ plugin: 'alper-brain', key: 'viewed' } as const, '')

const ENDED: Partial<Record<AgentStatus, RunStatus>> = {
  completed: 'done',
  failed: 'failed',
  killed: 'stopped',
}

// The milestone the main session last touched: its own requests count toward it.
let focus: string | undefined

// The milestone a run without a path of its own works for: the only one open,
// else the one the main session last touched.
const fallback = (list: Build[]) => {
  const open = list.filter(b => b.squash === null)

  return open.length === 1 ? open[0] : open.find(b => b.key === focus)
}

// When each message of an agent's transcript was first seen, the Nth from the Nth message. The engine
// stamps none: a message the pane sees as it comes is stamped true to the second, one already there
// when the agent is first opened is spread over the run's span.
const seen = new Map<string, number[]>()

let cwd = ''
let shownStatus: string | undefined
let ticks = 0
// The spec whose Recent log `log` holds, `<root>/<spec>`; its entries are saved under `log:<it>`.
let logSpec = ''

const specKey = (b: { root: string; spec: string }) => `${b.root}/${b.spec}`

// Reads one milestone as its files stand; null when its folder is gone.
const loadBuild = async (
  $: EngineInterface,
  ref: { root: string; spec: string; track?: string; milestone: string },
): Promise<Build | null> => {
  const dir = keyOf(ref)
  const entries = await $.fs.list(dir).catch(() => undefined)
  if (entries === undefined) return null

  const milestoneMd = await $.fs.read(`${dir}/milestone.md`).catch(() => '')
  const specMd = await $.fs.read(`${ref.root}/${ref.spec}/spec.md`).catch(() => '')
  const reviewMd = await $.fs.read(`${dir}/review.md`).catch(() => '')
  const tickets: Ticket[] = []
  for (const entry of entries) {
    const num = /^(\d{3})-.*\.md$/.exec(entry.name)?.[1]
    if (entry.kind !== 'file' || num === undefined) continue

    const md = await $.fs.read(`${dir}/${entry.name}`).catch(() => '')
    tickets.push({
      num,
      title: heading(md).replace(/^Ticket\s+\d+:\s*/i, '') || entry.name,
      status: field(md, 'Status').toLowerCase() || 'todo',
      commit: shortSha(field(md, 'Commit')),
      dependsOn: listField(md, 'Depends on'),
      note: lastNote(md),
    })
  }
  tickets.sort((a, b) => a.num.localeCompare(b.num))
  const squash = shortSha(field(milestoneMd, 'Squash'))

  return {
    key: dir,
    root: ref.root,
    spec: ref.spec,
    specTitle: heading(specMd).replace(/^Spec:\s*/i, '') || ref.spec,
    track: ref.track,
    milestone: ref.milestone,
    milestoneTitle: heading(milestoneMd).replace(/^Milestone\s+\d+:\s*/i, '') || ref.milestone,
    repo: ref.track ?? repoField(milestoneMd),
    phase: field(milestoneMd, 'Phase').toLowerCase() || 'none',
    squash,
    // A milestone written before the Landed line ends at its squash.
    landed: /^\*\*Landed:\*\*/m.test(milestoneMd) ? shortSha(field(milestoneMd, 'Landed')) : squash,
    landsAfter: listField(milestoneMd, 'Lands after'),
    findings: findingsOf(reviewMd),
    awaiting: awaitingOf(reviewMd),
    tickets,
  }
}

// Adds lines to the spec's Recent log, saves it for later sessions, and
// raises a toast for each that the user must act on.
const record = async ($: EngineInterface, changes: Change[]) => {
  if (changes.length === 0 || logSpec === '') return

  const at = await $.clock.now()
  const all = await update($, log, entries => [...entries, ...changes.map(c => ({ ...c, at }))].slice(-LOG_KEEP))
  await $.store.set(`log:${logSpec}`, all)
  for (const change of changes) {
    if (change.tone !== 'blocked' && change.tone !== 'failed') continue
    try {
      $.ui.toast(change.text, { timeoutMs: 8000 })
    } catch {
      // A surface without toasts still has the log.
    }
  }
}

// Adds the milestone `ref` points into to those the pane follows, or reads it
// again when it already is, logging what changed; a new one brings its saved
// spending along. A milestone of another spec starts the list afresh, so the
// tracks building side by side show together, ordered by track, then by number.
const follow = async (
  $: EngineInterface,
  ref: { root: string; spec: string; track?: string; milestone: string },
  focused = true,
) => {
  const loaded = await loadBuild($, ref)
  if (loaded === null) return
  if (focused) focus = loaded.key

  if (logSpec !== specKey(loaded)) {
    logSpec = specKey(loaded)
    const saved = (await $.store.get(`log:${logSpec}`)) as LogEntry[] | undefined
    await update($, log, () => saved ?? [])
  }

  let before: Build | undefined
  let isNew = false
  const list = await update($, builds, all => {
    before = all.find(b => b.key === loaded.key)
    isNew = before === undefined
    const kept = all.filter(b => b.key !== loaded.key && b.root === loaded.root && b.spec === loaded.spec)

    return [...kept, loaded].sort((a, b) => a.key.localeCompare(b.key))
  })
  await record($, changesOf(before, loaded))
  if (!isNew) return

  const saved = (await $.store.get(`ledger:${loaded.key}`)) as Ledger | undefined
  const fresh: Ledger = { key: loaded.key, agentTokens: 0, mainTokens: 0, agents: 0, byTicket: {} }
  await update($, ledgers, all => {
    const kept = Object.fromEntries(Object.entries(all).filter(([key]) => list.some(b => b.key === key)))

    return { ...kept, [loaded.key]: saved ?? fresh }
  })
  void $.ui.open({ id: PANE, title: TITLE })
}

// Each track's milestones in number order, by its slug: the tracks layout's
// folders, or in the flat layout the milestones grouped by their Repo line.
const trackFolders = async ($: EngineInterface, root: string, spec: string) => {
  const base = `${root}/${spec}/milestones`
  const entries = await $.fs.list(base).catch(() => [])
  const dirs = entries.filter(entry => entry.kind === 'dir').map(entry => entry.name).sort()
  const byTrack = new Map<string, { root: string; spec: string; track?: string; milestone: string }[]>()
  for (const dir of dirs) {
    if (/^\d{3}/.test(dir)) {
      const repo = repoField(await $.fs.read(`${base}/${dir}/milestone.md`).catch(() => '')) ?? '—'
      byTrack.set(repo, [...(byTrack.get(repo) ?? []), { root, spec, milestone: dir }])
      continue
    }
    const inner = await $.fs.list(`${base}/${dir}`).catch(() => [])
    const milestones = inner
      .filter(entry => entry.kind === 'dir' && /^\d{3}/.test(entry.name))
      .map(entry => entry.name)
      .sort()
    byTrack.set(dir, milestones.map(milestone => ({ root, spec, track: dir, milestone })))
  }

  return byTrack
}

// Reads where every track of the followed spec stands, by its next open
// milestone, else its first unlanded one, and follows each one at work, so
// a track the main session picks up shows without being touched first.
const refreshTracks = async ($: EngineInterface) => {
  const followed = await read($, builds)
  const first = followed[0]
  if (first === undefined) return

  const all = await read($, runs)
  const byTrack = await trackFolders($, first.root, first.spec)
  const current: { repo: string; build: Build | null; last: string }[] = []
  for (const [repo, refs] of byTrack) {
    let pick: Build | null = null
    let unlanded: Build | null = null
    let last = ''
    for (const ref of refs) {
      const b = await loadBuild($, ref)
      if (b === null) continue
      last = b.landed ?? last
      if (b.squash === null) {
        pick = b
        break
      }
      if (b.landed === null && unlanded === null) unlanded = b
    }
    current.push({ repo, build: pick ?? unlanded, last })
  }

  // Each open track's lowest ticket number: a ticket of its track below that is squashed.
  const openFrom = Object.fromEntries(
    current.flatMap(({ repo, build }) =>
      build !== null && build.squash === null && build.tickets[0] !== undefined ? [[repo, build.tickets[0].num]] : [],
    ),
  )
  const lines: TrackLine[] = current.map(({ repo, build, last }) => {
    if (build === null) {
      return { repo, key: '', milestone: '', title: '', state: 'landed', detail: last === '' ? 'nothing to build' : `landed ${last}`, done: 0, total: 0 }
    }
    const working = all.filter(run => run.status === 'running' && run.milestone === build.key)
    const run = working.find(one => one.ticket !== undefined) ?? working[0]
    const { state, detail } = trackStateOf(
      build,
      run === undefined ? undefined : { role: roleOf(run.type), ticket: run.ticket, activity: run.activity },
      openFrom,
    )

    return {
      repo,
      key: build.key,
      milestone: build.milestone,
      title: build.milestoneTitle,
      state,
      detail,
      done: build.tickets.filter(t => t.status === 'done').length,
      total: build.tickets.length,
    }
  })

  const next: Tracks = { spec: first.spec, specTitle: first.specTitle, lines }
  await update($, tracks, () => next)
  for (const { build } of current) {
    const line = lines.find(one => one.key === build?.key)
    if (build === null || line === undefined || followed.some(b => b.key === build.key)) continue
    if (line.state === 'ready' || line.state === 'after') continue
    await follow($, build, false)
  }
}

const refreshBuilds = async ($: EngineInterface) => {
  for (const b of await read($, builds)) await follow($, b, false)
  await refreshTracks($)
}

// Adds to a followed milestone's spending, and saves it for later sessions.
const charge = async ($: EngineInterface, key: string | undefined, fn: (l: Ledger) => Ledger) => {
  if (key === undefined) return

  const all = await update($, ledgers, l => {
    const one = l[key]
    return one === undefined ? l : { ...l, [key]: fn(one) }
  })
  const saved = all[key]
  if (saved !== undefined) await $.store.set(`ledger:${key}`, saved)
}

const chargeTicket = (l: Ledger, ticket: string | undefined, add: { tokens?: number; ms?: number }) => {
  if (ticket === undefined) return l

  const spent = l.byTicket[ticket] ?? { tokens: 0, ms: 0 }

  return {
    ...l,
    byTicket: {
      ...l.byTicket,
      [ticket]: { tokens: spent.tokens + (add.tokens ?? 0), ms: spent.ms + (add.ms ?? 0) },
    },
  }
}

const patch = ($: EngineInterface, id: string, fn: (run: AgentRun) => AgentRun) =>
  update($, runs, list => list.map(run => (run.id === id ? fn(run) : run)))

const findRun = async ($: EngineInterface, id: string) =>
  (await read($, runs)).find(run => run.id === id)

// Adds a run for an agent not seen yet, from what the engine lists of it, and
// files it under the milestone its brief names, else the one being built.
const ensure = async ($: EngineInterface, id: string, brief = '') => {
  if ((await findRun($, id)) !== undefined) return

  const info = (await $.agent.list()).find(agent => agent.id === id)
  const ref = findRef(brief, cwd)
  if (ref !== undefined) await follow($, ref)

  const list = await read($, builds)
  const active = ref !== undefined ? list.find(b => b.key === keyOf(ref)) : fallback(list)
  const milestone = ref !== undefined ? keyOf(ref) : active?.key
  // The arbiter and the review's fixer are both handed review.md: the phase tells them apart.
  const job: Job =
    ref?.ticket !== undefined
      ? 'ticket'
      : ref?.isReview
        ? jobOf(active?.phase ?? '') === 'decide'
          ? 'decide'
          : 'fix'
        : milestone !== undefined && active !== undefined
          ? jobOf(active.phase)
          : 'other'
  const run: AgentRun = {
    id,
    type: info?.type ?? 'agent',
    description: info?.description ?? info?.name ?? id,
    model: '',
    parentId: info?.parentId,
    status: 'running',
    startedAt: await $.clock.now(),
    steps: 0,
    tools: 0,
    tokens: NO_TOKENS,
    activity: 'starting',
    lastText: '',
    milestone,
    ticket: ref?.ticket,
    repo: repoOf(brief),
    job,
  }
  let isNew = false
  await update($, runs, all => {
    isNew = !all.some(one => one.id === id)
    return isNew ? [...all, run].slice(-KEEP) : all
  })
  if (isNew) await charge($, milestone, l => ({ ...l, agents: l.agents + 1 }))
}

// A milestone's stage in a word or two, for the status line.
const stageWord = (b: Build) =>
  waitsOnUser(b)
    ? '⚠ waits on you'
    : b.phase === 'failed'
      ? `⚠ ${b.squash === null ? 'check' : 'land'} failed`
      : b.phase === 'waits'
        ? 'check waits'
        : (STAGES[stageOf(b.phase, b.squash, b.landed)] ?? 'landed')

const refreshStatus = async ($: EngineInterface) => {
  const list = await read($, runs)
  const building = (await read($, builds)).filter(isUnlanded)
  const spent = await read($, ledgers)
  const running = list.filter(run => run.status === 'running').length
  const agents = `${running} agent${running === 1 ? '' : 's'} running`
  const cost = building.reduce((sum, b) => sum + (spent[b.key]?.agentTokens ?? 0) + (spent[b.key]?.mainTokens ?? 0), 0)
  const label = (b: Build) => {
    const done = b.tickets.filter(t => t.status === 'done').length
    return `M${b.milestone.slice(0, 3)}${b.repo === null ? '' : ` ${b.repo}`} ${done}/${b.tickets.length}`
  }
  let text: string | undefined
  if (building.length === 1 && building[0] !== undefined) {
    const current = building[0]
    const stage = waitsOnUser(current) ? 'decide waits on you' : stageWord(current)
    text = `${STATUS_LINE_GLYPH} ${label(current)} tickets · ${stage} · ${agents} · ${tokens(cost)} tok`
  } else if (building.length > 1) {
    text = `${STATUS_LINE_GLYPH} ${building.map(b => `${label(b)} ${stageWord(b)}`).join(' · ')} · ${agents} · ${tokens(cost)} tok`
  } else if (list.length > 0) {
    const cost = list.reduce((sum, run) => sum + total(run.tokens), 0)
    text = `${STATUS_LINE_GLYPH} ${agents} · ${list.length - running} done · ${tokens(cost)} tok`
  }
  if (text !== shownStatus) {
    shownStatus = text
    $.ui.status(text)
  }
}

// Once a second: moves the clock the pane's times read and settles runs the
// engine ended without a turn.complete heard here (a killed background
// agent); every third second while the spec is in flight, reads its files again.
const tick = async ($: EngineInterface) => {
  ticks += 1
  const followed = await read($, builds)
  const lines = (await read($, tracks))?.lines ?? []
  const inFlight = followed.some(isUnlanded) || lines.some(line => line.state !== 'landed')
  if (inFlight && ticks % 3 === 0) await refreshBuilds($)

  const list = await read($, runs)
  const at = await $.clock.now()
  if (!list.some(run => run.status === 'running')) {
    // The main session's line counts up while a spec is in flight.
    if (inFlight) {
      await update($, now, () => at)
      await refreshStatus($)
    }
    return
  }

  const agents = await $.agent.list()
  await update($, runs, all =>
    all.map(run => {
      const ended = ENDED[agents.find(agent => agent.id === run.id)?.status ?? 'running']
      return run.status === 'running' && ended !== undefined
        ? { ...run, status: ended, endedAt: at, activity: '' }
        : run
    }),
  )
  await update($, now, () => at)
  await refreshStatus($)
}

// The heading of a group of agents: the milestone they work for, as the pane names it.
const groupLabel = (followed: Build[], key: string) => {
  const b = followed.find(one => one.key === key)

  return b === undefined ? (key === '' ? '' : key.split('/').at(-1) ?? key) : `${nameOf(b)} ${b.milestoneTitle}`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    cwd = e.cwd.replace(/\\/g, '/')
    await $.command.register({
      name: 'build-watch',
      description: "Show the /build milestone and its subagents' work, tokens and progress",
    })
    $.clock.every(1000, () => void tick($))
    await refreshStatus($)

    return next(e)
  })

  on('command.run', { command: 'build-watch' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: 'Build watch opened.' }
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) return next(e)

    const id = e.agentId
    await ensure($, id, e.text)
    await patch($, id, run =>
      run.status === 'running' ? run : { ...run, status: 'running', endedAt: undefined },
    )
    const at = await $.clock.now()
    await update($, now, () => at)
    void $.ui.open({ id: PANE, title: TITLE })
    await refreshStatus($)

    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    const id = e.agentId
    if (id === undefined) {
      // The main session's own requests count toward the milestone it builds.
      const result = yield* next(e)
      const current = fallback(await read($, builds))
      if (result.usage !== null && current !== undefined) {
        const spent = usageTotal(result.usage)
        await charge($, current.key, l => ({ ...l, mainTokens: l.mainTokens + spent }))
      }

      return result
    }

    await ensure($, id)
    await patch($, id, run => ({ ...run, model: e.model, steps: run.steps + 1, activity: 'thinking' }))
    const result = yield* next(e)
    await patch($, id, run => ({
      ...run,
      tokens: result.usage === null ? run.tokens : addUsage(run.tokens, result.usage),
      lastText: result.answer === '' ? run.lastText : result.answer,
      activity: result.toolUses.length > 0 ? run.activity : 'writing',
    }))
    const run = await findRun($, id)
    if (result.usage !== null && run !== undefined) {
      const spent = usageTotal(result.usage)
      await charge($, run.milestone, l =>
        chargeTicket({ ...l, agentTokens: l.agentTokens + spent }, run.ticket, { tokens: spent }),
      )
    }
    await refreshStatus($)

    return result
  })

  // Not on Agent: a subagent's own events skip every hook its spawn ran
  // beneath, so a hook there would hide the very agents this pane shows.
  on('tool.call', { tool: /^(?!(Agent|Task)$)/ }, async ($, e, next) => {
    const args = e as unknown as Record<string, unknown>
    const ref = findRef(pathArgs(args), cwd)
    if (e.agentId !== undefined) {
      const id = e.agentId
      await ensure($, id)
      await patch($, id, run => ({
        ...run,
        tools: run.tools + 1,
        activity: describe(e.tool, args),
      }))
    } else {
      // The main session closes and lands milestones itself: its suite, squash and rebase show here.
      const at = await $.clock.now()
      await update($, main, () => ({ activity: describe(e.tool, args), at }))
    }

    const ran = await next(e)
    // /build moves a ticket's Status and the milestone's Phase by editing
    // them; a read of the milestone is how a build starts or resumes.
    if (ref !== undefined && (e.agentId === undefined || /^(Edit|Write|MultiEdit)$/.test(e.tool))) {
      await follow($, ref)
      await refreshTracks($)
      await refreshStatus($)
    }

    return ran
  })

  on('turn.complete', async ($, e, next) => {
    const at = await $.clock.now()
    if (e.agentId === undefined) {
      await update($, main, () => ({ activity: '', at }))
      return next(e)
    }

    const status: RunStatus =
      e.reason === 'answer' ? 'done' : e.reason === 'aborted' ? 'stopped' : 'failed'
    await patch($, e.agentId, run => ({
      ...run,
      status,
      endedAt: at,
      activity: '',
      lastText: e.answer === '' ? run.lastText : e.answer,
    }))
    const run = await findRun($, e.agentId)
    if (run !== undefined) {
      await charge($, run.milestone, l => chargeTicket(l, run.ticket, { ms: at - run.startedAt }))
      // A ticket's end shows as its Status; the closing steps' agents and every failure log here.
      const b = (await read($, builds)).find(one => one.key === run.milestone)
      if (b !== undefined && (status !== 'done' || run.ticket === undefined)) {
        const who = `${nameOf(b)} ${roleOf(run.type)}${run.ticket === undefined ? '' : ` T${run.ticket}`}`
        await record($, [{ text: `${who} ${status}`, tone: status === 'done' ? 'idle' : 'failed' }])
      }
    }
    await refreshBuilds($)
    await refreshStatus($)

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: AGENT_PANE }, async ($, e) => {
    const ui = $.ui.resolve(e)
    // The clock redraws it every second, so a running agent's messages keep coming.
    await read($, now)
    const id = await read($, viewed)
    const run = (await read($, runs)).find(one => one.id === id)
    const messages = await $.session.messages({ agentId: id })
    const stamps = seen.get(id) ?? []
    if (Array.isArray(messages) && stamps.length < messages.length) {
      const at = await $.clock.now()
      const first = stamps.length === 0
      const from = run?.startedAt ?? at
      const span = (run?.endedAt ?? at) - from
      for (let i = stamps.length; i < messages.length; i++) {
        stamps.push(first ? Math.round(from + (span * i) / Math.max(1, messages.length - 1)) : at)
      }
      seen.set(id, stamps)
    }

    return TranscriptView(
      { ui, Svg: undefined, at: 0 },
      {
        run,
        messages,
        stamps,
        paused: await read($, paused),
        onPause: count => void update($, paused, () => count),
        onBack: () => void $.ui.close({ id: AGENT_PANE }),
      },
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e)
    const { Box, Text } = ui
    // The persona and the token meter draw where a surface has Svg: not the
    // terminal, which keeps the text bar. Every table carries an Svg, a
    // fragment where the surface has none, so ask the surface.
    const Svg = e.surface === 'terminal' ? undefined : ui.Svg
    const list = await read($, runs)
    const followed = await read($, builds)
    const spent = await read($, ledgers)
    const spec = await read($, tracks)
    const recent = await read($, log)
    const opened = await read($, expanded)
    // The milestones being built or landed, one per track, side by side; once
    // all have landed, the last one stays up to show it.
    const building = followed.filter(isUnlanded)
    const shown = building.length > 0 ? building : followed.slice(-1)
    const draw: Draw = {
      ui,
      Svg,
      at: Math.max(await read($, now), ...list.map(run => run.endedAt ?? 0)),
    }
    const running = list.filter(run => run.status === 'running')
    const finished = list.length - running.length
    const largest = Math.max(1, ...list.map(run => total(run.tokens)))
    const toggle = (key: string) =>
      void update($, expanded, all => (all.includes(key) ? all.filter(one => one !== key) : [...all, key]))

    if (shown.length === 0 && list.length === 0) {
      return (
        <Text dimColor>
          Nothing yet. A /build milestone and its subagents show here as they start.
        </Text>
      )
    }

    // Where the host has no main view to switch (the editor's), the agent's transcript opens in a pane of its own.
    const openRun = async (run: AgentRun) => {
      const { deny } = await $.ui.view({ agentId: run.id })
      if (deny === undefined) return

      await update($, viewed, () => run.id)
      await update($, paused, () => 0)
      await $.ui.open({ id: AGENT_PANE, title: roleOf(run.type) })
    }
    // A running run a milestone above shows, under its ticket or as a closing step's agent.
    const isShownAbove = (run: AgentRun) =>
      run.status === 'running' && shown.some(b => b.key === run.milestone)

    // The groups, those with a running agent first, then the latest start.
    const keys = [...new Set(list.map(run => run.milestone ?? ''))]
    const latest = (key: string) => Math.max(...list.filter(run => (run.milestone ?? '') === key).map(run => run.startedAt))
    const isBusy = (key: string) => running.some(run => (run.milestone ?? '') === key)
    keys.sort((a, b) => Number(isBusy(b)) - Number(isBusy(a)) || latest(b) - latest(a))

    return (
      <Box flexDirection="column">
        {spec !== null && spec.lines.length > 0 &&
          TracksView(draw, { tracks: spec, main: await read($, main), anyRunning: running.length > 0 })}
        {shown.map(b => BuildView(draw, { build: b, spent: spent[b.key] ?? null, runs: list, onOpen: run => void openRun(run) }))}
        {recent.length > 0 &&
          LogView(draw, { log: recent, isLong: opened.includes(LONG_LOG), onToggle: () => toggle(LONG_LOG) })}
        {list.length > 0 &&
          AgentsHeader(draw, {
            finished,
            spent: list.reduce((sum, run) => sum + total(run.tokens), 0),
            onClear: () => update($, runs, all => all.filter(run => run.status === 'running')),
          })}
        {keys.map(key => {
          const group = list.filter(run => (run.milestone ?? '') === key)
          const ended = group.filter(run => run.status !== 'running')
          // A milestone's ended runs fold into its heading; the rest always show.
          const isExpanded = key === '' || opened.includes(key)
          const rows = group
            .filter(run => run.status === 'running' || isExpanded)
            .sort((a, b) => b.startedAt - a.startedAt)

          return (
            <Box key={`group-${key}`} flexDirection="column">
              {AgentGroup(draw, {
                label: groupLabel(followed, key),
                finished: ended.length,
                spent: ended.reduce((sum, run) => sum + total(run.tokens), 0),
                isExpanded,
                onToggle: () => toggle(key),
              })}
              {rows.map(run =>
                AgentRow(draw, {
                  run,
                  ticketTitle: followed.find(b => b.key === run.milestone)?.tickets.find(t => t.num === run.ticket)?.title,
                  largest,
                  isShownAbove: isShownAbove(run),
                  onOpen: () => void openRun(run),
                }),
              )}
            </Box>
          )
        })}
      </Box>
    )
  })
}
