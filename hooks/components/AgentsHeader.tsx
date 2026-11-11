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

type GroupProps = {
  // The milestone the group's runs work for, `M001 Parse invoices · billing-api`; '' for the rest.
  label: string
  finished: number
  // Tokens the group's finished runs spent.
  spent: number
  isExpanded: boolean
  onToggle: () => void
}

// A group's heading: its milestone and, when it has ended runs, how many and a button that shows or hides them.
export const AgentGroup = ({ ui: { Box, Button, Text } }: Draw, { label, finished, spent, isExpanded, onToggle }: GroupProps) => (
  <Box flexDirection="row" flexWrap="nowrap" alignItems="center" gap={1} marginTop={1}>
    <Box flexGrow={1} flexShrink={1} minWidth={0}>
      <Text dimColor wrap="truncate-end">
        {label === '' ? 'Other agents' : label}
        {finished > 0 ? ` · ${finished} finished, ${tokens(spent)} tok` : ''}
      </Text>
    </Box>
    {finished > 0 && label !== '' && (
      <Button key={`group-${label}`} label={isExpanded ? 'hide' : 'show'} variant="secondary" onPress={onToggle} />
    )}
  </Box>
)
