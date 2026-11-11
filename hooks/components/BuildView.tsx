import type { AgentRun, Build, Ledger } from '../../types'
import { bar, elapsed, oneLine, tokens } from '../format'
import { PROGRESS_HEIGHT, progress } from '../personas'
import { STAGES, stageOf, waitsOnUser } from '../sdd'
import { ROLES, color, glyph, roleOf, stageTone, ticketTone } from '../theme'
import type { Draw } from './ui'

type Props = {
  build: Build
  spent: Ledger | null
  // Every run of the session: the running ones show where they work, and the
  // check's fixers count its attempts.
  runs: AgentRun[]
  onOpen: (run: AgentRun) => void
}

// The fixes a failing check gets before the build gives up on it (skills/build/SKILL.md, step 9).
const CHECK_FIXES = 2

// The milestone on top: its title, ticket progress, stages and tickets, each
// ticket with the agent building it, and each stage's agent beneath them.
export const BuildView = ({ ui, Svg, at }: Draw, { build, spent, runs, onOpen }: Props) => {
  const { Box, Button, Text } = ui
  const done = build.tickets.filter(t => t.status === 'done').length
  const share = done / Math.max(1, build.tickets.length)
  const stage = stageOf(build.phase, build.squash, build.landed)
  // Escalations the user decides stop the track at ask until the next /build asks them.
  const waiting = waitsOnUser(build)
  const cost = spent === null ? 0 : spent.agentTokens + spent.mainTokens
  const mine = runs.filter(run => run.milestone === build.key)
  const running = mine.filter(run => run.status === 'running')
  const closing = running.filter(run => run.ticket === undefined)
  const checkFixes = mine.filter(run => run.job === 'check' && roleOf(run.type) === 'fixer').length
  const { total, escalated, answered } = build.findings
  const review = [
    total > 0 ? `review ${total} finding${total === 1 ? '' : 's'}` : '',
    escalated > 0 ? `${escalated} escalated, ${answered} answered` : '',
    checkFixes > 0 && (build.phase === 'check' || build.phase === 'failed') ? `check fixes ${checkFixes}/${CHECK_FIXES}` : '',
  ].filter(part => part !== '')

  // One agent at work, on a line of its own under what it works on.
  const liveLine = (run: AgentRun, indent: number) => {
    const role = roleOf(run.type)
    return (
      <Box key={`live-${run.id}`} flexDirection="row" flexWrap="nowrap" alignItems="center" paddingLeft={indent} gap={1} overflow="hidden">
        <Box flexShrink={0}>
          <Text color={ROLES[role]?.color} weight="bold">
            {role}
          </Text>
        </Box>
        <Box flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
          <Text color="suggestion" wrap="truncate-end">
            {oneLine(`↳ ${run.activity}`)}
          </Text>
        </Box>
        <Button key={`open-${run.id}`} label="open" variant="secondary" onPress={() => onOpen(run)} />
      </Box>
    )
  }

  return (
    <Box key={`build-${build.key}`} flexDirection="column" marginBottom={1}>
      <Box flexDirection="row" flexWrap="nowrap" gap={1}>
        {/* The spec gives way before the milestone, which is the one being built. */}
        <Box flexShrink={4} minWidth={0}>
          <Text weight="bold" wrap="truncate-end">
            {build.spec.slice(0, 3)} {oneLine(build.specTitle)}
          </Text>
        </Box>
        <Text dimColor>›</Text>
        <Box flexShrink={1} minWidth={0}>
          <Text weight="bold" wrap="truncate-end">
            M{build.milestone.slice(0, 3)} {oneLine(build.milestoneTitle)}
          </Text>
        </Box>
        {build.repo !== null && (
          <Box flexShrink={0}>
            <Text dimColor>· {build.repo}</Text>
          </Box>
        )}
      </Box>
      <Box flexDirection="row" flexWrap="nowrap" alignItems="center" gap={1}>
        {Svg === undefined ? (
          <Text color={color('done')}>{bar(share, 12)}</Text>
        ) : (
          // The bar takes the row's room, the count its own width.
          <Box flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
            <Svg
              source={progress(share)}
              alt={`${done} of ${build.tickets.length} tickets done`}
              height={PROGRESS_HEIGHT}
            />
          </Box>
        )}
        <Box flexShrink={0}>
          <Text wrap="truncate-end">
            {done}/{build.tickets.length} tickets
            {build.squash !== null && <Text color={color('done')}> · squashed {build.squash}</Text>}
            {build.landed !== null && <Text color={color('done')}> · landed {build.landed}</Text>}
          </Text>
        </Box>
      </Box>
      <Text>
        {STAGES.map((name, i) => {
          const label =
            i === stage && build.phase === 'failed'
              ? `${name} failed`
              : i === stage && build.phase === 'waits'
                ? 'check waits'
                : i === stage && waiting
                  ? 'decide waits on you'
                  : name
          const tone = i === stage && waiting ? 'blocked' : stageTone(i, stage, build.phase)

          return (
            <Text color={color(tone)} dimColor={tone === 'idle'}>
              {i > 0 ? ' → ' : ''}
              {glyph(tone, at)} {label}
            </Text>
          )
        })}
      </Text>
      {review.length > 0 && (
        <Text color={waiting ? color('blocked') : undefined} dimColor={!waiting} wrap="truncate-end">
          {review.join(' · ')}
        </Text>
      )}
      <Text dimColor>
        {tokens(cost)} tokens · agents {tokens(spent?.agentTokens ?? 0)} · main session{' '}
        {tokens(spent?.mainTokens ?? 0)} · {spent?.agents ?? 0} agents
      </Text>
      {build.tickets.map(ticket => {
        const spend = spent?.byTicket[ticket.num]
        const live = running.find(run => run.ticket === ticket.num)
        const liveMs = live === undefined ? 0 : at - live.startedAt
        const facts = [
          spend === undefined ? '' : `${tokens(spend.tokens)} tok`,
          spend === undefined && live === undefined ? '' : elapsed((spend?.ms ?? 0) + liveMs),
          ticket.commit ?? '',
        ].filter(fact => fact !== '')
        const tail = facts.join(' · ')
        const tone = ticketTone(ticket.status)

        return (
          <Box key={`ticket-${ticket.num}`} flexDirection="column">
            <Box flexDirection="row" flexWrap="nowrap" paddingLeft={2} gap={1} overflow="hidden">
              {/* The title is a plain string in a Text of its own: a Text nested in a Text does not cut at the edge. */}
              <Box flexShrink={0}>
                <Text color={color(tone)}>{glyph(tone, at)}</Text>
              </Box>
              <Box flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
                <Text dimColor={tone === 'done'} wrap="truncate-end">
                  {`${ticket.num} ${oneLine(ticket.title)}`}
                </Text>
              </Box>
              <Box flexShrink={0}>
                <Text dimColor wrap="truncate-end">
                  {tail}
                </Text>
              </Box>
            </Box>
            {live !== undefined && liveLine(live, 5)}
            {ticket.status === 'blocked' && ticket.note !== '' && (
              <Box paddingLeft={5} overflow="hidden">
                <Text color={color('blocked')} wrap="truncate-end">
                  {oneLine(`↳ ${ticket.note}`)}
                </Text>
              </Box>
            )}
          </Box>
        )
      })}
      {/* The review, the arbiter, the fixers and the check work for the milestone, not a ticket. */}
      {closing.map(run => liveLine(run, 2))}
    </Box>
  )
}
