import type { Station } from '../../types'
import { millions } from '../format'
import type { Tone } from '../theme'

// Draws the workshop pane as a star chart: the core, the stations as stars around it, the
// agents as light travelling the lines between them, and a rail with what waits on the
// user, the spec's tokens, its tracks and the crew. All of it is one Svg, under 128 KB.

export type SceneAgent = {
  id: string
  name: string
  /** `main` or the subagent's role, which names its rail group. */
  role: string
  color: string
  station: Station
  from: Station
  movedAt: number
  /** How long its walk from `from` takes. */
  walkMs: number
  task: string
  /** Its ticket (`T002`) or build job (`review`), or ''. */
  job: string
  isDone: boolean
  isLead: boolean
}
export type SceneTrack = {
  repo: string
  /** `M001`, or '' once the track has landed. */
  milestone: string
  title: string
  state: string
  tone: Tone
  detail: string
  done: number
  total: number
  tickets: { status: string }[]
}
export type SceneBuild = { spec: string; tokens: number; edits: number; commits: number; alerts: string[]; tracks: SceneTrack[] }
export type SceneView = { now: number; agents: SceneAgent[]; build: SceneBuild | null }

/** What one Svg may hold. */
export const CAP = 128000
// The star chart's palette, which the rail shares.
const AMBER = '#ffb04a'
const HOT = '#ffe2b0'
const DEEP = '#ff7a1a'
const DIM = '#a8743a'
const RED = '#ff4a3d'
const GOLD = '#ffd27a'
// the cool second colour: the HUD, the links and the rings at rest, where amber is energy
const COOL = '#5ec8ff'
const ICE = '#cdeeff'
const TONE: Record<Tone, string> = { active: '#ffb04a', done: '#d9c27a', failed: '#ff4a3d', blocked: '#ff8a3d', idle: '#7a5530' }

const f1 = (n: number) => Math.round(n * 10) / 10
const esc = (s: unknown) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const cut = (s: unknown, n: number) => {
  const t = String(s)
  return n <= 1 ? '' : t.length > n ? `${t.slice(0, n - 1)}…` : t
}
const wrap = (s: string, n: number) => {
  const out: string[] = []
  let line = ''
  for (const w of s.split(' ')) {
    if (line && `${line} ${w}`.length > n) {
      out.push(line)
      line = w
    } else line = line ? `${line} ${w}` : w
  }
  if (line) out.push(line)
  return out
}
const hash = (s: string) => {
  let h = 7
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}

// ---------------------------------------------------------------- the rail
// In the star chart's own style: amber on black, small capitals spaced wide, each
// card a faint panel held by HUD brackets, light where something is at work.
const ROLE_LABEL: Record<string, string> = {
  main: 'Main session', builder: 'Builders', fixer: 'Fixers', reviewer: 'Reviewers', 'spec-reviewer': 'Spec reviewers',
  scout: 'Scouts', researcher: 'Researchers', arbiter: 'Arbiters',
}
const ROLE_ORDER = ['main', 'builder', 'fixer', 'reviewer', 'spec-reviewer', 'scout', 'researcher', 'arbiter']
const rank = (r: string) => {
  const n = ROLE_ORDER.indexOf(r)
  return n < 0 ? 99 : n
}
type Block = { s: string; h: number }

const TEXT = '#f4e6d2'

// What the drawing shows changes only when something on screen should: the editor
// reloads the picture on every change. So the gold marks the main session, which never
// changes hands; the crew shows the star each agent is at, not its latest call; and a
// track at work names who works on it, not what that agent does this second.
const isMain = (a: SceneAgent) => a.role === 'main'
const PLACE: Record<Station, string> = {
  gate: 'GATE', table: 'COUNCIL', dock: 'GIT', tests: 'TESTS', tools: 'SHELL', bay: 'FORGE',
  brain: 'MEMORY', shelves: 'ARCHIVE', computer: 'DOCS', comms: 'UPLINK', holo: 'CORE · thinking', lounge: 'STANDBY',
}
const where = (a: SceneAgent) => (a.isDone ? 'done' : `at ${PLACE[a.station]}`)
const steady = (t: SceneTrack) => (t.tone === 'active' ? (t.detail.split(' · ')[0] ?? '') : t.detail)
const MUTED = '#8a6438'
const FAINT = '#5c4024'

// A section's name, a rule after it, and a tick closing the rule.
const label = (x: number, y: number, w: number, t: string) => {
  const tw = t.length * 7.4
  return (
    `<text x="${x}" y="${y + 9}" font-size="9.5" font-weight="700" letter-spacing="2.2" fill="${DIM}">${esc(t)}</text>` +
    `<rect x="${f1(x + tw + 8)}" y="${y + 5}" width="${f1(Math.max(0, w - tw - 14))}" height="1" fill="${COOL}" opacity=".3"/>` +
    `<rect x="${x + w - 4}" y="${y + 3.5}" width="4" height="4" fill="${COOL}" opacity=".8"/>`
  )
}

// A faint amber panel with a bracket at each corner.
function panel(x: number, y: number, w: number, h: number, col = COOL, strong = false): string {
  const k = Math.min(7, h / 3)
  const o = strong ? 0.95 : 0.55
  return (
    `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" fill="${col}" fill-opacity="${strong ? 0.08 : 0.035}" stroke="${col}" stroke-opacity="${strong ? 0.3 : 0.13}"/>` +
    `<path d="M${f1(x)} ${f1(y + k)}V${f1(y)}H${f1(x + k)}M${f1(x + w - k)} ${f1(y)}H${f1(x + w)}V${f1(y + k)}M${f1(x + w)} ${f1(y + h - k)}V${f1(y + h)}H${f1(x + w - k)}M${f1(x + k)} ${f1(y + h)}H${f1(x)}V${f1(y + h - k)}" fill="none" stroke="${col}" stroke-opacity="${o}" stroke-width="1.2"/>`
  )
}

// A state as a tag: spaced capitals in a thin frame, its tone's colour.
function tag(x: number, y: number, h: number, text: string, col: string, beat = false): { s: string; w: number } {
  const w = text.length * 6.4 + 12
  return {
    s: `<g${beat ? ' class="beat"' : ''}><rect x="${f1(x - w)}" y="${f1(y)}" width="${f1(w)}" height="${h}" fill="${col}" fill-opacity=".08" stroke="${col}" stroke-opacity=".7"/><text x="${f1(x - w / 2)}" y="${f1(y + h - 3.6)}" text-anchor="middle" font-size="8.5" font-weight="700" letter-spacing="1.4" fill="${col}">${esc(text)}</text></g>`,
    w,
  }
}

