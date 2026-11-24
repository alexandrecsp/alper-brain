import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, TurnUsage } from 'claude-code'

import type { Agent, AgentState, Area, BrainView, Ledger } from '../types'
import { brainOfPath, findBrain, readBrain } from './brain'
import type { Files } from './brain'
import { ROOMS, THEMES, drawWatcher, tokens, trackState } from './draw'
import type { View } from './draw'

const PANE = 'agent-watcher'
const TITLE = 'Agent Watcher'
const MAIN = 'main'
const MINUTE = 60_000
const KEEP_MINUTES = 240
const KEEP_DONE = 6
/** The editor draws the Svg as an image and reloads it on every new source: at most one new drawing this often. */
const REDRAW_MS = 2000

// Change a tag when its value's fields change: a reload then starts from empty.
const ledger = atom({ plugin: 'alper-brain', key: 'ledger' } as const, emptyLedger(0), { shape: 'ledger-1' })
const theme = atom({ plugin: 'alper-brain', key: 'theme' } as const, 'ember', { shape: 'theme-1' })
/** Bumped to draw again: when a held-back drawing is due, and each half minute for the clocks. */
const paint = atom({ plugin: 'alper-brain', key: 'paint' } as const, 0, { shape: 'paint-1' })
const brain = atom({ plugin: 'alper-brain', key: 'brain' } as const, null as BrainView | null, { shape: 'brain-1' })
/** How often the brain's files are read again, beside each turn's end. */
const BRAIN_MS = 30_000

function emptyLedger(now: number): Ledger {
  return {
    startedAt: now,
    mix: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    areas: {},
    buckets: [0],
    bucketAt: Math.floor(now / MINUTE) * MINUTE,
    agents: [],
  }
}

// ---------- areas ----------

