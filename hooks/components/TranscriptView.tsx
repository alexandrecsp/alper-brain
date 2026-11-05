import type { SessionMessage } from 'claude-code'

import type { AgentRun } from '../../types'
import { clock, describe, oneLine } from '../format'
import { ROLES, roleOf } from '../theme'
import type { Draw } from './ui'

type Props = {
  // The run being read; undefined when the pane outlives it.
  run: AgentRun | undefined
  // Oldest first, or why the engine would not hand them over.
  messages: SessionMessage[] | { deny: string }
  // When each message was first seen, by its place in `messages`.
  stamps: number[]
  onBack: () => void
}

// The newest messages and the longest text of one drawn: a pane is not the place to read a whole run.
const LAST = 30
const CUT = 800

// One subagent's transcript, newest message on top, where the host has no main view to switch to.
export const TranscriptView = ({ ui: { Box, Button, Text } }: Draw, { run, messages, stamps, onBack }: Props) => {
  const role = roleOf(run?.type ?? '')
  const head = (
    <Box flexDirection="row" flexWrap="nowrap" alignItems="center" gap={1} marginBottom={1}>
      <Box flexGrow={1} flexShrink={1} minWidth={0}>
        <Text wrap="truncate-end">
          {oneLine(`${role} ${run?.ticket !== undefined ? `T${run.ticket}` : ''} ${run?.description ?? ''}`)}
        </Text>
      </Box>
      <Button key="back" label="back" onPress={onBack} />
    </Box>
  )

  if ('deny' in messages) {
    return (
      <Box flexDirection="column">
        {head}
        <Text dimColor>{messages.deny}</Text>
      </Box>
    )
  }

  // The first message is the parent's brief; a later one from that side only carries tool results back.
  // A message with nothing to draw (an assistant turn of thinking alone) is left out.
  const shown = messages
    .map((message, i) => ({ message, at: stamps[i], name: i === 0 ? 'brief' : message.role === 'user' ? 'result' : role }))
    .filter(
      ({ message }) => message.text !== '' || message.toolUses.length > 0 || (message.toolResults?.length ?? 0) > 0,
    )
    .slice(-LAST)
    .reverse()

  return (
    <Box flexDirection="column">
      {head}
      {shown.length === 0 && <Text dimColor>Nothing said yet.</Text>}
      {shown.map(({ message, at, name }) => (
        <Box flexDirection="column" marginBottom={1}>
          <Box flexDirection="row" flexWrap="nowrap" gap={1}>
            <Text color={name === role ? ROLES[role]?.color : undefined} weight="bold">
              {name}
            </Text>
            <Box flexGrow={1} />
            {at !== undefined && <Text dimColor>{clock(at)}</Text>}
          </Box>
          {message.text !== '' && (
            <Text>{message.text.length > CUT ? `${message.text.slice(0, CUT)}…` : message.text}</Text>
          )}
          {message.toolResults?.map(result => (
            <Text dimColor wrap="truncate-end">{`${result.isError ? '✗' : '↳'} ${oneLine(result.text)}`}</Text>
          ))}
          {message.toolUses.map(use => (
            <Text dimColor wrap="truncate-end">{`⚙ ${oneLine(describe(use.tool, use.input))}`}</Text>
          ))}
        </Box>
      ))}
    </Box>
  )
}