function alertsBlock(alerts: string[], x: number, y: number, w: number, fs: number): Block {
  let s = `<text x="${x}" y="${y + 9}" font-size="9.5" font-weight="700" letter-spacing="2.2" fill="${RED}" class="alarm">WAITS ON YOU · ${alerts.length}</text>`
  let cy = y + 16
  const n = Math.max(12, Math.floor((w - 38) / (fs * 0.56)))
  for (const raw of alerts) {
    const lines = wrap(raw.replace(/^[⚠️\s]+/u, ''), n)
    const h = 12 + lines.length * (fs + 3.5)
    s += `<g class="alarm">${panel(x, cy, w, h, RED, true)}</g>`
    s += `<path d="M${x + 15} ${f1(cy + h / 2 - 7)}l8 14h-16z" fill="none" stroke="${RED}" stroke-width="1.3" stroke-linejoin="round"/><rect x="${x + 14.3}" y="${f1(cy + h / 2 - 2.5)}" width="1.4" height="4.5" fill="${RED}"/><rect x="${x + 14.3}" y="${f1(cy + h / 2 + 3)}" width="1.4" height="1.6" fill="${RED}"/>`
    lines.forEach((l, q) => {
      s += `<text x="${x + 30}" y="${f1(cy + 6 + fs + q * (fs + 3.5))}" font-size="${fs}" font-weight="600" fill="#ffd9d0">${esc(l)}</text>`
    })
    cy += h + 5
  }
  return { s, h: cy - y - 5 }
}

function headerBlock(b: SceneBuild | null, x: number, y: number, w: number, tall: boolean): Block {
  const h = tall ? 44 : 30
  let s = panel(x, y, w, h)
  if (b === null) {
    s += `<text x="${x + 11}" y="${y + (tall ? 19 : 19)}" font-size="12.5" font-weight="700" letter-spacing="1.6" fill="${DIM}">NO BUILD RUNNING</text>`
    if (tall) s += `<text x="${x + 11}" y="${y + 34}" font-size="10.5" fill="${MUTED}">The core is quiet</text>`
    return { s, h }
  }
  s += `<text x="${x + 11}" y="${y + (tall ? 19 : 19)}" font-size="13" font-weight="700" letter-spacing=".4" fill="${HOT}">${esc(cut(b.spec, Math.floor((w - 120) / 7)))}</text>`
  s += `<text x="${x + w - 11}" y="${y + (tall ? 22 : 20)}" text-anchor="end" font-size="${tall ? 17 : 14}" font-weight="700" fill="${HOT}" filter="url(#glow)">${millions(b.tokens)}<tspan font-size="${tall ? 11 : 10}" fill="${AMBER}"> TOK</tspan></text>`
  if (tall) {
    s += `<text x="${x + 11}" y="${y + 35}" font-size="10.5" fill="${MUTED}">${b.commits} commits · ${b.tracks.length} track${b.tracks.length === 1 ? '' : 's'}</text>`
    s += `<text x="${x + w - 11}" y="${y + 36}" text-anchor="end" font-size="8" letter-spacing="2" fill="${FAINT}">TOKENS</text>`
  }
  return { s, h }
}

const TICKET: Record<string, string> = { done: AMBER, doing: HOT, blocked: '#ff8a3d', todo: '#2a1a0c' }

function trackCard(t: SceneTrack, x: number, y: number, w: number, tall: boolean): Block {
  const tone = TONE[t.tone]
  const has = t.total > 0
  const h = tall ? (has ? 54 : 38) : has ? 32 : 22
  const on = t.tone === 'active'
  let s = on ? panel(x, y, w, h, AMBER, true) : panel(x, y, w, h)
  // the track's light, glowing while it works
  s += `<circle cx="${x + 10}" cy="${y + (tall ? 13 : 11)}" r="3" fill="${tone}"${on ? ' filter="url(#glow)" class="beat"' : ''}/>`
  const pill = tag(x + w - 7, y + (tall ? 6 : 4.5), tall ? 15 : 13, t.state.toUpperCase(), tone, on)
  s += pill.s
  const repoW = Math.min(t.repo.length, 18) * (tall ? 7.4 : 6.6)
  s += `<text x="${x + 19}" y="${y + (tall ? 17.5 : 14.5)}" font-size="${tall ? 12.5 : 11}" font-weight="700" letter-spacing=".4" fill="${on ? HOT : TEXT}">${esc(cut(t.repo, 18))}</text>`
  const room = w - 19 - repoW - pill.w - 18
  if (tall) {
    s += `<text x="${f1(x + 19 + repoW + 6)}" y="${y + 17.5}" font-size="10" font-weight="700" letter-spacing="1" fill="${DIM}">${esc(cut(t.milestone, Math.max(0, Math.floor(room / 6.5))))}</text>`
    const detail = steady(t)
    const sub = t.title && detail ? `${t.title} · ${detail}` : t.title || detail
    s += `<text x="${x + 19}" y="${y + 31}" font-size="10" fill="${MUTED}">${esc(cut(sub, Math.floor((w - 28) / 5.3)))}</text>`
  } else {
    const more = [t.milestone, has ? '' : steady(t)].filter(Boolean).join(' · ')
    s += `<text x="${f1(x + 19 + repoW + 5)}" y="${y + 14.5}" font-size="9.5" letter-spacing=".6" fill="${DIM}">${esc(cut(more, Math.max(0, Math.floor(room / 5.4))))}</text>`
  }
  if (has) {
    const by = y + (tall ? 41 : 21)
    const bh = tall ? 4 : 3.5
    const bx = x + 11
    const bw = w - 11 - 11 - 32
    const n = t.tickets.length || t.total
    const seg = Math.max(3, (bw - (n - 1) * 3) / n)
    for (let q = 0; q < n; q++) {
      const st = t.tickets[q]?.status ?? (q < t.done ? 'done' : 'todo')
      const col = TICKET[st] ?? TICKET.todo
      const lit = st === 'done' || st === 'doing'
      s += `<rect x="${f1(bx + q * (seg + 3))}" y="${by}" width="${f1(seg)}" height="${bh}" fill="${col}"${st === 'todo' ? ` stroke="${COOL}" stroke-opacity=".3" stroke-width=".6"` : ''}${lit ? ' filter="url(#glow)"' : ''}${st === 'doing' ? ' class="beat"' : ''}/>`
    }
    s += `<text x="${x + w - 9}" y="${by + bh + 1.5}" text-anchor="end" font-size="10.5" font-weight="700" letter-spacing=".6" fill="${t.done >= t.total ? HOT : TEXT}">${t.done}/${t.total}</text>`
  }
  return { s, h }
}