const isBrain = (p: string) => /(^|[\\/])\.brain([\\/]|$)/.test(p)
const isDoc = (p: string) => /\.(md|mdx|txt|rst|adoc)$/i.test(p)
const GIT = /(^|[\s;&|(])(git|gh)\s|\bsdd(\.mjs)?\s+(squash|land)\b/
const SDD = /\bsdd(\.mjs)?\s+\w+/
const TESTS = /(^|[\s;&|(])(npm|pnpm|yarn|bun)\s+(run\s+)?test\b|\b(pytest|vitest|jest|mocha|go test|cargo test|dotnet test|plugin test)\b/
const REVIEWS = /(reviewer|arbiter)$/

/** The room a tool call works in; every call of a review's agent is in Review. */
export function areaOf(tool: string, args: Record<string, unknown>, kind = ''): Area {
  if (REVIEWS.test(kind)) return 'review'
  const path = String(args.file_path ?? args.notebook_path ?? args.path ?? args.pattern ?? '')
  const command = typeof args.command === 'string' ? args.command : ''
  switch (tool) {
    case 'Bash':
    case 'PowerShell':
      return GIT.test(command) ? 'git' : SDD.test(command) ? 'brain' : TESTS.test(command) ? 'tests' : 'shell'
    case 'Edit':
    case 'MultiEdit':
    case 'Write':
    case 'NotebookEdit':
      return isBrain(path) ? 'brain' : isDoc(path) ? 'docs' : 'code'
    case 'Read':
    case 'Grep':
    case 'Glob':
      return isBrain(path) ? 'brain' : isDoc(path) ? 'docs' : 'read'
    case 'WebSearch':
    case 'WebFetch':
      return 'web'
    default:
      return tool.startsWith('mcp__') ? 'web' : 'think'
  }
}

const one = (s: unknown) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '')
const base = (p: string) => p.split(/[\\/]/).pop() ?? p

/** What a tool call does, in a few words: `edit register.tsx`, `run npm test`. */
export function doingOf(tool: string, args: Record<string, unknown>): string {
  const path = one(args.file_path ?? args.notebook_path ?? args.path)
  switch (tool) {
    case 'Bash':
    case 'PowerShell':
      return `run ${one(args.command)}`
    case 'Edit':
    case 'MultiEdit':
    case 'Write':
    case 'NotebookEdit':
      return `edit ${base(path)}`
    case 'Read':
      return `read ${base(path)}`
    case 'Grep':
      return `search ${one(args.pattern)}`
    case 'Glob':
      return `list ${one(args.pattern)}`
    case 'WebSearch':
      return `search the web for ${one(args.query)}`
    case 'WebFetch':
      return `fetch ${one(args.url)}`
    case 'Skill':
      return `skill ${one(args.skill)}`
    default:
      return tool.startsWith('mcp__') ? `ask ${tool.split('__')[1] ?? tool}` : tool
  }
}

const kindOf = (type: string) => type.replace(/^[\w-]+:/, '')

// ---------- the ledger ----------

/** The minute buckets moved on to `now`, idle minutes as zeros. */
export function rolled(l: Ledger, now: number): Ledger {
  const steps = Math.floor((now - l.bucketAt) / MINUTE)
  if (steps <= 0) return l
  const zeros = Array.from({ length: Math.min(steps, KEEP_MINUTES) }, () => 0)
  return { ...l, buckets: [...l.buckets, ...zeros].slice(-KEEP_MINUTES), bucketAt: l.bucketAt + steps * MINUTE }
}

const sum = (u: TurnUsage) => u.input_tokens + u.output_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens

/** A request's tokens: on its agent, its minute, the mix, and shared evenly among the rooms of the calls it asks for. */
export function spend(l: Ledger, agentId: string, u: TurnUsage, calls: readonly { name: string; input: unknown }[], now: number): Ledger {
  const n = sum(u)
  if (n <= 0) return l
  const r = rolled(l, now)
  const kind = r.agents.find(a => a.id === agentId)?.kind ?? ''
  const args = (input: unknown) => (typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {})
  const where = calls.length === 0 ? [areaOf('', {}, kind)] : calls.map(c => areaOf(c.name, args(c.input), kind))
  const areas = { ...r.areas }
  for (const a of where) areas[a] = (areas[a] ?? 0) + n / where.length
  const buckets = [...r.buckets]
  buckets[buckets.length - 1] = (buckets[buckets.length - 1] ?? 0) + n
  return {
    ...r,
    areas,
    buckets,
    mix: {
      input: r.mix.input + u.input_tokens,
      output: r.mix.output + u.output_tokens,
      cacheRead: r.mix.cacheRead + u.cache_read_input_tokens,
      cacheWrite: r.mix.cacheWrite + u.cache_creation_input_tokens,
    },
    agents: r.agents.map(a => (a.id === agentId ? { ...a, tokens: a.tokens + n } : a)),
  }
}

function newAgent(id: string, now: number): Agent {
  const isMain = id === MAIN
  return {
    id,
    name: isMain ? 'Main' : 'agent',
    kind: isMain ? 'session' : 'agent',
    task: '',
    doing: isMain ? 'waiting' : 'starting',
    area: 'think',
    state: isMain ? 'idle' : 'running',
    startedAt: now,
    tokens: 0,
  }
}

// Finished subagents stay listed, the latest first; past KEEP_DONE the oldest leave.
function pruned(agents: Agent[]): Agent[] {
  const done = agents.filter(a => a.id !== MAIN && a.state !== 'running').sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))
  const gone = new Set(done.slice(KEEP_DONE).map(a => a.id))
  return gone.size === 0 ? agents : agents.filter(a => !gone.has(a.id))
}

async function change($: EngineInterface, fn: (l: Ledger, now: number) => Ledger): Promise<void> {
  const now = await $.clock.now()
  await update($, ledger, l => {
    const start = l === undefined || l.startedAt === 0 ? emptyLedger(now) : l
    const next = fn(start, now)
    return { ...next, agents: pruned(next.agents) }
  })
}

/** Changes one agent, meeting it first if the watcher has not. */
const patch = ($: EngineInterface, id: string, fn: (a: Agent, now: number) => Agent) =>
  change($, (l, now) => {
    const agents = l.agents.some(a => a.id === id) ? l.agents : [...l.agents, newAgent(id, now)]
    return { ...l, agents: agents.map(a => (a.id === id ? fn(a, now) : a)) }
  })

// The watcher's bookkeeping never holds up the session: a failed write is dropped.
const quiet = (p: Promise<unknown>): Promise<void> => p.then(() => undefined).catch(() => undefined)

// ---------- the view ----------

