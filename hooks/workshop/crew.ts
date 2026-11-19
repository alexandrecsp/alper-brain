import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { Crew, CrewAgent, Job, Station } from '../../types'

// Who stands where on the workshop floor. register.tsx's hooks call this module:
// a plugin registers an event once without a matcher, and the build pane's hooks
// already hold every event the crew follows but agent.spawn.

export const MAIN = 'main'
/** How long a walk between stations takes, as the scene draws it. */
export const WALK_MS = 800
/** An agent stands at least this long at a station before the next call moves it on. */
export const STAY_MS = 1000
/** How long a finished subagent fades at the gate before it leaves the floor. */
export const FADE_MS = 4000

// Change the tag when Crew's fields change: a reload then starts from empty.
const crew = atom({ plugin: 'alper-brain', key: 'crew' } as const, emptyCrew(), { shape: 'crew-1' })

function emptyCrew(): Crew {
  return { agents: [], spawned: 0, edits: 0, commits: 0 }
}

/** Each station as the terminal's list names it. */
export const STATION_LABEL: Record<Station, string> = {
  gate: 'Gate', table: 'Meeting table', dock: 'Cargo dock', tests: 'Test bench', tools: 'Fabrication bench', bay: 'Mech bay',
  brain: 'Brain vault', shelves: 'Archive', computer: 'Computer', comms: 'Antenna', holo: 'Holo table', lounge: 'Lounge',
}

export async function readCrew($: EngineInterface): Promise<Crew> {
  return (await read($, crew)) ?? emptyCrew()
}

const NAMES = ['Vega', 'Orion', 'Lyra', 'Nova', 'Kepler', 'Rigel', 'Altair', 'Sirius', 'Cygnus', 'Deneb', 'Halley', 'Io']

// ---------- what an agent does → where it goes ----------

export type Route = { station: Station; task: string; isEdit: boolean; isCommit: boolean }