function tracksBlock(tracks: SceneTrack[], x: number, y: number, w: number, tall: boolean): Block {
  let s = label(x, y, w, `TRACKS · ${tracks.length}`)
  const gap = tall ? 6 : 4
  let cy = y + 17
  for (const t of tracks) {
    const c = trackCard(t, x, cy, w, tall)
    s += c.s
    cy += c.h + gap
  }
  return { s, h: cy - y - gap }
}

function crewRow(a: SceneAgent, x: number, y: number, w: number, tall: boolean): Block {
  const h = tall ? 32 : 16
  const nameW = a.name.length * (tall ? 7.2 : 6.4)
  let s = `<g${a.isDone ? ' opacity=".45"' : ''}>`
  if (isMain(a)) s += panel(x, y, w, h, GOLD, true)
  if (tall) {
    s += `<circle cx="${x + 11}" cy="${y + 11}" r="3.2" fill="${a.color}"${a.isDone ? '' : ' filter="url(#glow)"'}/>`
    s += `<text x="${x + 21}" y="${y + 14.5}" font-size="12" font-weight="700" letter-spacing=".3" fill="${isMain(a) ? GOLD : TEXT}">${esc(a.name)}</text>`
    if (a.job) s += `<text x="${f1(x + 21 + nameW + 6)}" y="${y + 14.5}" font-size="9.5" font-weight="700" letter-spacing="1" fill="${a.color}">${esc(a.job.toUpperCase())}</text>`
    if (a.isDone) s += tag(x + w - 6, y + 5, 13, 'DONE', MUTED).s
    s += `<text x="${x + 21}" y="${y + 27}" font-size="10.5" fill="${MUTED}">${esc(where(a))}</text>`
  } else {
    s += `<circle cx="${x + 8}" cy="${y + 8}" r="2.6" fill="${a.color}"/>`
    s += `<text x="${x + 16}" y="${y + 11.5}" font-size="10.5" font-weight="700" fill="${isMain(a) ? GOLD : TEXT}">${esc(a.name)}</text>`
    let x0 = x + 16 + nameW + 5
    if (a.job) {
      s += `<text x="${f1(x0)}" y="${y + 11.5}" font-size="9" font-weight="700" letter-spacing=".8" fill="${a.color}">${esc(a.job.toUpperCase())}</text>`
      x0 += a.job.length * 6.2 + 5
    }
    s += `<text x="${f1(x0)}" y="${y + 11.5}" font-size="10" fill="${MUTED}">${esc(where(a))}</text>`
  }
  return { s: `${s}</g>`, h }
}

function crewBlock(agents: SceneAgent[], x: number, y: number, w: number, tall: boolean): Block {
  const working = agents.filter(a => !a.isDone)
  const done = agents.filter(a => a.isDone)
  let s = label(x, y, w, `CREW · ${working.length}`)
  let cy = y + 18
  const groups: Record<string, SceneAgent[]> = {}
  for (const a of working) (groups[a.role] ??= []).push(a)
  for (const r of Object.keys(groups).sort((p, q) => rank(p) - rank(q))) {
    const list = groups[r] ?? []
    const col = list[0]?.color ?? DIM
    s += `<path d="M${x + 5} ${cy + 3.5}l3.5 3.5l-3.5 3.5l-3.5 -3.5z" fill="${col}"/><text x="${x + 14}" y="${cy + 10.5}" font-size="9" font-weight="700" letter-spacing="1.8" fill="${DIM}">${esc((ROLE_LABEL[r] ?? `${r}s`).toUpperCase())}</text><text x="${x + w}" y="${cy + 10.5}" text-anchor="end" font-size="9.5" font-weight="700" fill="${FAINT}">${list.length}</text>`
    cy += 17
    for (const a of list) {
      const row = crewRow(a, x, cy, w, tall)
      s += row.s
      cy += row.h + (tall ? 4 : 1)
    }
    cy += 4
  }
  // the finished ones, drifting: one line of their names
  if (done.length > 0) {
    const names = done.map(a => a.name).join(' · ')
    s += `<path d="M${x + 5} ${cy + 3.5}l3.5 3.5l-3.5 3.5l-3.5 -3.5z" fill="none" stroke="${DIM}"/><text x="${x + 14}" y="${cy + 10.5}" font-size="9" font-weight="700" letter-spacing="1.8" fill="${FAINT}">DRIFTING</text><text x="${x + w}" y="${cy + 10.5}" text-anchor="end" font-size="9.5" font-weight="700" fill="${FAINT}">${done.length}</text>`
    cy += 15
    s += `<text x="${x + 14}" y="${cy + 9}" font-size="10" fill="${FAINT}">${esc(cut(names, Math.floor((w - 16) / 5.3)))}</text>`
    cy += 18
  }
  return { s, h: cy - y - 4 }
}

// One column (the wide rail) or two (the dock's bottom panel, the inline rail): alerts and the header span both.
function railContent(view: SceneView, W: number, cols: number, tall: boolean): Block {
  const b = view.build
  const pad = 14
  const iw = W - pad * 2
  let s = ''
  let y = 14
  if (b !== null && b.alerts.length > 0) {
    const a = alertsBlock(b.alerts, pad, y, iw, tall ? 11 : 10.5)
    s += a.s
    y += a.h + 12
  } else if (b !== null) {
    s += `<circle cx="${pad + 4}" cy="${y + 6.5}" r="3" fill="${AMBER}" opacity=".7" class="beat"/><text x="${pad + 14}" y="${y + 10}" font-size="9.5" font-weight="700" letter-spacing="2" fill="${DIM}">NOTHING WAITS ON YOU</text>`
    y += 22
  }
  const hd = headerBlock(b, pad, y, iw, tall)
  s += hd.s
  y += hd.h + 14
  const tracks = b?.tracks ?? []
  if (cols === 1) {
    if (tracks.length > 0) {
      const t = tracksBlock(tracks, pad, y, iw, tall)
      s += t.s
      y += t.h + 16
    }
    const c = crewBlock(view.agents, pad, y, iw, tall)
    s += c.s
    y += c.h
  } else if (tracks.length > 0) {
    const gap = 16
    const cw = (iw - gap) / 2
    const t = tracksBlock(tracks, pad, y, cw, false)
    const c = crewBlock(view.agents, pad + cw + gap, y, cw, false)
    s += t.s + c.s
    y += Math.max(t.h, c.h)
  } else {
    const c = crewBlock(view.agents, pad, y, iw, false)
    s += c.s
    y += c.h
  }
  return { s, h: y + 14 }
}

// ---------------------------------------------------------------- the constellation
// The session as a star chart: the core at the centre, where agents think; the standby
// orbit around it, where the main session waits between turns; and every other station
// a star on a tilted ring, linked to the core and to its neighbours. Stars at the front
// of the ring draw larger and brighter. An agent is light: a comet along the line it
// travels, then an arc orbiting the star it works at, the star's spoke lit in its colour.

