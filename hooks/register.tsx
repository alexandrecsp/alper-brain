import type { AgentStatus, EngineInterface, Register } from 'claude-code'
import { atom, read, update } from 'claude-code'

import type { AgentRun, Build, Job, Ledger, RunStatus, Ticket } from '../types'
import { AgentRow } from './components/AgentRow'
import { AgentsHeader } from './components/AgentsHeader'
import { BuildView } from './components/BuildView'
import { TranscriptView } from './components/TranscriptView'
import type { Draw } from './components/ui'
import { NO_TOKENS, addUsage, describe, pathArgs, tokens, total, usageTotal } from './format'
import { STAGES, field, findRef, heading, jobOf, keyOf, shortSha, stageOf } from './sdd'
import { STATUS_LINE_GLYPH, roleOf } from './theme'

const PANE = 'build-watch'
const TITLE = 'Build watch'
const AGENT_PANE = 'build-watch-agent'
const KEEP = 50
// Change a tag when that value's fields change: it declines what an earlier
// version stored, which outlives a reload.
const runs = atom({ plugin: 'alper-brain', key: 'runs' } as const, [], { shape: 'runs-1' })
const now = atom({ plugin: 'alper-brain', key: 'now' } as const, 0)
const build = atom({ plugin: 'alper-brain', key: 'build' } as const, null, { shape: 'build-1' })
const ledger = atom({ plugin: 'alper-brain', key: 'ledger' } as const, null, { shape: 'ledger-1' })
// The id of the agent whose transcript the second pane shows.
const viewed = atom({ plugin: 'alper-brain', key: 'viewed' } as const, '')

const ENDED: Partial<Record<AgentStatus, RunStatus>> = {
  completed: 'done',
  failed: 'failed',
  killed: 'stopped',
}

const isBuilding = (b: Build | null): b is Build => b !== null && b.squash === null

// When each message of an agent's transcript was first seen, the Nth from the Nth message. The engine
// stamps none: a message the pane sees as it comes is stamped true to the second, one already there
// when the agent is first opened is spread over the run's span.
const seen = new Map<string, number[]>()

let cwd = ''
let shownStatus: string | undefined
let ticks = 0

// Reads one milestone as its files stand; null when its folder is gone.
const loadBuild = async (
  $: EngineInterface,
  ref: { root: string; spec: string; milestone: string },
): Promise<Build | null> => {
  const dir = keyOf(ref)
  const entries = await $.fs.list(dir).catch(() => undefined)
  if (entries === undefined) return null

  const milestoneMd = await $.fs.read(`${dir}/milestone.md`).catch(() => '')
  const specMd = await $.fs.read(`${ref.root}/${ref.spec}/spec.md`).catch(() => '')
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
    })
  }
  tickets.sort((a, b) => a.num.localeCompare(b.num))

  return {
    key: dir,
    root: ref.root,
    spec: ref.spec,
    specTitle: heading(specMd).replace(/^Spec:\s*/i, '') || ref.spec,
    milestone: ref.milestone,
    milestoneTitle: heading(milestoneMd).replace(/^Milestone\s+\d+:\s*/i, '') || ref.milestone,
    phase: field(milestoneMd, 'Phase').toLowerCase() || 'none',
    squash: shortSha(field(milestoneMd, 'Squash')),
    tickets,
  }
}

// Makes the milestone `ref` points into the one the pane follows, or reads
// it again when it already is; a new one brings its saved spending along.
const follow = async (
  $: EngineInterface,
  ref: { root: string; spec: string; milestone: string },
) => {
  const loaded = await loadBuild($, ref)
  if (loaded === null) return

  const before = await read($, build)
  await update($, build, () => loaded)
  if (before?.key === loaded.key) return

  const saved = (await $.store.get(`ledger:${loaded.key}`)) as Ledger | undefined
  const fresh: Ledger = { key: loaded.key, agentTokens: 0, mainTokens: 0, agents: 0, byTicket: {} }
  await update($, ledger, () => saved ?? fresh)
  void $.ui.open({ id: PANE, title: TITLE })
}

const refreshBuild = async ($: EngineInterface) => {
  const current = await read($, build)
  if (current !== null) await follow($, current)
}

