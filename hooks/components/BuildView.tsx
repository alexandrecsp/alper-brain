import type { AgentRun, Build, Ledger } from '../../types'
import { bar, elapsed, oneLine, tokens } from '../format'
import { PROGRESS_HEIGHT, progress } from '../personas'
import { STAGES, stageOf } from '../sdd'
import { color, glyph, stageTone, ticketTone } from '../theme'
import type { Draw } from './ui'

type Props = { build: Build; spent: Ledger | null; running: AgentRun[] }

// The milestone on top: its title, ticket progress, stages and tickets.
export const BuildView = ({ ui: { Box, Text }, Svg, at }: Draw, { build, spent, running }: Props) => {
  const done = build.tickets.filter(t => t.status === 'done').length
  const share = done / Math.max(1, build.tickets.length)
  const stage = stageOf(build.phase, build.squash)
  const cost = spent === null ? 0 : spent.agentTokens + spent.mainTokens

  return (
    <Box flexDirection="column" marginBottom={1}>
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
          </Text>
        </Box>
      </Box>
      <Text>
        {STAGES.map((name, i) => {
          const label = i === stage && build.phase === 'failed' ? 'check failed' : name
          const tone = stageTone(i, stage, build.phase)

          return (
            <Text color={color(tone)} dimColor={tone === 'idle'}>
              {i > 0 ? ' → ' : ''}
              {glyph(tone, at)} {label}
            </Text>
          )
        })}
      </Text>
      <Text dimColor>
        {tokens(cost)} tokens · agents {tokens(spent?.agentTokens ?? 0)} · main session{' '}
        {tokens(spent?.mainTokens ?? 0)} · {spent?.agents ?? 0} agents
      </Text>
      {build.tickets.map(ticket => {
        const spend = spent?.byTicket[ticket.num]
        const live = running.find(run => run.milestone === build.key && run.ticket === ticket.num)
        const liveMs = live === undefined ? 0 : at - live.startedAt
        const facts = [
          spend === undefined ? '' : `${tokens(spend.tokens)} tok`,
          spend === undefined && live === undefined ? '' : elapsed((spend?.ms ?? 0) + liveMs),
          ticket.commit ?? '',
        ].filter(fact => fact !== '')
        const tail = facts.join(' · ')
        const tone = ticketTone(ticket.status)

        return (
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
        )
      })}
    </Box>
  )
}
