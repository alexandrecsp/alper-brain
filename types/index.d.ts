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
}

/** The milestone a /build works on, as its .sdd files stand. */
export type Build = {
  key: string
  root: string
  spec: string
  specTitle: string
  milestone: string
  milestoneTitle: string
  /** The slug on the milestone's **Repo** line: the repository it builds in. */
  repo: string | null
  phase: string
  squash: string | null
  tickets: Ticket[]
}

export type TicketSpend = { tokens: number; ms: number }

/** What a milestone's build has spent, across sessions. */
export type Ledger = {
  key: string
  agentTokens: number
  mainTokens: number
  agents: number
  byTicket: Record<string, TicketSpend>
}

declare module 'claude-code' {
  interface PluginState {
    'alper-brain': {
      runs: Shaped<AgentRun[]>
      now: number
      /** The milestones the pane follows: one, or a wave of them, all of one spec. */
      builds: Shaped<Build[]>
      /** What each followed milestone has spent, by its key. */
      ledgers: Shaped<Record<string, Ledger>>
      viewed: string
    }
  }
}