type Star = { st: Station; deg: number; r: number; label: string; sub: string }
const STARS: Star[] = [
  { st: 'comms', deg: -90, r: 1, label: 'UPLINK', sub: 'web · mcp' },
  { st: 'tools', deg: -50, r: 0.86, label: 'SHELL', sub: 'commands' },
  { st: 'bay', deg: -10, r: 1, label: 'FORGE', sub: 'code edits' },
  { st: 'tests', deg: 30, r: 0.86, label: 'TESTS', sub: 'test runs' },
  { st: 'dock', deg: 70, r: 1, label: 'GIT', sub: 'git · gh · land' },
  { st: 'table', deg: 110, r: 1, label: 'COUNCIL', sub: 'review · decide' },
  { st: 'computer', deg: 150, r: 0.86, label: 'DOCS', sub: 'documents' },
  { st: 'shelves', deg: 190, r: 1, label: 'ARCHIVE', sub: 'reading code' },
  { st: 'brain', deg: 230, r: 0.86, label: 'MEMORY', sub: '.brain · sdd' },
]


// A fixed seed: every redraw scatters the stars the same way.
function seeded(seed: number) {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

// A redraw restarts the picture's clock: each loop begins where the session's clock has it, so it never jumps.
const phase = (now: number, dur: number) => `-${((now / 1000) % dur).toFixed(2)}s`
const spin = (cx: number, cy: number, dur: number, now: number, back = false) =>
  `<animateTransform attributeName="transform" type="rotate" from="${back ? 360 : 0} ${f1(cx)} ${f1(cy)}" to="${back ? 0 : 360} ${f1(cx)} ${f1(cy)}" dur="${dur}s" begin="${phase(now, dur)}" repeatCount="indefinite"/>`
const EASE = 'calcMode="spline" keyTimes="0;1" keySplines=".45 0 .55 1"'

type Sky = {
  cx: number
  cy: number
  rx: number
  ry: number
  /** The core's radius: its rings, the thinking orbit and the standby orbit scale with it. */
  rc: number
  /** A narrow sky labels every star above or below it, kept inside x0..x1. */
  narrow: boolean
  x0: number
  x1: number
}
type Placed = { x: number; y: number; depth: number; s: number; star?: Star }

function skyOf(sc: Box): Sky {
  const cx = sc.x + sc.w / 2
  const cy = sc.y + sc.h / 2 + (sc.w < 560 ? 4 : 6)
  // A narrow sky puts the labels over and under the stars, so the ring takes nearly the
  // whole width and stands rounder; a wide one leaves room for labels at the sides.
  const narrow = sc.w < 560
  let rx = Math.max(70, sc.w / 2 - (narrow ? 46 : 84))
  const ry = Math.max(56, Math.min(sc.h / 2 - (narrow ? 72 : 48), rx * (narrow ? 0.95 : 0.74)))
  rx = Math.min(rx, ry * 1.9)
  return { cx, cy, rx, ry, rc: Math.max(16, Math.min(rx, ry) * 0.3), narrow, x0: sc.x + 6, x1: sc.x + sc.w - 6 }
}

/** Where a station sits: a star of the ring, or the core for thinking and standby. */
function placeOf(sky: Sky, st: Station): Placed {
  const star = STARS.find(s => s.st === st)
  if (star === undefined) return { x: sky.cx, y: sky.cy, depth: 1, s: 1 }
  const a = (star.deg * Math.PI) / 180
  const depth = (Math.sin(a) + 1) / 2
  return { x: sky.cx + sky.rx * star.r * Math.cos(a), y: sky.cy + sky.ry * star.r * Math.sin(a), depth, s: 0.78 + 0.42 * depth, star }
}

// The line an agent travels: straight to or from the core, else a curve drawn in toward it.
function routeOf(sky: Sky, from: Station, to: Station): string | null {
  if (from === to) return null
  const a = placeOf(sky, from)
  const b = placeOf(sky, to)
  const rim = (p: Placed, st: Station): [number, number] => (st === 'lounge' ? [sky.cx, sky.cy + sky.rc * 1.55] : [p.x, p.y])
  const [ax, ay] = rim(a, from)
  const [bx, by] = rim(b, to)
  if (a.star === undefined || b.star === undefined) return `M${f1(ax)} ${f1(ay)}L${f1(bx)} ${f1(by)}`
  const qx = sky.cx + ((ax + bx) / 2 - sky.cx) * 0.22
  const qy = sky.cy + ((ay + by) / 2 - sky.cy) * 0.22
  return `M${f1(ax)} ${f1(ay)}Q${f1(qx)} ${f1(qy)} ${f1(bx)} ${f1(by)}`
}

const SKY_DEFS =
  `<radialGradient id="cg"><stop offset="0" stop-color="#fffaf0"/><stop offset=".14" stop-color="${HOT}"/><stop offset=".38" stop-color="${AMBER}" stop-opacity=".6"/><stop offset=".72" stop-color="${DEEP}" stop-opacity=".12"/><stop offset="1" stop-color="${DEEP}" stop-opacity="0"/></radialGradient>` +
  `<radialGradient id="aura"><stop offset="0" stop-color="${AMBER}" stop-opacity=".32"/><stop offset=".5" stop-color="${DEEP}" stop-opacity=".08"/><stop offset="1" stop-color="${DEEP}" stop-opacity="0"/></radialGradient>` +
  `<radialGradient id="nh"><stop offset="0" stop-color="${HOT}" stop-opacity=".95"/><stop offset=".28" stop-color="${AMBER}" stop-opacity=".4"/><stop offset="1" stop-color="${DEEP}" stop-opacity="0"/></radialGradient>` +
  `<radialGradient id="redaura"><stop offset="0" stop-color="${RED}" stop-opacity=".4"/><stop offset="1" stop-color="${RED}" stop-opacity="0"/></radialGradient>` +
  '<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4"/></filter>' +
  '<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'

const SKY_STYLE =
  "text{font-family:Rajdhani,Orbitron,'Segoe UI',system-ui,sans-serif}" +
  '.t1{animation:tw 3.1s ease-in-out infinite}.t2{animation:tw 4.7s ease-in-out infinite 1.3s}.t3{animation:tw 2.3s ease-in-out infinite .7s}' +
  '@keyframes tw{0%,100%{opacity:1}50%{opacity:.2}}' +
  '.flow{animation:fw .9s linear infinite}@keyframes fw{to{stroke-dashoffset:-24}}' +
  '.beat{animation:bt 2.4s ease-in-out infinite}@keyframes bt{0%,100%{opacity:.75}50%{opacity:1}}' +
  '.alarm{animation:al 1.1s ease-in-out infinite}@keyframes al{0%,100%{opacity:1}50%{opacity:.2}}'

// Far, middle and near dust, each layer turning about the core at its own pace.
function dust(sc: Box, sky: Sky, now: number, lite: boolean): string {
  const rnd = seeded(7)
  const reach = Math.hypot(sc.w, sc.h) / 2
  const layers = [
    { n: lite ? 40 : 90, r: 0.5, o: 0.35, dur: 900 },
    { n: lite ? 20 : 50, r: 0.8, o: 0.55, dur: 600 },
    { n: lite ? 8 : 18, r: 1.25, o: 0.8, dur: 380 },
  ]
  let s = ''
  for (const [n, L] of layers.entries()) {
    s += `<g fill="${n === 1 ? HOT : ICE}">${spin(sky.cx, sky.cy, L.dur, now)}`
    for (let i = 0; i < L.n; i++) {
      const a = rnd() * Math.PI * 2
      const d = Math.sqrt(rnd()) * reach
      const tw = rnd()
      s += `<circle cx="${f1(sky.cx + Math.cos(a) * d)}" cy="${f1(sky.cy + Math.sin(a) * d)}" r="${L.r}" opacity="${f1(L.o * (0.4 + rnd() * 0.6))}"${tw < 0.3 ? ` class="t${1 + Math.floor(tw * 10)}"` : ''}/>`
    }
    s += '</g>'
  }
  return s
}

// The core: an aura, a dark disc, swirling orbits around a white-hot heart, and turning rings of ticks and arcs.
function core(sky: Sky, now: number, busy: number, hot: boolean, lite: boolean): string {
  const { cx, cy, rc } = sky
  const c = (r: number, attrs: string) => `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r)}" ${attrs}/>`
  let s = c(rc * 3.2, 'fill="url(#aura)"')
  if (hot) s += `<g class="alarm">${c(rc * 2.6, 'fill="url(#redaura)"')}</g>`
  s += c(rc * 1.3, `fill="#140a03" fill-opacity=".55" stroke="${DEEP}" stroke-opacity=".18"`)
  // the standby orbit, where the main session waits
  s += c(rc * 1.55, `fill="none" stroke="${COOL}" stroke-opacity=".4" stroke-width=".7" stroke-dasharray="1 5"`)
  // ticks and arcs
  s += `<g>${spin(cx, cy, 60, now, true)}${c(rc * 1.02, `fill="none" stroke="${COOL}" stroke-opacity=".45" stroke-width="3.5" stroke-dasharray=".7 4.3"`)}</g>`
  s += `<g>${spin(cx, cy, 24, now)}${c(rc * 1.15, `fill="none" stroke="${AMBER}" stroke-opacity=".75" stroke-width="1.6" pathLength="100" stroke-dasharray="18 6 7 12 30 27" stroke-linecap="round" filter="url(#glow)"`)}</g>`
  s += `<g>${spin(cx, cy, 40, now)}${c(rc * 0.84, `fill="none" stroke="${ICE}" stroke-opacity=".35" stroke-width=".8" stroke-dasharray="2 5"`)}</g>`
  // sparks about the heart
  if (!lite) {
    const rnd = seeded(11)
    s += `<g fill="${HOT}">${spin(cx, cy, 70, now)}`
    for (let i = 0; i < 64; i++) {
      const a = rnd() * Math.PI * 2
      const d = rc * (0.55 + rnd() * 0.85)
      const tw = rnd()
      s += `<rect x="${f1(cx + Math.cos(a) * d)}" y="${f1(cy + Math.sin(a) * d)}" width="${f1(0.8 + rnd() * 2.6)}" height="${f1(0.6 + rnd() * 0.8)}" opacity="${f1(0.3 + rnd() * 0.7)}" transform="rotate(${Math.round((a * 180) / Math.PI)} ${f1(cx + Math.cos(a) * d)} ${f1(cy + Math.sin(a) * d)})"${tw < 0.45 ? ` class="t${1 + Math.floor(tw * 6.6)}"` : ''}/>`
    }
    s += '</g>'
  }
  // the heart: swirling orbits, faster while agents think
  const fast = busy > 0 ? 6 : 14
  const swirl = (n: number, dur: number, back: boolean, o: number) => {
    let g = `<g fill="none" stroke="${HOT}" stroke-opacity="${o}" stroke-width=".9" filter="url(#glow)">${spin(cx, cy, dur, now, back)}`
    for (let i = 0; i < n; i++) g += `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(rc * (0.52 - i * 0.04))}" ry="${f1(rc * (0.14 + i * 0.05))}" transform="rotate(${i * (180 / n) + 15} ${f1(cx)} ${f1(cy)})"/>`
    return `${g}</g>`
  }
  s += swirl(4, fast, false, 0.55) + swirl(3, fast * 1.7, true, 0.35)
  s += `<g class="beat">${c(rc * 0.62, 'fill="url(#cg)"')}</g>`
  s += c(rc * 0.09, 'fill="#fffaf0"')
  return s
}

// The ring's links: a spoke from the core to each star, the ring from star to star, and a few chords.
function links(sky: Sky): string {
  const pts = STARS.map(st => placeOf(sky, st.st))
  let s = `<g fill="none" stroke="${COOL}" stroke-width=".6">`
  for (const p of pts) {
    const a = Math.atan2(p.y - sky.cy, p.x - sky.cx)
    s += `<line x1="${f1(sky.cx + Math.cos(a) * sky.rc * 1.3)}" y1="${f1(sky.cy + Math.sin(a) * sky.rc * 1.3)}" x2="${f1(p.x)}" y2="${f1(p.y)}" stroke-opacity="${f1(0.08 + 0.1 * p.depth)}"/>`
  }
  s += `<path d="${pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${f1(p.x)} ${f1(p.y)}`).join('')}Z" stroke-opacity=".2" stroke-dasharray="3 3"/>`
  for (const [i, j] of [[0, 3], [2, 5], [4, 7], [6, 0], [8, 2]] as const) {
    const a = pts[i]
    const b = pts[j]
    if (a !== undefined && b !== undefined) s += `<line x1="${f1(a.x)}" y1="${f1(a.y)}" x2="${f1(b.x)}" y2="${f1(b.y)}" stroke-opacity=".07"/>`
  }
  return `${s}</g>`
}