const base = (p: unknown) => (typeof p === 'string' ? (p.split(/[\\/]/).pop() ?? p) : '')
const short = (s: unknown, n = 34) => {
  if (typeof s !== 'string') return ''
  const one = s.replace(/\s+/g, ' ').trim()
  return one.length > n ? `${one.slice(0, n - 1)}…` : one
}
const isBrain = (p: string) => /(^|[\\/])\.brain[\\/]/.test(p)
const isDocument = (p: string) => /\.(md|mdx|txt|rst|adoc)$/i.test(p)
const GIT = /(^|[\s;&|(])(git|gh)\s|\bsdd(\.mjs)?\b/
const TESTS = /(^|[\s;&|(])(npm|pnpm|yarn|bun)\s+(run\s+)?test\b|\b(pytest|vitest|jest|mocha|go test|cargo test|dotnet test|plugin test)\b/

/**
 * Where a tool call sends the agent that makes it, first rule first: a review's or a
 * decision's agent sits at the meeting table whatever it calls; then git, the tests and
 * other commands; files by where they sit (the brain, documents, code); the web; and
 * the holo table for the rest. `hasTicket`: the agent builds a /build ticket, whose
 * own Status lines in .brain/ are part of its work at the bay.
 */
export function route(tool: string, args: Record<string, unknown>, job?: Job, hasTicket = false): Route {
  const plain = (station: Station, task: string): Route => ({ station, task, isEdit: false, isCommit: false })
  const path = String(args.file_path ?? args.notebook_path ?? args.path ?? '')
  const command = typeof args.command === 'string' ? args.command : ''
  const isCommit = /\bgit\s+commit\b/.test(command)
  let r: Route
  switch (tool) {
    case 'Bash':
    case 'PowerShell':
      r = {
        station: GIT.test(command) ? 'dock' : TESTS.test(command) ? 'tests' : 'tools',
        task: isCommit ? 'committing' : `running ${short(command, 26)}`,
        isEdit: false,
        isCommit,
      }
      break
    case 'Edit':
    case 'MultiEdit':
    case 'Write':
    case 'NotebookEdit':
      r = {
        station: isBrain(path) ? (hasTicket ? 'bay' : 'brain') : isDocument(path) ? 'computer' : 'bay',
        task: `editing ${base(path)}`,
        isEdit: true,
        isCommit: false,
      }
      break
    case 'Read':
    case 'NotebookRead':
    case 'Grep':
    case 'Glob': {
      const where = isBrain(path) || isBrain(String(args.pattern ?? '')) ? 'brain' : isDocument(path) ? 'computer' : 'shelves'
      const task = tool === 'Grep' ? `searching "${short(args.pattern, 20)}"` : tool === 'Glob' ? `listing ${short(args.pattern, 22)}` : `reading ${base(path)}`
      r = plain(where, task)
      break
    }
    case 'WebSearch':
      r = plain('comms', `searching "${short(args.query, 20)}"`)
      break
    case 'WebFetch':
      r = plain('comms', `fetching ${short(args.url, 26)}`)
      break
    default:
      r = tool.startsWith('mcp__') ? plain('comms', `asking ${short(tool.split('__')[1], 20)}`) : plain('holo', tool)
  }
  return job === 'review' || job === 'decide' ? { ...r, station: 'table' } : r
}

// ---------- the floor ----------

function newAgent(c: Crew, id: string, kind: string, station: Station, now: number, name?: string): CrewAgent {
  const called = name ?? (id === MAIN ? 'Lead' : (NAMES[c.spawned % NAMES.length] ?? 'Agent'))
  return { id, name: called, kind, station, from: station, movedAt: now, seenAt: now, task: 'arriving', isDone: false }
}

function ensure(c: Crew, id: string, now: number): Crew {
  if (c.agents.some(a => a.id === id)) return c
  // the lead was in the lounge all along, free to walk at once
  if (id === MAIN) return { ...c, agents: [...c.agents, { ...newAgent(c, MAIN, 'main', 'lounge', now - WALK_MS - STAY_MS), task: 'on a break' }] }
  return { ...c, spawned: c.spawned + 1, agents: [...c.agents, newAgent(c, id, 'agent', 'gate', now)] }
}

/** When an agent that last moved at `movedAt` may move again. */
const freeAt = (a: CrewAgent) => a.movedAt + WALK_MS + STAY_MS

/** Sends an agent to a station now, or once it has stood its second there. */
function moveTo(a: CrewAgent, station: Station, task: string, now: number): CrewAgent {
  if (a.station === station) return { ...a, task, seenAt: now, next: undefined }
  if (now < freeAt(a)) return { ...a, seenAt: now, next: { station, task } }
  return { ...a, from: a.station, station, task, movedAt: now, seenAt: now, next: undefined }
}

const pruned = (c: Crew, now: number): Crew => ({ ...c, agents: c.agents.filter(a => !a.isDone || now - (a.doneAt ?? now) < FADE_MS) })

// A timer, where the engine keeps one: without, a held move waits for the agent's next call.
function later($: EngineInterface, ms: number, fn: () => void) {
  try {
    $.clock.after(ms, fn)
  } catch {
    // no timers here
  }
}

async function change($: EngineInterface, fn: (c: Crew, now: number) => Crew): Promise<void> {
  const now = await $.clock.now()
  const next = await update($, crew, c => fn(pruned(c ?? emptyCrew(), now), now))
  // a move held back runs once its agent is free
  const waits = next.agents.filter(a => a.next !== undefined).map(a => freeAt(a) - now)
  if (waits.length > 0) later($, Math.max(50, Math.min(...waits)), () => void settle($))
}

/** Moves every agent whose held-back move is due. */
async function settle($: EngineInterface): Promise<void> {
  await change($, (c, now) => ({
    ...c,
    agents: c.agents.map(a => (a.next !== undefined && now >= freeAt(a) ? moveTo({ ...a, next: undefined }, a.next.station, a.next.task, now) : a)),
  }))
}

const moving = (id: string, station: Station, task: string) => (c: Crew, now: number): Crew => {
  const t = ensure(c, id, now)
  return { ...t, agents: t.agents.map(a => (a.id === id && !a.isDone ? moveTo(a, station, task, now) : a)) }
}

// ---------- what register.tsx's hooks call ----------

/** At session.start: the lead in the lounge. */
export async function crewStart($: EngineInterface): Promise<void> {
  await change($, (c, now) => ensure(c, MAIN, now))
}

/** At turn.start: the agent whose turn starts thinks at the holo table, or at the meeting table for a review or a decision. */
export async function crewTurnStart($: EngineInterface, agentId: string | undefined, job?: Job): Promise<void> {
  await change($, moving(agentId ?? MAIN, job === 'review' || job === 'decide' ? 'table' : 'holo', 'thinking'))
}

/** At tool.call, before the call runs: the caller walks to the call's station. */
export async function crewToolCall(
  $: EngineInterface,
  tool: string,
  args: Record<string, unknown>,
  agentId: string | undefined,
  job?: Job,
  hasTicket = false,
): Promise<void> {
  const r = route(tool, args, job, hasTicket)
  await change($, (c, now) => {
    const t = moving(agentId ?? MAIN, r.station, r.task)(c, now)
    return { ...t, edits: t.edits + (r.isEdit ? 1 : 0), commits: t.commits + (r.isCommit ? 1 : 0) }
  })
}

/** At agent.spawn, once the engine named the subagent: it arrives at the gate, and its caller meets it there. */
export async function crewSpawn($: EngineInterface, id: string, kind: string, task: string, callerId: string | undefined, name?: string): Promise<void> {
  await change($, (c, now) => {
    const caller = callerId ?? MAIN
    const t = ensure(c, caller, now)
    const agent = { ...newAgent(t, id, kind, 'gate', now, name), task: short(task, 30) || 'arriving' }
    const others = t.agents.filter(a => a.id !== id).map(a => (a.id === caller ? moveTo(a, 'gate', `calling ${agent.name}`, now) : a))
    return { ...t, spawned: t.spawned + 1, agents: [...others, agent] }
  })
}

/** At turn.complete: the lead takes a break in the lounge; a subagent leaves by the gate. */
export async function crewTurnComplete($: EngineInterface, agentId: string | undefined): Promise<void> {
  if (agentId === undefined) {
    await change($, moving(MAIN, 'lounge', 'on a break'))
    return
  }
  await change($, (c, now) => ({
    ...c,
    agents: c.agents.map(a => {
      if (a.id !== agentId) return a
      const at = { ...a, next: undefined }
      const left = at.station === 'gate' ? { ...at, task: 'done' } : { ...at, from: at.station, station: 'gate' as const, movedAt: now, task: 'done' }
      return { ...left, isDone: true, doneAt: now }
    }),
  }))
  // redraw once it has faded, so it leaves the floor
  later($, FADE_MS + 100, () => void change($, c => c))
}
