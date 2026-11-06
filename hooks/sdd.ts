// Reading the files to-tickets writes into the brain's .sdd/ and /build updates:
// .sdd/specs/NNN-<spec>/milestones/<repo>/NNN-<milestone>/{milestone.md, review.md, NNN-<ticket>.md}
// A spec ticketed before tracks has no <repo> folder: its milestones sit straight under milestones/.

import type { Job } from '../types'

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

/** /build's closing steps, in order, after the tickets. */
export const STAGES = ['tickets', 'review', 'decide', 'fix', 'check', 'squash'] as const

/**
 * Where a milestone stands among STAGES; STAGES.length once squashed. `ask`
 * is the decide step's word in builds from before the arbiter; `waits` is a
 * migrate held at its check until its producer's expand squashes.
 */
export const stageOf = (phase: string, squash: string | null): number => {
  if (squash !== null) return STAGES.length
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
 * next. At the decide stage with none of them answered and no arbiter running,
 * the build waits on the user's answers (skills/build/SKILL.md, step 7).
 */
export const awaitingOf = (reviewMd: string): number =>
  reviewMd
    .split(/^(?=\s*(?:[-*]\s+|#{1,4}\s+)?(?:\*\*)?(?:ST|SP|CN)\d+\b)/m)
    .slice(1)
    .filter(finding => /\bescalate\b/i.test(finding) && !/\*\*Answer:\*\*/.test(finding)).length

/** A milestone at the decide stage whose escalations wait on the user: some unanswered, and no arbiter deciding them. */
export const waitsOnUser = (
  build: { key: string; phase: string; awaiting: number },
  runs: { status: string; milestone?: string; job: Job }[],
) =>
  (build.phase === 'decide' || build.phase === 'ask') &&
  build.awaiting > 0 &&
  !runs.some(run => run.status === 'running' && run.milestone === build.key && run.job === 'decide')

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