type Lit = { a: SceneAgent; k: number }

// A star: a halo, a hot point with a flare, a ring of ticks, a few satellites linked to it, its name and who works there.
function star(sky: Sky, st: Star, here: Lit[], now: number, fs: number): string {
  const p = placeOf(sky, st.st)
  const live = here.filter(l => !l.a.isDone)
  const on = live.length > 0
  const z = p.s
  const rnd = seeded(st.deg + 400)
  let s = `<g opacity="${f1(0.62 + 0.38 * p.depth)}">`
  s += `<circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="${f1((on ? 30 : 20) * z)}" fill="url(#nh)" opacity="${on ? 1 : 0.4}"${on ? ' class="beat"' : ''}/>`
  // satellites, linked like a constellation
  const sats: [number, number][] = []
  for (let i = 0; i < 4; i++) {
    const a = rnd() * Math.PI * 2
    const d = (16 + rnd() * 18) * z
    sats.push([p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * 0.8])
  }
  s += `<path d="M${f1(p.x)} ${f1(p.y)}${sats.map(q => `L${f1(q[0])} ${f1(q[1])}`).join('')}" fill="none" stroke="${on ? AMBER : COOL}" stroke-width=".5" stroke-opacity="${on ? 0.5 : 0.28}"/>`
  for (const [i, q] of sats.entries()) s += `<circle cx="${f1(q[0])}" cy="${f1(q[1])}" r="${f1((0.7 + (i % 2) * 0.5) * z)}" fill="${HOT}" opacity="${on ? 0.9 : 0.5}"${i === 1 ? ' class="t2"' : ''}/>`
  // the ring of ticks turns while someone works there
  s += `<g>${on ? spin(p.x, p.y, 9, now) : ''}<circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="${f1(11 * z)}" fill="none" stroke="${on ? AMBER : COOL}" stroke-opacity="${on ? 0.7 : 0.4}" stroke-width="${f1(1.6 * z)}" stroke-dasharray="1 2.6"/></g>`
  const fl = (on ? 13 : 7) * z
  s += `<path d="M${f1(p.x - fl)} ${f1(p.y)}h${f1(fl * 2)}M${f1(p.x)} ${f1(p.y - fl)}v${f1(fl * 2)}" stroke="${HOT}" stroke-width=".6" stroke-opacity=".75"/>`
  s += `<circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="${f1((on ? 2.8 : 2) * z)}" fill="#fffaf0" filter="url(#glow)"/>`
  // the label, outward from the core
  const a = (st.deg * Math.PI) / 180
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  const anchor = sky.narrow ? 'middle' : cos > 0.35 ? 'start' : cos < -0.35 ? 'end' : 'middle'
  let lx = sky.narrow ? p.x : p.x + cos * 22 * z
  const below = sky.narrow ? sin >= 0 : sin > 0.35
  const above = sky.narrow ? sin < 0 : sin < -0.35
  if (anchor === 'middle') {
    // a centred label stays inside the sky
    const longest = Math.max(st.label.length * fs * 0.9, ...here.slice(0, 3).map(l => (l.a.name.length + l.a.job.length + 3) * fs * 0.55))
    lx = Math.min(Math.max(lx, sky.x0 + longest / 2), sky.x1 - longest / 2)
  }
  const lines = 2 + Math.min(here.length, 3) + (here.length > 3 ? 1 : 0)
  const lh = fs * 1.25
  let ly = above ? p.y - 22 * z - (lines - 1) * lh : below ? p.y + 22 * z + fs : p.y - fs * 0.2
  s += `<text x="${f1(lx)}" y="${f1(ly)}" text-anchor="${anchor}" font-size="${f1(fs * 1.05)}" font-weight="700" letter-spacing="${f1(fs * 0.22)}" fill="${on ? HOT : DIM}">${st.label}</text>`
  ly += lh * 0.9
  s += `<text x="${f1(lx)}" y="${f1(ly)}" text-anchor="${anchor}" font-size="${f1(fs * 0.9)}" font-weight="600" letter-spacing="${f1(fs * 0.1)}" fill="${on ? ICE : '#8fb4cc'}" opacity="${on ? 1 : 0.9}">${esc(st.sub)}</text>`
  for (const l of here.slice(0, 3)) {
    ly += lh
    s += `<text x="${f1(lx)}" y="${f1(ly)}" text-anchor="${anchor}" font-size="${f1(fs * 0.92)}" font-weight="600" opacity="${l.a.isDone ? 0.5 : 1}"><tspan fill="${l.a.color}">●</tspan><tspan fill="${isMain(l.a) ? GOLD : '#f4e6d2'}"> ${esc(l.a.name)}</tspan>${l.a.job ? `<tspan fill="${l.a.color}"> ${esc(l.a.job)}</tspan>` : ''}</text>`
  }
  if (here.length > 3) {
    ly += lh
    s += `<text x="${f1(lx)}" y="${f1(ly)}" text-anchor="${anchor}" font-size="${f1(fs * 0.85)}" fill="${DIM}">+${here.length - 3} more</text>`
  }
  return `${s}</g>`
}

