export type RunStatus = 'running' | 'done' | 'failed' | 'stopped'

/** What a run is for, within /build: its ticket, the review, the arbiter's decisions, the fixer's fixes or the milestone check. */
export type Job = 'ticket' | 'review' | 'decide' | 'fix' | 'check' | 'other'

export type Tokens = {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

export type AgentRun = {
  id: string
  type: string
  description: string
  model: string
  parentId?: string
  status: RunStatus
  startedAt: number
  endedAt?: number
  steps: number
  tools: number
  tokens: Tokens
  activity: string
  lastText: string
  /** The key of the milestone the run works for, when it works for one. */
  milestone?: string
  /** The ticket's number (`003`), when its brief names a ticket file. */
  ticket?: string
  /** The slug of the repository its brief's Context block says it works in. */
  repo?: string
  job: Job
}

export type Ticket = {
  num: string
  title: string
  status: string
  commit: string | null
  /** Its **Depends on** entries, tickets of its own track such as `003`; a spec from before **Builds after** may hold `web-app/002`. */
  dependsOn: string[]
  /** The last line of its Notes, which says what stopped it once it is `blocked`. */
  note: string
}

/** A review.md's findings, by sdd.ts's findingsOf. */
export type Findings = { total: number; escalated: number; answered: number }

/** The milestone a /build works on, as its .brain files stand. */
export type Build = {
  key: string
  root: string
  spec: string
  specTitle: string
  /** The track folder the milestone sits in, its repository's slug; undefined in the flat layout. */
  track?: string
  milestone: string
  milestoneTitle: string
  /** The repository it builds in: its track, else a flat-layout milestone's **Repo** line. */
  repo: string | null
  phase: string
  squash: string | null
  /** Its **Landed** commit; its Squash where milestone.md has no Landed line (an old spec); null until it lands. */
  landed: string | null
  /** Its **Builds after** ids, other tracks' milestones it starts building after they squash. */
  buildsAfter: string[]
  /** Its **Lands after** ids, other tracks' milestones it lands after. */
  landsAfter: string[]
  findings: Findings
  /** The review's escalated findings still without an Answer, by sdd.ts's awaitingOf. */
  awaiting: number
  tickets: Ticket[]
}

export type TicketSpend = { tokens: number; ms: number }

/**
 * Where a track of the followed spec stands, by its next open milestone (else
 * its first unlanded one): what the pane's Tracks header shows, one line each.
 */
export type TrackState =
  | 'busy'
  | 'closing'
  | 'paused'
  | 'ready'
  | 'after'
  | 'waits'
  | 'ask'
  | 'failed'
  | 'blocked'
  | 'landing'
  | 'landed'

export type TrackLine = {
  repo: string
  /** The milestone's key, by sdd.ts's keyOf; '' once the track has landed. */
  key: string
  milestone: string
  title: string
  state: TrackState
  /** What it waits on, or what stopped it. */
  detail: string
  done: number
  total: number
}

/** The followed spec's tracks, read from its files. */
export type Tracks = { spec: string; specTitle: string; lines: TrackLine[] }

/** One thing that happened to the followed spec, by the pane's clock. */
export type LogEntry = { at: number; text: string; tone: 'active' | 'done' | 'failed' | 'blocked' | 'idle' }

/** What a milestone's build has spent, across sessions. */
export type Ledger = {
  key: string
  agentTokens: number
  mainTokens: number
  agents: number
  byTicket: Record<string, TicketSpend>
}

/** A place in the workshop pane, where what an agent does sends it. */
export type Station =
  | 'gate'
  | 'table'
  | 'dock'
  | 'tests'
  | 'tools'
  | 'bay'
  | 'brain'
  | 'shelves'
  | 'computer'
  | 'comms'
  | 'holo'
  | 'lounge'

/** One agent of the session on the workshop floor: the main session or a subagent. */
export type CrewAgent = {
  id: string
  name: string
  /** The subagent type as the spawn named it, or `main`. */
  kind: string
  station: Station
  /** The station it walked from: the walk is drawn while `movedAt` is recent. */
  from: Station
  movedAt: number
  /** When it last did anything: the latest is the pane's lead. */
  seenAt: number
  task: string
  /** Where it goes once it has stood a second at its station, when a call came sooner. */
  next?: { station: Station; task: string }
  isDone: boolean
  doneAt?: number
}

export type Crew = {
  agents: CrewAgent[]
  /** How many subagents arrived, for their names. */
  spawned: number
  edits: number
  commits: number
}

declare module 'claude-code' {
  interface PluginState {
    'alper-brain': {
      runs: Shaped<AgentRun[]>
      now: number
      /** The milestones the pane follows: one, or one per track, all of one spec. */
      builds: Shaped<Build[]>
      /** What each followed milestone has spent, by its key. */
      ledgers: Shaped<Record<string, Ledger>>
      tracks: Shaped<Tracks | null>
      log: Shaped<LogEntry[]>
      /** The workshop's crew: where each agent stands and what it does. */
      crew: Shaped<Crew>
    }
  }
}
