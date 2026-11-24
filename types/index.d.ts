export type Area = 'think' | 'code' | 'read' | 'shell' | 'tests' | 'git' | 'brain' | 'docs' | 'web' | 'review'
export type AgentState = 'running' | 'idle' | 'done' | 'failed' | 'stopped'

export type Agent = {
  id: string
  name: string
  kind: string
  task: string
  doing: string
  area: Area
  state: AgentState
  startedAt: number
  endedAt?: number
  tokens: number
}

export type Mix = { input: number; output: number; cacheRead: number; cacheWrite: number }

export type Ledger = {
  startedAt: number
  mix: Mix
  areas: Partial<Record<Area, number>>
  /** Tokens per minute, oldest first; the last is the minute that starts at `bucketAt`. */
  buckets: number[]
  bucketAt: number
  agents: Agent[]
}

/** A milestone of a track, from its milestone.md and its tickets' Status lines. */
export type MilestoneView = {
  num: string
  title: string
  /** Its **Phase** line: `none` while its tickets are built, then the closing step. */
  phase: string
  squashed: boolean
  landed: boolean
  /** Its tickets: how many are `done`, how many in all, and whether one is `blocked`. */
  done: number
  total: number
  blocked: boolean
}

/** One repository's track of a spec: its milestones in number order. */
export type TrackView = { slug: string; milestones: MilestoneView[] }

/** A spec in flight that has been ticketed. */
export type SpecView = { id: string; title: string; tracks: TrackView[] }

/** What the pane shows of the active brain, read from its files. */
export type BrainView = {
  name: string
  root: string
  notes: number
  repos: number
  drafts: number
  inFlight: number
  landed: number
  /** The ticketed specs in flight, lowest number first. */
  specs: SpecView[]
}

declare module 'claude-code' {
  interface PluginState {
    'alper-brain': {
      ledger: Shaped<Ledger>
      theme: Shaped<string>
      paint: Shaped<number>
      /** The active brain as last read, or null when the session has none. */
      brain: Shaped<BrainView | null>
    }
  }
}