// An agent at rest: an arc of light orbiting its star or the core, a white head at its leading end.
function orbit(a: SceneAgent, x: number, y: number, r: number, dur: number, now: number, back: boolean): string {
  const col = a.isDone ? '#8a8f98' : a.color
  const h = hash(a.id)
  const start = h % 360

  const fade = a.isDone ? '<animate attributeName="opacity" values="1;.15;1" dur="3.2s" repeatCount="indefinite"/>' : ''
  let s = `<g transform="rotate(${start} ${f1(x)} ${f1(y)})"><g>${spin(x, y, dur, now + h, back)}${fade}`
  s += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="none" stroke="${col}" stroke-width="3.2" stroke-opacity=".35" pathLength="100" stroke-dasharray="22 78" filter="url(#soft)"/>`
  s += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="none" stroke="${col}" stroke-width="1.6" pathLength="100" stroke-dasharray="22 78" stroke-linecap="round"/>`
  const hx = x + Math.cos(((back ? 0 : 79) * Math.PI) / 180) * r
  const hy = y + Math.sin(((back ? 0 : 79) * Math.PI) / 180) * r
  s += `<circle cx="${f1(hx)}" cy="${f1(hy)}" r="${isMain(a) ? 2.8 : 2.2}" fill="${isMain(a) ? GOLD : '#fffaf0'}" filter="url(#glow)"/>`

  return `${s}</g></g>`
}

// While an agent works at a star, its spoke carries light from the core out to it.
function spoke(sky: Sky, a: SceneAgent): string {
  const p = placeOf(sky, a.station)
  if (p.star === undefined || a.isDone) return ''
  const ang = Math.atan2(p.y - sky.cy, p.x - sky.cx)
  const x1 = sky.cx + Math.cos(ang) * sky.rc * 1.3
  const y1 = sky.cy + Math.sin(ang) * sky.rc * 1.3
  const ln = `x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(p.x)}" y2="${f1(p.y)}"`
  return `<line ${ln} stroke="${a.color}" stroke-width="3" stroke-opacity=".25" filter="url(#soft)"/><line ${ln} stroke="${a.color}" stroke-width="1.1" stroke-opacity=".9" stroke-dasharray="4 8" class="flow"/>`
}

