// What changed in a milestone between two reads of its files, as lines for the pane's Recent log.

import type { Build, LogEntry } from '../types'
import { waitsOnUser } from './sdd'

export type Change = Omit<LogEntry, 'at'>

/** How the log names a milestone: its repository and number, `billing-api M001`. */
export const nameOf = (b: Pick<Build, 'repo' | 'milestone'>) =>
  `${b.repo === null ? '' : `${b.repo} `}M${b.milestone.slice(0, 3)}`

/** The changes from `before` to `after`, oldest first; none for a milestone read the first time. */
export const changesOf = (before: Build | undefined, after: Build): Change[] => {
  if (before === undefined) return []

  const who = nameOf(after)
  const out: Change[] = []
  for (const t of after.tickets) {
    const was = before.tickets.find(one => one.num === t.num)
    if (was === undefined || was.status === t.status) continue

    if (t.status === 'done') out.push({ text: `${who} T${t.num} done${t.commit === null ? '' : ` ${t.commit}`}`, tone: 'done' })
    else if (t.status === 'blocked') out.push({ text: `${who} T${t.num} blocked${t.note === '' ? '' : `: ${t.note}`}`, tone: 'blocked' })
    else if (t.status === 'doing') out.push({ text: `${who} T${t.num} started`, tone: 'active' })
  }

  if (before.findings.total === 0 && after.findings.total > 0) {
    const { total, escalated } = after.findings
    out.push({ text: `${who} review: ${total} finding${total === 1 ? '' : 's'}, ${escalated} escalated`, tone: 'idle' })
  }

  if (before.phase !== after.phase) {
    const phase = after.phase
    if (phase === 'ask' && waitsOnUser(after)) out.push({ text: `${who} decide waits on you`, tone: 'blocked' })
    else if (phase === 'failed') out.push({ text: `${who} ${after.squash === null ? 'check' : 'landing'} failed`, tone: 'failed' })
    else if (phase === 'waits') out.push({ text: `${who} check waits on ${after.landsAfter.join(', ') || 'its expand'}`, tone: 'blocked' })
    else if (phase !== 'none' && phase !== 'landed') out.push({ text: `${who} ${phase}`, tone: 'active' })
  }

  if (before.squash === null && after.squash !== null) out.push({ text: `${who} squashed ${after.squash}`, tone: 'done' })
  if (before.landed === null && after.landed !== null) out.push({ text: `${who} landed ${after.landed}`, tone: 'done' })

  return out
}
