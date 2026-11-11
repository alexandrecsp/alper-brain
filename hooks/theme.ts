import type { RunStatus, TrackState } from '../types'

// Every status the plugin shows, whether a run's, a ticket's or a stage's,
// is one of these tones, so the same state looks the same everywhere.
export type Tone = 'active' | 'done' | 'failed' | 'blocked' | 'idle'

// `color` is a theme colour name for Text; the SVGs cannot take one, so the
// few hexes they need sit beside it below.
const TONES: Record<Tone, { glyph: string; color: string }> = {
  active: { glyph: '', color: 'claude' },
  done: { glyph: '✅', color: 'success' },
  failed: { glyph: '❌', color: 'error' },
  blocked: { glyph: '🚧', color: 'warning' },
  idle: { glyph: '💤', color: 'inactive' },
}

// What is at work shows a hammer; more frames here would turn once a second.
export const SPINNER = ['🔨']

// The spinner's frame at `at`, the pane's clock, in ms.
export const spinner = (at: number) => SPINNER[Math.floor(at / 1000) % SPINNER.length] ?? '◐'

export const glyph = (tone: Tone, at: number) => (tone === 'active' ? spinner(at) : TONES[tone].glyph)

export const color = (tone: Tone) => TONES[tone].color

/** The hex of the `done` colour, for the SVG bars. */
export const DONE_HEX = '#3FB68B'

/** The glyph that opens the status line under the prompt. */
export const STATUS_LINE_GLYPH = '⚙'

export const runTone = (status: RunStatus): Tone =>
  status === 'running' ? 'active' : status === 'done' ? 'done' : status === 'failed' ? 'failed' : 'blocked'

// A ticket's Status line: anything but these is still to do.
export const ticketTone = (status: string): Tone =>
  status === 'done' ? 'done' : status === 'doing' ? 'active' : status === 'blocked' ? 'blocked' : 'idle'

/** A track of the Tracks header: working, done, held on someone, or waiting its turn. */
export const trackTone = (state: TrackState): Tone =>
  state === 'busy' || state === 'closing' || state === 'landing'
    ? 'active'
    : state === 'landed'
      ? 'done'
      : state === 'failed'
        ? 'failed'
        : state === 'ask' || state === 'blocked' || state === 'waits'
          ? 'blocked'
          : 'idle'

/** The track states the user must act on, which the Needs-you banner lists. */
export const NEEDS_USER: readonly TrackState[] = ['ask', 'failed', 'blocked']

/**
 * A stage of /build's: done once passed; at the current one, working, unless
 * its check was given up on (failed); idle while still ahead.
 */
export const stageTone = (index: number, current: number, phase: string): Tone =>
  index < current ? 'done' : index > current ? 'idle' : phase === 'failed' ? 'failed' : 'active'

// Each role has a theme colour for the text and a hex for what the SVGs draw
// beside its persona.
export const ROLES: Record<string, { color: string; hex: string }> = {
  builder: { color: 'claude', hex: '#F4C542' },
  fixer: { color: 'warning', hex: '#F08A24' },
  scribe: { color: 'success', hex: '#7FB069' },
  reviewer: { color: 'suggestion', hex: '#5FB3D9' },
  'spec-reviewer': { color: 'permission', hex: '#6C7EE0' },
  scout: { color: 'ide', hex: '#3FB68B' },
  researcher: { color: 'remember', hex: '#9B7BE0' },
  designer: { color: 'bashBorder', hex: '#D6457A' },
  architect: { color: 'merged', hex: '#4F7FD9' },
  explorer: { color: 'planMode', hex: '#B8B8B8' },
  arbiter: { color: 'autoAccept', hex: '#AF87FF' },
}

/** The hex a role without an entry draws in: the antenna's. */
export const OTHER_ROLE_HEX = '#3FB6E0'

export const roleOf = (type: string) => type.replace(/^alper-brain:/, '')
