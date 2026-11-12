// Reading the files write-tickets writes into the brain's .sdd/ and /build updates:
// .sdd/specs/NNN-<spec>/milestones/<repo>/NNN-<milestone>/{milestone.md, review.md, NNN-<ticket>.md}
// A spec ticketed before tracks has no <repo> folder: its milestones sit straight under milestones/.

import type { Build, Findings, Job, TrackState } from '../types'

/** A milestone folder, and the ticket or review file a text named in it. */
export type SddRef = {
  root: string
  spec: string
  /** The track folder the milestone sits in, its repository's slug; undefined in the flat layout. */
  track?: string
  milestone: string
  ticket?: string
  isReview: boolean
}

// A track folder is a repo slug, so it never starts with a milestone's three digits.
const SDD_PATH =
  /((?:[A-Za-z]:)?[\\/][^\s`'"()<>]*?[\\/])?\.sdd[\\/]specs[\\/](\d{3}[\w.-]*)[\\/]milestones[\\/](?:((?!\d{3})[\w.-]+)[\\/])?(\d{3}[\w.-]*)(?:[\\/](?:(\d{3})[\w.-]*\.md|(review)\.md))?/g

/**
 * The milestone a text points into, preferring a path that names a ticket,
 * then one naming the review; relative paths are read against `cwd`.
 */
export const findRef = (text: string, cwd: string): SddRef | undefined => {
  const all = [...text.matchAll(SDD_PATH)]
  const best = all.find(m => m[5] !== undefined) ?? all.find(m => m[6] !== undefined) ?? all[0]
  if (best === undefined) return undefined

  const prefix = (best[1] ?? `${cwd}/`).replace(/\\/g, '/').replace(/\/*$/, '/')

  return {
    root: `${prefix}.sdd/specs`,
    spec: best[2] ?? '',
    track: best[3],
    milestone: best[4] ?? '',
    ticket: best[5],
    isReview: best[6] !== undefined,
  }
}

export const keyOf = (ref: { root: string; spec: string; track?: string; milestone: string }) =>
  `${ref.root}/${ref.spec}/milestones/${ref.track === undefined ? '' : `${ref.track}/`}${ref.milestone}`

/** A `**Name:** value` line's value, without backticks; '' when absent. */
export const field = (md: string, name: string) => {
  const line = new RegExp(`^\\*\\*${name}:\\*\\*\\s*(.*)$`, 'm').exec(md)

  return (line?.[1] ?? '').replace(/`/g, '').trim()
}

/**
 * The repository a brief's Context block names on its `**Works in:** <slug> at <root>`
 * line (skills/brain/BRIEF.md); undefined when the brief has none.
 */
export const repoOf = (brief: string) =>
  /\*\*Works in:\*\*\s*`?([\w.-]+)`?\s+at\s/.exec(brief)?.[1]

/** A flat-layout milestone's **Repo** line, or null when it names none. */
export const repoField = (md: string) => {
  const repo = field(md, 'Repo')

  return repo === '' || /^none$/i.test(repo) ? null : repo
}