/** What the drawing shows, with every clock rounded to the minute so it changes only when something does. */
export function viewOf(l: Ledger, now: number): View {
  const r = rolled(l, now)
  const minute = (ms: number) => Math.floor(ms / MINUTE) * MINUTE
  const last5 = r.buckets.slice(-5)
  const minutes = Math.max(1, Math.min(last5.length, Math.ceil((now - r.startedAt) / MINUTE)))
  const { input, output, cacheRead, cacheWrite } = r.mix
  return {
    total: input + output + cacheRead + cacheWrite,
    rate: last5.reduce((s, n) => s + n, 0) / minutes,
    elapsedMs: minute(now - r.startedAt),
    mix: r.mix,
    areas: r.areas,
    series: r.buckets,
    agents: r.agents.map(a => ({
      id: a.id,
      name: a.name,
      kind: a.kind,
      area: a.area,
      state: a.state,
      doing: a.state === 'running' || a.id === MAIN ? a.doing : a.task || a.kind,
      tokens: a.tokens,
      ms: minute((a.endedAt ?? now) - a.startedAt),
      isMain: a.id === MAIN,
    })),
  }
}

// ---------- the brain ----------

// The active brain's folder, found from the session's folder or from a path a tool call names; one read at a time.
let brainRoot: string | undefined
let reading = false

/** The reader's view of the files: each call spelled at its site, as the engine wants. */
const filesOf = ($: EngineInterface): Files => ({
  list: path => $.fs.list(path),
  read: path => $.fs.read(path) as Promise<string>,
  exists: path => $.fs.exists(path),
})

/** Reads the active brain again and stores it when anything it shows changed. */
async function refreshBrain($: EngineInterface): Promise<void> {
  if (brainRoot === undefined || reading) return
  reading = true
  try {
    const next = await readBrain(filesOf($), brainRoot)
    const was = await read($, brain)
    if (JSON.stringify(next) !== JSON.stringify(was)) await update($, brain, () => next)
  } finally {
    reading = false
  }
}

