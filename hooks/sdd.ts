// Reading the files to-tickets writes into the brain's .sdd/ and /build updates:
// .sdd/specs/NNN-<spec>/milestones/NNN-<milestone>/{milestone.md, review.md, NNN-<ticket>.md}

import type { Job } from '../types'

/** A milestone folder, and the ticket or review file a text named in it. */
export type SddRef = {
  root: string
  spec: string
  milestone: string
  ticket?: string
  isReview: boolean
}

const SDD_PATH =
  /((?:[A-Za-z]:)?[\\/][^\s`'"()<>]*?[\\/])?\.sdd[\\/]specs[\\/](\d{3}[\w.-]*)[\\/]milestones[\\/](\d{3}[\w.-]*)(?:[\\/](?:(\d{3})[\w.-]*\.md|(review)\.md))?/g

/**
 * The milestone a text points into, preferring a path that names a ticket,
 * then one naming the review; relative paths are read against `cwd`.
 */
export const findRef = (text: string, cwd: string): SddRef | undefined => {
  const all = [...text.matchAll(SDD_PATH)]
  const best = all.find(m => m[4] !== undefined) ?? all.find(m => m[5] !== undefined) ?? all[0]
  if (best === undefined) return undefined

  const prefix = (best[1] ?? `${cwd}/`).replace(/\\/g, '/').replace(/\/*$/, '/')

  return {
    root: `${prefix}.sdd/specs`,
    spec: best[2] ?? '',
    milestone: best[3] ?? '',
    ticket: best[4],
    isReview: best[5] !== undefined,
  }
}

export const keyOf = (ref: { root: string; spec: string; milestone: string }) =>
  `${ref.root}/${ref.spec}/milestones/${ref.milestone}`

/** A `**Name:** value` line's value, without backticks; '' when absent. */
export const field = (md: string, name: string) => {
  const line = new RegExp(`^\\*\\*${name}:\\*\\*\\s*(.*)$`, 'm').exec(md)

  return (line?.[1] ?? '').replace(/`/g, '').trim()
}

export const heading = (md: string) => (/^#\s+(.*)$/m.exec(md)?.[1] ?? '').trim()

export const shortSha = (value: string) =>
  /^[0-9a-f]{7,40}/i.test(value) ? value.slice(0, 7) : null

/** /build's closing steps, in order, after the tickets. */
export const STAGES = ['tickets', 'review', 'decide', 'fix', 'check', 'squash'] as const

/**
 * Where a milestone stands among STAGES; STAGES.length once squashed. `ask`
 * is the decide step's word in builds from before the arbiter.
 */
export const stageOf = (phase: string, squash: string | null): number => {
  if (squash !== null) return STAGES.length
  if (phase === 'review') return 1
  if (phase === 'decide' || phase === 'ask') return 2
  if (phase === 'fix') return 3
  if (phase === 'check' || phase === 'failed') return 4
  if (phase === 'squash') return 5

  return 0
}

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