export const heading = (md: string) => (/^#\s+(.*)$/m.exec(md)?.[1] ?? '').trim()

export const shortSha = (value: string) =>
  /^[0-9a-f]{7,40}/i.test(value) ? value.slice(0, 7) : null

/** /build's closing steps, in order, after the tickets; `land` is LAND.md's, once squashed. */
export const STAGES = ['tickets', 'review', 'decide', 'fix', 'check', 'squash', 'land'] as const

/**
 * Where a milestone stands among STAGES; STAGES.length once landed. `ask`
 * is the decide step waiting on the user's answers; `waits` is a
 * migrate held at its check until its producer's expand squashes. Once
 * squashed it is landing, and a `failed` there is LAND.md giving up.
 */
export const stageOf = (phase: string, squash: string | null, landed: string | null = squash): number => {
  if (landed !== null) return STAGES.length
  if (squash !== null) return 6
  if (phase === 'review') return 1
  if (phase === 'decide' || phase === 'ask') return 2
  if (phase === 'fix') return 3
  if (phase === 'check' || phase === 'failed' || phase === 'waits') return 4
  if (phase === 'squash') return 5

  return 0
}

/**
 * How many of a review.md's findings are flagged escalate and still have no
 * `**Answer:**` line. A finding runs from its ID (`ST1`, `SP2`, `CN3`) to the
 * next. At `ask` with any of them unanswered, the build waits on the user's
 * answers (skills/build/SKILL.md, step 7).
 */
export const awaitingOf = (reviewMd: string): number =>
  findingsIn(reviewMd).filter(finding => isEscalated(finding) && !isAnswered(finding)).length

// A review.md's findings, each from its ID (`ST1`, `SP2`, `CN3`) to the next.
const findingsIn = (reviewMd: string) =>
  reviewMd.split(/^(?=[ \t]*(?:[-*][ \t]+|#{1,4}[ \t]+)?(?:\*\*)?(?:ST|SP|CN)\d+\b)/m).slice(1)

const isEscalated = (finding: string) => /\bescalate\b/i.test(finding)
const isAnswered = (finding: string) => /\*\*Answer:\*\*/.test(finding)

/** How many findings a review.md holds, how many are escalated, and how many of those have an Answer. */
export const findingsOf = (reviewMd: string): Findings => {
  const all = findingsIn(reviewMd)
  const escalated = all.filter(isEscalated)

  return { total: all.length, escalated: escalated.length, answered: escalated.filter(isAnswered).length }
}

/** A milestone still being built or landed: open, or squashed and not yet landed. */
export const isUnlanded = (b: { landed: string | null } | null | undefined) => b != null && b.landed === null

/** A `**Name:** a, b` line's entries; none for an absent line or `None`. */
export const listField = (md: string, name: string) =>
  field(md, name)
    .split(/,\s*/)
    .map(entry => entry.trim())
    .filter(entry => entry !== '' && !/^none\.?$/i.test(entry))

/** The last line of a ticket's `## Notes`, where a blocked ticket says what stopped it; '' when empty. */
export const lastNote = (md: string) => {
  const notes = /^##\s+Notes\s*$([\s\S]*)/m.exec(md)?.[1]?.split(/^##\s/m)[0] ?? ''
  const lines = notes
    .split('\n')
    .map(line => line.replace(/^\s*[-*]\s+/, '').trim())
    .filter(line => line !== '' && !/^Left empty/i.test(line))

  return lines.at(-1) ?? ''
}

/**
 * Where a track stands, by its next open milestone (else its first unlanded
 * one), the agent running for it and the other tracks' open tickets. The
 * files say landing, ask, failed, waits and blocked; a running agent says
 * busy; the rest is closing (a Phase past none, which the main session
 * works), paused (begun by an earlier call), after (its Builds after names
 * another track's milestone not squashed yet) or ready.
 */
export const trackStateOf = (
  b: Pick<Build, 'phase' | 'squash' | 'awaiting' | 'buildsAfter' | 'landsAfter' | 'tickets'>,
  running: { role: string; ticket?: string; activity: string } | undefined,
  // Each other track's open milestone and lowest open ticket number, by its slug; absent once it has no open milestone.
  openFrom: Record<string, { milestone: string; ticket: string }>,
): { state: TrackState; detail: string } => {
  if (b.squash !== null) {
    return b.phase === 'failed'
      ? { state: 'failed', detail: 'landing failed' }
      : { state: 'landing', detail: `landing, squashed ${b.squash}` }
  }
  if (b.phase === 'ask' && b.awaiting > 0) {
    const one = b.awaiting === 1
    return { state: 'ask', detail: `${b.awaiting} escalation${one ? ' waits' : 's wait'} on your answers` }
  }
  if (b.phase === 'failed') return { state: 'failed', detail: 'check failed after two fixes' }
  if (b.phase === 'waits') {
    return { state: 'waits', detail: `check waits on ${b.landsAfter.join(', ') || "its producer's expand"}` }
  }
  const blocked = b.tickets.find(t => t.status === 'blocked')
  if (blocked !== undefined) {
    return { state: 'blocked', detail: `T${blocked.num} blocked${blocked.note === '' ? '' : `: ${blocked.note}`}` }
  }
  if (running !== undefined) {
    const ticket = running.ticket === undefined ? '' : ` T${running.ticket}`
    return { state: 'busy', detail: `${running.role}${ticket} · ${running.activity}` }
  }
  if (b.phase !== 'none') return { state: 'closing', detail: `${b.phase}, by the main session` }
  if (b.tickets.some(t => t.status !== 'todo')) return { state: 'paused', detail: 'paused, no agent running' }

  // A milestone of another track is squashed once it numbers below that track's open one. A ticket's Depends
  // on another track's ticket, from before Builds after, holds it the same way, by that track's lowest open ticket.
  const open = (id: string, of: 'milestone' | 'ticket') => {
    const [slug, num] = id.split('/')
    const from = slug === undefined ? undefined : openFrom[slug]?.[of]
    return num !== undefined && from !== undefined && num >= from
  }
  const waitsOn = [
    ...b.buildsAfter.filter(id => open(id, 'milestone')),
    ...b.tickets.flatMap(t => t.dependsOn).filter(id => open(id, 'ticket')),
  ]

  return waitsOn.length > 0
    ? { state: 'after', detail: `after ${[...new Set(waitsOn)].join(', ')}` }
    : { state: 'ready', detail: 'ready' }
}

/**
 * A milestone whose escalations wait on the user: at `ask`, the Phase build's
 * step 7 writes when the user decides (`decide` is the arbiter's), with an
 * escalation still unanswered.
 */
export const waitsOnUser = (build: { phase: string; awaiting: number }) => build.phase === 'ask' && build.awaiting > 0

/** What an agent started during a phase is for, when its brief names no file. */
export const jobOf = (phase: string): Job =>
  phase === 'review'
    ? 'review'
    : phase === 'decide' || phase === 'ask'
      ? 'decide'
      : phase === 'fix'
        ? 'fix'
        : phase === 'check' || phase === 'failed'
          ? 'check'
          : 'other'
