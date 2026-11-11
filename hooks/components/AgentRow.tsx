import type { AgentRun } from '../../types'
import { bar, elapsed, oneLine, tokens, total } from '../format'
import { METER_HEIGHT, PERSONA_HEIGHT, PERSONA_WIDTH, meter, persona } from '../personas'
import { ROLES, color, glyph, roleOf, runTone } from '../theme'
import type { Draw } from './ui'

type Props = {
  run: AgentRun
  // What the milestone calls the run's ticket, when it has one.
  ticketTitle: string | undefined
  // The most tokens any run spent: what a full meter stands for.
  largest: number
  // Whether a milestone above already shows what the run is doing, under its ticket or its stage.
  isShownAbove: boolean
  onOpen: () => void
}

// One subagent: its persona beside its title, numbers, activity and meter.
export const AgentRow = (
  { ui: { Box, Button, Text }, Svg, at }: Draw,
  { run, ticketTitle, largest, isShownAbove, onOpen }: Props,
) => {
  const role = roleOf(run.type)
  const tone = runTone(run.status)
  // The role heads the row, with a ticket's id beside it; the title is the line below.
  const title =
    run.ticket !== undefined
      ? (ticketTitle ?? run.description)
      : run.job === 'other'
        ? run.description
        : `${run.job}: ${run.description}`
  const took = elapsed((run.endedAt ?? at) - run.startedAt)
  const spentHere = total(run.tokens)
  const note =
    run.status === 'running'
      ? isShownAbove
        ? ''
        : `↳ ${run.activity}`
      : run.lastText === ''
        ? ''
        : `↳ ${run.lastText}`

  // The meter is as wide as its box, so the column may shrink below it and
  // take whatever the persona leaves, or the row wraps it underneath. The
  // title and the note take the room the flex gives them and cut at its edge.
  const rows = (
    <Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
      <Box flexDirection="row" flexWrap="nowrap" alignItems="center" gap={1}>
        <Box flexGrow={1} flexShrink={1} minWidth={0}>
          <Text wrap="truncate-end">
            <Text color={color(tone)}>{glyph(tone, at)}</Text>{' '}
            <Text color={ROLES[role]?.color} weight="bold">
              {role}
            </Text>{' '}
            {run.ticket !== undefined ? `T${run.ticket}` : ''}
            {run.repo !== undefined ? ` · ${run.repo}` : ''}
          </Text>
        </Box>
        <Button key={run.id} label="open" onPress={onOpen} />
      </Box>
      <Text wrap="truncate-end">
        {'   '}
        {oneLine(title)}
      </Text>
      <Text dimColor wrap="truncate-end">
        {'   '}
        {took} · {run.steps} steps · {run.tools} tools · {tokens(spentHere)} tok
        {Svg === undefined ? ` ${bar(spentHere / largest, 8)}` : ''}
        {run.model !== '' ? ` · ${run.model.replace(/^claude-/, '')}` : ''}
      </Text>
      {note !== '' && (
        <Text color={tone === 'active' ? 'suggestion' : undefined} dimColor={tone !== 'active'} wrap="truncate-end">
          {'   '}
          {oneLine(note)}
        </Text>
      )}
      {Svg !== undefined && (
        <Svg
          source={meter(role, spentHere / largest, run.status !== 'running')}
          alt={`${tokens(spentHere)} tok of the ${tokens(largest)} the busiest agent spent`}
          height={METER_HEIGHT}
        />
      )}
    </Box>
  )

  return Svg === undefined ? (
    <Box key={`run-${run.id}`} marginTop={1}>
      {rows}
    </Box>
  ) : (
    <Box key={`run-${run.id}`} flexDirection="row" flexWrap="nowrap" gap={1} marginTop={1}>
      <Svg
        source={persona(role, run.status, at)}
        alt={`${role}, ${run.status}`}
        width={PERSONA_WIDTH}
        height={PERSONA_HEIGHT}
      />
      {rows}
    </Box>
  )
}
