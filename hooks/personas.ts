import type { RunStatus } from '../types';
import { DONE_HEX, OTHER_ROLE_HEX, ROLES } from './theme';

// Each subagent's persona: one pixel critter, dressed by its role. Drawn as an
// SVG, which the editor and the desktop draw and the terminal does not.

type Piece = { x: number; y: number; colors: Record<string, string>; rows: string[] }

const WIDTH = 20
// One row above the critter's 16, which is the room its hop takes, and one
// below it for the floor.
const HEIGHT = 18
const SCALE = 2

const SKIN = '#EF9A76'
const SHADE = '#C96F4F'
const INK = '#1E1E24'
const WOOD = '#8B5A2B'
const STEEL = '#A7ADB5'

const body: Piece = {
  x: 2,
  y: 0,
  colors: { b: SKIN, s: SHADE, e: INK, w: '#FFFFFF', c: '#F7B8A8' },
  rows: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '.....bbbbbb.....',
    '...bbbbbbbbbb...',
    '..bbbbbbbbbbbb..',
    '..bbbbbbbbbbbb..',
    '.bbbwebbbbwebbb.',
    '.bbbeebbbbeebbb.',
    '.bbcbbbbbbbbcbb.',
    '.bbbbbbssbbbbbb.',
    '..bbbbbbbbbbbb..',
    '..ssssssssssss..',
    '...ss.ss.ss.ss..',
  ],
}

// The eyes over the body's, for a run that did not finish well.
const eyes = (rows: string[]): Piece[] =>
  [6, 12].map(x => ({ x, y: 9, colors: { b: SKIN, e: INK }, rows }))

const MOOD: Partial<Record<RunStatus, Piece[]>> = {
  failed: eyes(['eb', 'be']),
  stopped: eyes(['bb', 'ee']),
}

const OUTFIT: Record<string, Piece[]> = {
  // A hard hat and a hammer.
  builder: [
    {
      x: 2,
      y: 2,
      colors: { y: '#F4C542', Y: '#C99A1E' },
      rows: [
        '......yyyy......',
        '.....yyyyyy.....',
        '....yyyYyyyy....',
        '....yyyYyyyy....',
        '..YYYYYYYYYYYY..',
      ],
    },
    { x: 16, y: 7, colors: { m: STEEL, h: WOOD }, rows: ['mmm', 'mmm', '.h.', '.h.', '.h.', '.h.'] },
  ],
  // Reading glasses and a magnifier.
  reviewer: [
    {
      x: 5,
      y: 8,
      colors: { g: '#3A3F4B' },
      rows: ['gggg..gggg', 'g..gggg..g', 'g..g..g..g', 'gggg..gggg'],
    },
    {
      x: 16,
      y: 5,
      colors: { g: '#3A3F4B', l: '#A8D8EA', L: '#E6F6FB', h: WOOD },
      rows: ['.gg.', 'gLlg', 'gllg', '.gg.', '.h..', 'h...'],
    },
  ],
  // A mortarboard and a clipboard.
  'spec-reviewer': [
    {
      x: 2,
      y: 3,
      colors: { k: '#4A5BB5', K: '#36448C', t: '#F4C542' },
      rows: [
        '..kkkkkkkkkkkk..',
        'kkkkkkkkkkkkkkkk',
        '....KKKKKKKK..t.',
        '....KKKKKKKK..t.',
        '..............tt',
      ],
    },
    { x: 0, y: 8, colors: { n: WOOD, p: '#F5F5F5', i: '#9AA0A6' }, rows: ['.n.', 'ppp', 'pii', 'ppp', 'pii'] },
  ],
  // A safari hat and a flag.
  scout: [
    {
      x: 2,
      y: 2,
      colors: { k: '#C8A96B', K: '#6B4F2A' },
      rows: ['......kkkk......', '.....kkkkkk.....', '.....KKKKKK.....', '.kkkkkkkkkkkkkk.'],
    },
    {
      x: 17,
      y: 3,
      colors: { p: WOOD, r: '#3FB68B' },
      rows: ['prr', 'prr', 'pr.', 'p..', 'p..', 'p..', 'p..', 'p..', 'p..', 'p..'],
    },
  ],
  // A wizard's hat and a book.
  researcher: [
    {
      x: 2,
      y: 0,
      colors: { w: '#7C5CC4', W: '#5B3F9E', s: '#F4C542' },
      rows: [
        '........ww......',
        '.......www......',
        '.......wwww.....',
        '......wwsww.....',
        '......wwwwww....',
        '..WWWWWWWWWWWW..',
      ],
    },
    { x: 0, y: 9, colors: { o: '#C0392B', p: '#F5F5F5' }, rows: ['ooo', 'opp', 'opp', 'ooo'] },
  ],
  // A beret and a paintbrush.
  designer: [
    {
      x: 2,
      y: 3,
      colors: { r: '#D6457A', R: '#A8325D' },
      rows: ['..........r.....', '.....rrrrrr.....', '...rrrrrrrrrrr..', '...RRRRRRRRR....'],
    },
    { x: 16, y: 4, colors: { c: '#3FB6E0', h: WOOD }, rows: ['..cc', '..cc', '.h..', '.h..', 'h...'] },
  ],
  // A flat cap and a rolled blueprint.
  architect: [
    {
      x: 2,
      y: 3,
      colors: { a: '#4F7FD9', A: '#2E5AA8' },
      rows: ['.....aaaaaa.....', '....aaaaaaaaa...', '...AAAAAAAAAAAA.'],
    },
    { x: 16, y: 6, colors: { p: '#4F7FD9', P: '#2E5AA8', w: '#F5F5F5' }, rows: ['pp', 'pp', 'PP', 'pp', 'pp'] },
  ],
  // A miner's helmet with its lamp, and a pickaxe.
  explorer: [
    {
      x: 2,
      y: 2,
      colors: { h: '#E8E8E8', H: '#B8B8B8', l: '#F4C542' },
      rows: [
        '......hhhh......',
        '.....hhllhh.....',
        '....hhhllhhh....',
        '...hhhhhhhhhh...',
        '..HHHHHHHHHHHH..',
      ],
    },
    { x: 16, y: 6, colors: { m: STEEL, h: WOOD }, rows: ['mmm', 'mhm', '.h.', '.h.', '.h.'] },
  ],
  // A judge's wig and a gavel.
  arbiter: [
    {
      x: 2,
      y: 2,
      colors: { w: '#F2F2F2', W: '#C8C8C8' },
      rows: [
        '.....wwwwww.....',
        '...wwwwwwwwww...',
        '..wWwwWwwWwwWw..',
        '.ww..........ww.',
        '.wW..........Ww.',
        '.ww..........ww.',
        '.wW..........Ww.',
      ],
    },
    { x: 16, y: 6, colors: { g: '#6B3E1F', h: WOOD }, rows: ['gggg', 'gggg', '.h..', '.h..', '.h..'] },
  ],
}