// The last drawing sent, and when: a new one waits out REDRAW_MS.
let shown = { source: '', at: 0, height: 0 }
let repaintDue = false

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'watcher',
      description: 'Show the Agent Watcher pane; with a theme (ember, gold, tide, slate, dusk, mono), switch to it',
      argumentHint: '[ember|gold|tide|slate|dusk|mono]',
    })
    const saved = await $.store.get('theme').catch(() => undefined)
    if (typeof saved === 'string' && saved in THEMES) await update($, theme, () => saved)
    await quiet(patch($, MAIN, a => a))
    $.clock.every(30_000, () => void update($, paint, n => n + 1))
    brainRoot = (await findBrain(filesOf($), e.cwd).catch(() => undefined)) ?? (await read($, brain))?.root
    await quiet(refreshBrain($))
    $.clock.every(BRAIN_MS, () => void quiet(refreshBrain($)))
    void $.ui.open({ id: PANE, title: TITLE })

    return next(e)
  })

  on('command.run', { command: 'watcher' }, async ($, e) => {
    const want = e.args.trim().toLowerCase()
    const id = want === 'mono' ? 'terminal' : want
    if (want !== '' && !(id in THEMES)) return { text: `No theme "${want}". Themes: ember, gold, tide, slate, dusk, mono.` }
    if (id !== '') {
      await update($, theme, () => id)
      await $.store.set('theme', id).catch(() => undefined)
    }
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: id === '' ? 'Agent Watcher opened.' : `Agent Watcher: ${THEMES[id]?.name ?? id}.` }
  })

  on('turn.start', async ($, e, next) => {
    await quiet(patch($, e.agentId ?? MAIN, a => ({ ...a, state: 'running', endedAt: undefined, doing: 'thinking', area: areaOf('', {}, a.kind) })))

    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    const id = e.agentId ?? MAIN
    const result = yield* next(e)
    if (result.usage !== null) {
      const usage = result.usage
      await quiet(change($, (l, now) => spend(l, id, usage, result.toolUses, now)))
    }
    if (result.toolUses.length === 0) await quiet(patch($, id, a => ({ ...a, doing: 'writing' })))

    return result
  })

  // Not on Agent or Task: a subagent's own events skip every hook its spawn ran beneath.
  on('tool.call', { tool: /^(?!(Agent|Task)$)/ }, async ($, e, next) => {
    const args = e as unknown as Record<string, unknown>
    await quiet(patch($, e.agentId ?? MAIN, a => ({ ...a, doing: doingOf(e.tool, args), area: areaOf(e.tool, args, a.kind) })))
    if (brainRoot === undefined) {
      const path = String(args.file_path ?? args.path ?? args.notebook_path ?? '')
      brainRoot = brainOfPath(path)
      if (brainRoot !== undefined) void quiet(refreshBrain($))
    }

    return next(e)
  })

  on('agent.spawn', async ($, e, next) => {
    const r = await next(e)
    const id = 'agentId' in r ? r.agentId : undefined
    if (id !== undefined) {
      const kind = kindOf(e.subagentType)
      await quiet(
        patch($, id, a => ({ ...a, kind, name: one(e.name) || kind, task: one(e.description), area: areaOf('', {}, kind) })),
      )
    }

    return r
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      await quiet(patch($, MAIN, a => ({ ...a, state: 'idle', doing: 'waiting', area: 'think' })))
      await quiet(refreshBrain($))
    } else {
      const state: AgentState = e.reason === 'answer' ? 'done' : e.reason === 'aborted' ? 'stopped' : 'failed'
      await quiet(patch($, e.agentId, (a, now) => ({ ...a, state, endedAt: now })))
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    await read($, paint)
    const now = await $.clock.now()
    const l = (await read($, ledger)) ?? emptyLedger(now)
    const usage = await $.session.usage().catch(() => undefined)
    const context = usage === undefined ? undefined : { tokens: usage.context.tokens, window: usage.context.window }
    const view = { ...viewOf(l.startedAt === 0 ? emptyLedger(now) : l, now), context, brain: await read($, brain) }
    const tracks = (view.brain?.specs ?? []).flatMap(sp => sp.tracks.map(tr => ({ sp, tr, st: trackState(tr) })))
    const live = view.agents.filter(a => a.state === 'running' && !a.isMain)
    const ctxPct = context?.tokens === undefined || context.window <= 0 ? undefined : Math.round((context.tokens / context.window) * 100)
    const ctxLine = ctxPct === undefined ? '' : ` · context ${ctxPct}%`
    const alt = `${tokens(view.total)} tokens${ctxLine}. ${live.length} agents working: ${live.map(a => `${a.name} in ${a.area}, ${a.doing}`).join('; ') || 'none'}.${tracks.map(({ sp, tr, st }) => ` Spec ${sp.id} ${tr.slug}: ${st.word}.`).join('')}`

    // The terminal draws no Svg: there the watcher is a few lines.
    if (e.surface === 'terminal') {
      const rooms = ROOMS.map(r => ({ r, n: view.areas[r.area] ?? 0 })).filter(x => x.n > 0).sort((a, b) => b.n - a.n)
      return (
        <Box flexDirection="column">
          <Text bold>
            {tokens(view.total)} <Text dimColor>tokens · {tokens(view.rate)}/min{ctxLine}</Text>
          </Text>
          {rooms.map(({ r, n }) => (
            <Text>
              <Text color="claude">{r.label.padEnd(8)}</Text>
              <Text dimColor>{`${Math.round((n / Math.max(1, view.total)) * 100)}%`.padStart(5)} {tokens(n)}</Text>
            </Text>
          ))}
          {tracks.map(({ sp, tr, st }) => (
            <Text>
              <Text color={st.hot ? 'error' : 'claude'}>
                {sp.id} {tr.slug}
              </Text>
              <Text dimColor>
                {' '}
                · {st.at === undefined ? 'all landed' : `M${st.at.num} ${st.at.done}/${st.at.total}`} · {st.word}
              </Text>
            </Text>
          ))}
          {view.agents.map(a => (
            <Text dimColor={a.state !== 'running'}>
              {a.state === 'running' ? '●' : '○'} {a.name} <Text dimColor>· {a.area} · {a.doing}</Text>
            </Text>
          ))}
        </Box>
      )
    }

    const { Svg } = $.ui.resolve(e)
    const t = THEMES[(await read($, theme)) ?? 'ember'] ?? THEMES.ember!
    const width = Math.max(340, Math.round((e.props.bodyColumns ?? e.viewport?.columns ?? 70) * 8))
    const drawn = drawWatcher(view, width, t)
    if (drawn.source !== shown.source) {
      const wait = shown.at + REDRAW_MS - now
      if (wait <= 0 || shown.source === '') {
        shown = { source: drawn.source, at: now, height: drawn.height }
      } else if (!repaintDue) {
        repaintDue = true
        try {
          $.clock.after(wait + 20, () => {
            repaintDue = false
            void update($, paint, n => n + 1)
          })
        } catch {
          repaintDue = false
        }
      }
    }

    return <Svg source={shown.source} alt={alt} />
  })
}
