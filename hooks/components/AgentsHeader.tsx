import { tokens } from '../format'
import type { Draw } from './ui'

type Props = {
  finished: number
  // Tokens every run spent together.
  spent: number
  onClear: () => void
}

// The "Agents" line, and at its far right the button that clears the runs that ended.
export const AgentsHeader = ({ ui: { Box, Button, Text } }: Draw, { finished, spent, onClear }: Props) => (
  <Box flexDirection="row" flexWrap="nowrap" alignItems="center" gap={1}>
    <Box flexGrow={1} flexShrink={1} minWidth={0}>
      <Text>
        <Text weight="bold">Agents</Text>
        <Text dimColor>
          {' '}
          {tokens(spent)} tok this session
        </Text>
      </Text>
    </Box>
    {finished > 0 && <Button key="clear" label="Clear finished" variant="secondary" onPress={onClear} />}
  </Box>
)