// Any other role: an antenna.
const ANTENNA: Piece[] = [
  { x: 2, y: 2, colors: { o: '#3FB6E0', a: '#3A3F4B' }, rows: ['........o.......', '........a.......', '........a.......'] },
]

// How a role's tool (its outfit's last piece) is drawn on the seconds it swings.
const SWING: Record<string, Partial<Piece>> = {
  // The hammer comes down.
  builder: { rows: ['.h.', '.h.', '.h.', '.h.', 'mmm', 'mmm'] },
  // The magnifier slides over the page.
  reviewer: { x: 15, y: 6 },
  // The clipboard fills a line.
  'spec-reviewer': { rows: ['.n.', 'ppp', 'pii', 'pii', 'ppp'] },
  // The flag waves.
  scout: { rows: ['pr.', 'prr', 'prr', 'p..', 'p..', 'p..', 'p..', 'p..', 'p..', 'p..'] },
  // The book lifts.
  researcher: { y: 8 },
  // The brush flicks.
  designer: { rows: ['cc..', 'cc..', '.h..', '.h..', '..h.'] },
  // The blueprint unrolls.
  architect: { x: 15, y: 7, rows: ['pppp', 'pwwp', 'pwpp', 'pppp'] },
  // The pickaxe comes down.
  explorer: { rows: ['.h.', '.h.', '.h.', 'mhm', 'mmm'] },
  // The gavel comes down.
  arbiter: { rows: ['.h..', '.h..', '.h..', 'gggg', 'gggg'] },
}

// The antenna's lamp lights up.
const ANTENNA_SWING: Partial<Piece> = { colors: { o: '#9BE3F5', a: '#3A3F4B' } }

// A running persona hops every second, swings its tool as it lands and blinks
// every BLINK-th second, while the floor slips by under it. A finished one
// sleeps still: eyes shut, tool put down.
const BLINK = 4
const BLINKING = eyes(['bb', 'ee'])

const FLOOR = '#808080'
// The floor's dashes: DASH wide every PERIOD, moving STEP a second.
const PERIOD = 6
const DASH = 3
const STEP = 2

