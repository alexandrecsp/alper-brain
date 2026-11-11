import type { MainActivity, Tracks } from '../../types'
import { elapsed, oneLine } from '../format'
import { NEEDS_USER, color, glyph, trackTone } from '../theme'
import type { Draw } from './ui'

type Props = {
  tracks: Tracks
  main: MainActivity
  // Whether any subagent runs: the main session's idle turn then waits on them.
  anyRunning: boolean
}

// On top: what waits on the user, then one line per track of the spec, then
// what the main session, which closes and lands the milestones, last did.
export const TracksView = ({ ui: { Box, Text }, at }: Draw, { tracks, main, anyRunning }: Props) => {
  const needs = tracks.lines.filter(line => NEEDS_USER.includes(line.state))
  const id = tracks.spec.slice(0, 3)
  const width = Math.max(...tracks.lines.map(line => line.repo.length))
  const inFlight = tracks.lines.filter(line => line.state !== 'landed').length
  const mainLine =
    main.at === 0
      ? ''
      : main.activity !== ''
        ? `main ${glyph('active', at)} ${main.activity} · ${elapsed(at - main.at)}`
        : `main ${anyRunning ? 'waits on its agents' : 'idle'} · ${elapsed(at - main.at)}`

  return (
    <Box key="tracks" flexDirection="column" marginBottom={1}>
      {needs.map(line => (
        <Box key={`needs-${line.repo}`} flexDirection="row" flexWrap="nowrap" overflow="hidden">
          <Text color={color(trackTone(line.state))} weight="bold" wrap="truncate-end">
            {oneLine(`⚠ ${line.repo} M${line.milestone.slice(0, 3)}: ${line.detail} — /build ${id}`)}
          </Text>
        </Box>
      ))}
      <Text>
        <Text weight="bold">Tracks</Text>
        <Text dimColor>
          {' '}
          {inFlight} of {tracks.lines.length} in flight
        </Text>
      </Text>
      {tracks.lines.map(line => {
        const tone = trackTone(line.state)
        const head = `${line.repo.padEnd(width)} ${line.milestone === '' ? '    ' : `M${line.milestone.slice(0, 3)}`} ${line.done}/${line.total}`

        return (
          <Box key={`track-${line.repo}`} flexDirection="row" flexWrap="nowrap" paddingLeft={2} gap={1} overflow="hidden">
            <Box flexShrink={0}>
              <Text color={color(tone)}>{glyph(tone, at)}</Text>
            </Box>
            <Box flexShrink={0}>
              <Text dimColor={tone === 'done' || tone === 'idle'}>{head}</Text>
            </Box>
            <Box flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
              <Text color={tone === 'idle' ? undefined : color(tone)} dimColor={tone === 'idle'} wrap="truncate-end">
                {oneLine(line.detail)}
              </Text>
            </Box>
          </Box>
        )
      })}
      {mainLine !== '' && (
        <Text dimColor={main.activity === ''} wrap="truncate-end">
          {'  '}
          {oneLine(mainLine)}
        </Text>
      )}
    </Box>
  )
}
