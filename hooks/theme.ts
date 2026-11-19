import type { TrackState } from '../types'

// Every status the plugin shows, whether a run's, a ticket's or a stage's,
// is one of these tones, so the same state looks the same everywhere.
export type Tone = 'active' | 'done' | 'failed' | 'blocked' | 'idle'

// `color` is a theme colour name for Text; the workshop's SVG takes hexes instead.
const TONES: Record<Tone, string> = {
  active: 'claude',
  done: 'success',
  failed: 'error',
  blocked: 'warning',
  idle: 'inactive',
}

export const color = (tone: Tone) => TONES[tone]

/** The glyph that opens the status line under the prompt. */
export const STATUS_LINE_GLYPH = '⚙'

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

/** The track states the user must act on, which the workshop lists as waiting on them. */
export const NEEDS_USER: readonly TrackState[] = ['ask', 'failed', 'blocked']

// Each role has a theme colour for text and a hex for the workshop's drawing.
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

/** The hex a role without an entry draws in. */
export const OTHER_ROLE_HEX = '#3FB6E0'

export const roleOf = (type: string) => type.replace(/^alper-brain:/, '')