// A walk: the route lit faintly, a comet running along it, and the agent's orbit once it arrives.
function travel(sky: Sky, a: SceneAgent, rest: string, now: number): string {
  const el = (now - a.movedAt) / 1000
  const dur = a.walkMs / 1000
  const d = routeOf(sky, a.from, a.station)
  if (d === null || el < 0 || el >= dur) return rest
  const begin = `begin="-${el.toFixed(2)}s" dur="${dur}s"`
  const left = (dur - el).toFixed(2)
  const col = a.color
  let s = `<g><path d="${d}" fill="none" stroke="${col}" stroke-width=".8" stroke-opacity=".3"/>`
  s += `<path d="${d}" fill="none" stroke="${col}" stroke-width="5" stroke-opacity=".5" filter="url(#soft)" pathLength="1" stroke-dasharray=".22 3" stroke-dashoffset=".22" stroke-linecap="round"><animate attributeName="stroke-dashoffset" values=".22;-1" ${EASE} ${begin} fill="freeze"/></path>`
  s += `<path d="${d}" fill="none" stroke="${HOT}" stroke-width="1.5" pathLength="1" stroke-dasharray=".16 3" stroke-dashoffset=".16" stroke-linecap="round"><animate attributeName="stroke-dashoffset" values=".16;-1" ${EASE} ${begin} fill="freeze"/></path>`
  s += `<circle r="3.2" fill="#fffaf0" filter="url(#glow)"><animateMotion path="${d}" keyPoints="0;1" ${EASE} ${begin} fill="freeze"/></circle>`
  s += `<set attributeName="visibility" to="hidden" begin="${left}s"/></g>`
  return `${s}<g visibility="hidden">${rest}<set attributeName="visibility" to="visible" begin="${left}s"/></g>`
}

function hud(sc: Box, live: number, hot: boolean, fs: number): string {
  const { x, y, w, h } = sc
  const c = hot ? RED : COOL
  const k = 16
  const m = 8
  let s = `<g fill="none" stroke="${c}" stroke-opacity=".55" stroke-width="1.2"${hot ? ' class="alarm"' : ''}>`
  s += `<path d="M${x + m} ${y + m + k}V${y + m}H${x + m + k}M${x + w - m - k} ${y + m}H${x + w - m}V${y + m + k}M${x + w - m} ${y + h - m - k}V${y + h - m}H${x + w - m - k}M${x + m + k} ${y + h - m}H${x + m}V${y + h - m - k}"/></g>`
  s += `<rect x="${x + m + 24}" y="${y + m + 3}" width="${f1(Math.min(160, w * 0.3))}" height="2" fill="${c}" opacity=".35"/>`
  s += `<text x="${x + m + 24}" y="${f1(y + m + 6 + fs * 1.3)}" font-size="${f1(fs)}" font-weight="700" letter-spacing="${f1(fs * 0.3)}" fill="${hot ? RED : '#6fa8c8'}">ALPER·BRAIN // ${hot ? 'ATTENTION' : 'CORE'}</text>`
  s += `<text x="${x + w - m - 24}" y="${f1(y + m + 6 + fs * 1.3)}" text-anchor="end" font-size="${f1(fs)}" font-weight="700" letter-spacing="${f1(fs * 0.3)}" fill="#6fa8c8">${live} ACTIVE</text>`
  return s
}

// A finished agent: a faint comet wandering a tilted lane between the core and the
// stars, at its own pace and way round, its lane and pace drawn from its id.
function drift(sky: Sky, a: SceneAgent, now: number): string {
  const h = hash(a.id)
  const f = 0.42 + ((h % 97) / 97) * 0.3
  const rx = sky.rx * f
  const ry = sky.ry * f
  const tilt = ((h >> 4) % 40) - 20
  const dur = 50 + ((h >> 8) % 50)
  const back = ((h >> 12) & 1) === 1
  const { cx, cy } = sky
  // a circle squashed to the lane's ellipse, so the arc can turn as an orbit does
  let s = `<g opacity=".55" transform="rotate(${tilt} ${f1(cx)} ${f1(cy)}) translate(0 ${f1(cy)}) scale(1 ${f1(ry / rx)}) translate(0 ${f1(-cy)})"><g>${spin(cx, cy, dur, now + h, back)}`
  s += `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(rx)}" fill="none" stroke="${a.color}" stroke-width="1.1" pathLength="100" stroke-dasharray="5 95" stroke-linecap="round" stroke-opacity=".7"/>`
  const ang = ((back ? 0 : 18) * Math.PI) / 180
  s += `<circle cx="${f1(cx + Math.cos(ang) * rx)}" cy="${f1(cy + Math.sin(ang) * rx)}" r="1.6" fill="${HOT}"/>`
  return `${s}</g></g>`
}

function sky(view: SceneView, sc: Box, lite: boolean): string {
  const now = view.now
  const sk = skyOf(sc)
  const fs = Math.min(Math.max(Math.min(sc.w, sc.h) / 44, 8.5), 12)
  const hot = view.build !== null && view.build.alerts.length > 0
  // the gate is gone: an agent a state from before still holds there is at the core
  const live = view.agents.filter(a => !a.isDone).map(a => (a.station === 'gate' ? { ...a, station: 'holo' as const } : a))
  const resting = view.agents.filter(a => a.isDone)
  const at: Partial<Record<Station, Lit[]>> = {}
  for (const a of live) (at[a.station] ??= []).push({ a, k: (at[a.station] ?? []).length })
  const thinking = (at.holo ?? []).filter(l => !l.a.isDone).length
  let s = `<rect x="${sc.x}" y="${sc.y}" width="${sc.w}" height="${sc.h}" fill="#050302"/>`
  s += dust(sc, sk, now, lite)
  s += `<ellipse cx="${f1(sk.cx)}" cy="${f1(sk.cy)}" rx="${f1(sk.rx * 1.12)}" ry="${f1(sk.ry * 1.12)}" fill="none" stroke="${AMBER}" stroke-opacity=".06" stroke-width="18"/>`
  s += `<ellipse cx="${f1(sk.cx)}" cy="${f1(sk.cy)}" rx="${f1(sk.rx * 1.2)}" ry="${f1(sk.ry * 1.2)}" fill="none" stroke="${COOL}" stroke-opacity=".22" stroke-width=".6" stroke-dasharray="1 7"/>`
  s += links(sk)
  for (const a of live) s += spoke(sk, a)
  s += core(sk, now, thinking, hot, lite)
  for (const st of STARS) s += star(sk, st, at[st.st] ?? [], now, fs)
  // finished agents drift about the core, dim, each on a lane of its own
  for (const a of resting) s += drift(sk, a, now)
  // the agents at work, as light
  for (const a of live) {
    const k = (at[a.station] ?? []).findIndex(l => l.a.id === a.id)
    const p = placeOf(sk, a.station)
    const rest =
      a.station === 'holo'
        ? orbit(a, sk.cx, sk.cy, sk.rc * (0.72 + k * 0.12), 3.2 + k * 0.6, now, false)
        : a.station === 'lounge'
          ? orbit(a, sk.cx, sk.cy, sk.rc * (1.55 + k * 0.1), 18, now, true)
          : orbit(a, p.x, p.y, (15 + k * 5) * p.s, 2.6 + k * 0.5, now, k % 2 === 1)
    s += travel(sk, a, rest, now)
  }
  // who thinks at the core, and who stands by, under it
  const coreNames = [...(at.holo ?? []), ...(at.lounge ?? [])]
  let ny = sk.cy + sk.rc * 1.55 + fs * 1.6
  for (const l of coreNames.slice(0, 3)) {
    s += `<text x="${f1(sk.cx)}" y="${f1(ny)}" text-anchor="middle" font-size="${f1(fs * 0.9)}" font-weight="600" opacity="${l.a.isDone ? 0.5 : 0.95}"><tspan fill="${l.a.color}">●</tspan><tspan fill="${isMain(l.a) ? GOLD : '#f4e6d2'}"> ${esc(l.a.name)}</tspan><tspan fill="${DIM}"> ${l.a.station === 'holo' ? 'thinking' : 'standby'}</tspan></text>`
    ny += fs * 1.2
  }
  s += hud(sc, live.length, hot, fs)
  return s
}

