import type { Station } from '../../types'

// Where people stand at each station, in gen.py's grid units: x runs along the back
// wall, y along the left wall. The crew times its walks by them, the drawing places people.
export const SPOTS: Record<Station, [number, number][]> = {
  bay: [[9.0, 3.3], [13.3, 3.5], [11.1, 4.3], [8.7, 1.7]],
  tools: [[3.9, 2.0], [5.3, 2.1], [6.5, 2.4]],
  shelves: [[2.0, 8.2], [2.1, 9.8], [2.0, 6.8]],
  brain: [[2.0, 5.0], [2.7, 5.6]],
  computer: [[2.3, 16.4], [2.5, 17.9]],
  comms: [[16.4, 15.9], [17.6, 16.3]],
  holo: [[8.3, 14.3], [12.7, 14.6], [10.4, 16.0], [12.5, 11.4]],
  table: [[4.5, 17.4], [7.0, 18.0], [5.5, 19.3], [6.5, 16.4]],
  lounge: [[6.8, 25.3], [7.8, 25.9]],
  tests: [[16.4, 25.1], [17.8, 25.7]],
  dock: [[17.2, 6.5], [18.7, 7.1]],
  gate: [[18.1, 2.1], [17.0, 2.9], [19.1, 2.7]],
}

/** The `k`th spot at a station; past its last spot, a row further out. */
export function spotOf(station: Station, k: number): [number, number] {
  const list = SPOTS[station]
  const sp = list[k % list.length] ?? [10, 13]
  const r = Math.floor(k / list.length)
  return [sp[0] + r * 0.7, sp[1] + r * 0.7]
}

// People walk at an even pace: grid units a second, and the shortest and longest walk.
const PACE = 8
const SHORTEST_MS = 700
const LONGEST_MS = 3000

/** How long the walk between two stations takes, by the distance between their first spots. */
export function walkMs(from: Station, to: Station): number {
  const a = spotOf(from, 0)
  const b = spotOf(to, 0)
  const ms = (Math.hypot(b[0] - a[0], b[1] - a[1]) / PACE) * 1000
  return Math.round(Math.min(LONGEST_MS, Math.max(SHORTEST_MS, ms)))
}