// Adds to the followed milestone's spending, and saves it for later sessions.
const charge = async ($: EngineInterface, key: string | undefined, fn: (l: Ledger) => Ledger) => {
  if (key === undefined) return

  const saved = await update($, ledger, l => (l !== null && l.key === key ? fn(l) : l))
  if (saved !== null && saved.key === key) await $.store.set(`ledger:${key}`, saved)
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

  const active = await read($, build)
  const milestone = ref !== undefined ? keyOf(ref) : isBuilding(active) ? active.key : undefined
  // The arbiter and the fixer are both handed review.md: the phase tells them apart.
  const job: Job =
    ref?.ticket !== undefined
      ? 'ticket'
      : ref?.isReview
        ? jobOf(active?.phase ?? '') === 'decide'
          ? 'decide'
          : 'fix'
        : milestone !== undefined && active !== null
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
    job,
  }
  let isNew = false
  await update($, runs, all => {
    isNew = !all.some(one => one.id === id)
    return isNew ? [...all, run].slice(-KEEP) : all
  })
  if (isNew) await charge($, milestone, l => ({ ...l, agents: l.agents + 1 }))
}

const refreshStatus = async ($: EngineInterface) => {
  const list = await read($, runs)
  const current = await read($, build)
  const spent = await read($, ledger)
  const running = list.filter(run => run.status === 'running').length
  const agents = `${running} agent${running === 1 ? '' : 's'} running`
  let text: string | undefined
  if (isBuilding(current)) {
    const done = current.tickets.filter(t => t.status === 'done').length
    const stage = STAGES[stageOf(current.phase, current.squash)] ?? 'done'
    const cost = spent === null ? 0 : spent.agentTokens + spent.mainTokens
    text = `${STATUS_LINE_GLYPH} M${current.milestone.slice(0, 3)} ${done}/${current.tickets.length} tickets · ${stage} · ${agents} · ${tokens(cost)} tok`
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
// agent); every third second while a milestone is open, reads its files again.
const tick = async ($: EngineInterface) => {
  ticks += 1
  const current = await read($, build)
  if (isBuilding(current) && ticks % 3 === 0) await refreshBuild($)

  const list = await read($, runs)
  if (!list.some(run => run.status === 'running')) {
    if (isBuilding(current)) await refreshStatus($)
    return
  }

  const at = await $.clock.now()
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
      const current = await read($, build)
      if (result.usage !== null && isBuilding(current)) {
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
    }

    const ran = await next(e)
    // /build moves a ticket's Status and the milestone's Phase by editing
    // them; a read of the milestone is how a build starts or resumes.
    if (ref !== undefined && (e.agentId === undefined || /^(Edit|Write|MultiEdit)$/.test(e.tool))) {
      await follow($, ref)
      await refreshStatus($)
    }

    return ran
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) return next(e)

    const status: RunStatus =
      e.reason === 'answer' ? 'done' : e.reason === 'aborted' ? 'stopped' : 'failed'
    const at = await $.clock.now()
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
    }
    await refreshBuild($)
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
      { run, messages, stamps, onBack: () => void $.ui.close({ id: AGENT_PANE }) },
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
    const current = await read($, build)
    const spent = await read($, ledger)
    const draw: Draw = {
      ui,
      Svg,
      at: Math.max(await read($, now), ...list.map(run => run.endedAt ?? 0)),
    }
    const running = list.filter(run => run.status === 'running')
    const finished = list.length - running.length
    const largest = Math.max(1, ...list.map(run => total(run.tokens)))

    if (current === null && list.length === 0) {
      return (
        <Text dimColor>
          Nothing yet. A /build milestone and its subagents show here as they start.
        </Text>
      )
    }

    return (
      <Box flexDirection="column">
        {current !== null && BuildView(draw, { build: current, spent, running })}
        {list.length > 0 &&
          AgentsHeader(draw, {
            finished,
            spent: list.reduce((sum, run) => sum + total(run.tokens), 0),
            onClear: () => update($, runs, all => all.filter(run => run.status === 'running')),
          })}
        {/* The latest start on top. */}
        {[...list]
          .sort((a, b) => b.startedAt - a.startedAt)
          .map(run =>
            AgentRow(draw, {
              run,
              ticketTitle: current?.tickets.find(t => t.num === run.ticket)?.title,
              largest,
              // Where the host has no main view to switch (the editor's), the agent's transcript opens in a pane of its own.
              onOpen: async () => {
                const { deny } = await $.ui.view({ agentId: run.id })
                if (deny === undefined) return

                await update($, viewed, () => run.id)
                await $.ui.open({ id: AGENT_PANE, title: roleOf(run.type) })
              },
            }),
          )}
      </Box>
    )
  })
}