type Box = { x: number; y: number; w: number; h: number }

// A tall pane puts the rail under the sky; a wide one beside it.
function layout(view: SceneView, W: number, H: number) {
  const mode = H > W ? 'dock' : H >= 450 ? 'wide' : 'inline'
  let sc: Box
  let rail: Box & { c: Block }
  if (mode === 'dock') {
    // The sky takes about a square at the pane's width, and the rail sits right under it,
    // taking the rest; the sky shrinks only to leave the rail room for its content.
    // under 560 px the rail is one column, the wide rail's cards
    const one = W < 560
    const c = railContent(view, W, one ? 1 : 2, one)
    const sh = Math.round(Math.max(200, Math.min(W * (one ? 1.25 : 0.92), H - Math.min(Math.ceil(c.h), 420))))
    rail = { x: 0, y: sh, w: W, h: H - sh, c }
    sc = { x: 0, y: 0, w: W, h: sh }
  } else if (mode === 'wide') {
    const rw = Math.round(Math.min(Math.max(W * 0.31, 300), 360))
    let c = railContent(view, rw, 1, true)
    if (c.h > H) c = railContent(view, rw, 1, false)
    rail = { x: W - rw, y: 0, w: rw, h: H, c }
    sc = { x: 0, y: 0, w: W - rw, h: H }
  } else {
    const rw = 460
    rail = { x: W - rw, y: 0, w: rw, h: H, c: railContent(view, rw, 2, false) }
    sc = { x: 0, y: 0, w: W - rw, h: H }
  }
  return { mode, sc, rail }
}

function draw(view: SceneView, W: number, H: number, lite: boolean): string {
  const b = view.build
  const { mode, sc, rail } = layout(view, W, H)
  const hot = b !== null && b.alerts.length > 0
  const pulse = hot ? '<animate attributeName="opacity" values="1;.4;1" dur="1.6s" repeatCount="indefinite"/>' : ''
  const edge = hot ? RED : COOL
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
  s += `<style>${SKY_STYLE}</style><defs>${SKY_DEFS}</defs>`
  s += `<svg x="${sc.x}" y="${sc.y}" width="${sc.w}" height="${sc.h}" viewBox="${sc.x} ${sc.y} ${sc.w} ${sc.h}">${sky(view, sc, lite)}</svg>`
  // the rail: the sky's black, parted from it by a thin amber edge with a glow along it
  s += `<rect x="${rail.x}" y="${rail.y}" width="${rail.w}" height="${rail.h}" fill="#070403"/>`
  s +=
    mode === 'dock'
      ? `<g>${pulse}<rect x="0" y="${rail.y}" width="${W}" height="6" fill="${edge}" opacity=".1" filter="url(#soft)"/><rect x="0" y="${rail.y}" width="${W}" height="1" fill="${edge}" opacity=".45"/><rect x="${f1(W / 2 - 40)}" y="${rail.y}" width="80" height="2" fill="${edge}" opacity=".8"/></g>`
      : `<g>${pulse}<rect x="${rail.x}" y="0" width="6" height="${H}" fill="${edge}" opacity=".1" filter="url(#soft)"/><rect x="${rail.x}" y="0" width="1" height="${H}" fill="${edge}" opacity=".45"/><rect x="${rail.x}" y="${f1(H / 2 - 40)}" width="2" height="80" fill="${edge}" opacity=".8"/></g>`
  s += `<svg x="${rail.x}" y="${rail.y + (mode === 'dock' ? 2 : 0)}" width="${rail.w}" height="${rail.h - (mode === 'dock' ? 2 : 0)}">${rail.c.s}</svg>`
  return `${s}</svg>`
}

function drawn(view: SceneView, W: number, H: number): string {
  const out = draw(view, W, H, false)
  // over the cap, the dust and the core's sparks go first
  return out.length > CAP ? draw(view, W, H, true) : out
}

// The editor draws an Svg as an image: a new source reloads it and restarts every
// animation in it, and the pane renders whenever anything it reads changes, tokens
// among them. So a render that changes nothing on screen hands back the last source
// itself, and the picture keeps running; a change that shows draws anew, its loops
// begun where the session's clock has them, but no sooner than GAP_MS after the last
// new picture: what changes meanwhile waits, and the caller renders again then.
const GAP_MS = 2000
let last = { still: '', source: '', at: 0, size: '' }

export type Drawn = {
  source: string
  /** Set when a change waits on the gap: render again this many ms from now. */
  retryMs?: number
}

/** The session as one Svg source, under CAP when it can be: the last one while nothing shown changed. */
export function drawWorkshop(view: SceneView, W: number, H: number): Drawn {
  // the picture without its clock: equal to the last one's, nothing shown changed
  const still = drawn({ ...view, now: 0 }, W, H)
  const size = `${W}x${H}`
  if (last.source !== '' && still === last.still) return { source: last.source }
  // a new size draws at once; anything else waits out the gap
  const wait = GAP_MS - (view.now - last.at)
  if (last.source !== '' && size === last.size && wait > 0) return { source: last.source, retryMs: wait }
  last = { still, source: drawn(view, W, H), at: view.now, size }
  return { source: last.source }
}
