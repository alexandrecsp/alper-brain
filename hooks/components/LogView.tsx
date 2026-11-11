import type { LogEntry } from '../../types'
import { clock, oneLine } from '../format'
import { color, glyph } from '../theme'
import type { Draw } from './ui'

type Props = { log: LogEntry[]; isLong: boolean; onToggle: () => void }

// The lines drawn while the log is short, and long.
const SHORT = 6
const LONG = 30

// What happened to the spec, newest on top: what a user back from elsewhere reads first.
export const LogView = ({ ui: { Box, Button, Text } }: Draw, { log, isLong, onToggle }: Props) => {
  const shown = [...log].reverse().slice(0, isLong ? LONG : SHORT)

  return (
    <Box key="log" flexDirection="column" marginBottom={1}>
      <Box flexDirection="row" flexWrap="nowrap" alignItems="center" gap={1}>
        <Box flexGrow={1} flexShrink={1} minWidth={0}>
          <Text weight="bold">Recent</Text>
        </Box>
        {log.length > SHORT && (
          <Button key="log-toggle" label={isLong ? 'less' : 'more'} variant="secondary" onPress={onToggle} />
        )}
      </Box>
      {shown.map((entry, i) => (
        <Box key={`log-${entry.at}-${i}`} flexDirection="row" flexWrap="nowrap" paddingLeft={2} gap={1} overflow="hidden">
          <Box flexShrink={0}>
            <Text dimColor>{clock(entry.at)}</Text>
          </Box>
          <Box flexShrink={0}>
            {/* A log line is past: an active one keeps a still glyph, not the spinner. */}
            <Text color={color(entry.tone)}>{entry.tone === 'active' ? '•' : glyph(entry.tone, 0)}</Text>
          </Box>
          <Box flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
            <Text dimColor={entry.tone === 'done' || entry.tone === 'idle'} wrap="truncate-end">
              {oneLine(entry.text)}
            </Text>
          </Box>
        </Box>
      ))}
    </Box>
  )
}