/**
 * The pixels of a role's persona, row by row, each a colour or undefined.
 * `second` is the whole second of a running run: it hops, swings its tool and
 * blinks, and the floor moves. Left out, the persona stands still on the
 * bottom row.
 */
export const pixels = (role: string, status: RunStatus, second?: number) => {
  const grid: (string | undefined)[][] = Array.from({ length: HEIGHT }, () => Array<string | undefined>(WIDTH))
  const asleep = status === 'done'
  const running = status === 'running' && second !== undefined
  const landed = running && second % 2 === 0
  const hop = !running || landed ? 1 : 0
  const blink = running && second % BLINK === BLINK - 1
  const outfit = OUTFIT[role] ?? ANTENNA
  const tool = outfit.at(-1)
  const swing = OUTFIT[role] === undefined ? ANTENNA_SWING : SWING[role]
  const dressed = asleep
    ? outfit.slice(0, -1)
    : landed && tool !== undefined
      ? [...outfit.slice(0, -1), { ...tool, ...swing }]
      : outfit
  const shut = blink || asleep ? BLINKING : []
  for (const piece of [body, ...(MOOD[status] ?? []), ...shut, ...dressed]) {
    piece.rows.forEach((row, dy) => {
      ;[...row].forEach((key, dx) => {
        const color = piece.colors[key]
        const line = grid[piece.y + dy + hop]
        if (color !== undefined && line !== undefined && piece.x + dx < WIDTH) line[piece.x + dx] = color
      })
    })
  }

  // The floor is a dashed line that slips left under a running persona and a
  // solid, fainter one under any other.
  const floor = grid[HEIGHT - 1]
  for (let x = 0; x < WIDTH && floor !== undefined; x++) {
    if (!running) floor[x] = `${FLOOR}55`
    else if ((x + second * STEP) % PERIOD < DASH) floor[x] = `${FLOOR}99`
  }

  return grid
}

/** A role's persona as an SVG document, one rect per run of a colour. */
export const persona = (role: string, status: RunStatus, at: number) => {
  const rects: string[] = []
  pixels(role, status, status === 'running' ? Math.floor(at / 1000) : undefined).forEach((line, y) => {
    for (let x = 0; x < WIDTH; ) {
      const color = line[x]
      let end = x + 1
      while (end < WIDTH && line[end] === color) end++
      if (color !== undefined) rects.push(`<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${color}"/>`)
      x = end
    }
  })

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" ` +
    `width="${WIDTH * SCALE}" height="${HEIGHT * SCALE}" shape-rendering="crispEdges">${rects.join('')}</svg>`
  )
}

export const PERSONA_WIDTH = WIDTH * SCALE
export const PERSONA_HEIGHT = HEIGHT * SCALE

// Every bar is this thick, the header's and each agent's alike.
const BAR = 8
// The space above the bar, in pixels: a Box's margin is a whole row on the
// editor, so the gap is drawn inside the SVG instead.
const METER_GAP = 4

// How much of its colour a finished run's bar keeps.
const FINISHED_OPACITY = 0.8

export const METER_HEIGHT = METER_GAP + BAR

// A rounded bar filled to `share` (0 to 1), `width` across, in pixels or a percentage. It has no
// viewBox, so nothing is stretched: the widths are percentages of the drawn
// box and the corners keep their radius in pixels.
const track = (color: string, share: number, width: number | string, gap: number, thick: number, opacity = 1) => {
  const fill = (Math.max(0, Math.min(1, share)) * 100).toFixed(2)
  const bar = `y="${gap}" height="${thick}" rx="${thick / 2}"`

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${gap + thick}">` +
    `<rect ${bar} width="100%" fill="#80808033"/>` +
    `<rect ${bar} width="${fill}%" fill="${color}" fill-opacity="${opacity}"/></svg>`
  )
}

/**
 * The role's token meter, as wide as the box it is drawn in: its width is a
 * percentage, so the surface lays it out at the box's size and never stretches
 * it, which keeps the corners round. A run that has finished draws it dimmer.
 */
export const meter = (role: string, share: number, isFinished = false) =>
  track(ROLES[role]?.hex ?? OTHER_ROLE_HEX, share, '100%', METER_GAP, BAR, isFinished ? FINISHED_OPACITY : 1)

export const PROGRESS_HEIGHT = BAR

/** The milestone's ticket progress: a bar as wide as its box, in the success green. */
export const progress = (share: number) => track(DONE_HEX, share, '100%', 0, PROGRESS_HEIGHT)
