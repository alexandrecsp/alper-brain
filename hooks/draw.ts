// Agent Watcher: the session as a dark dashboard. A ring gauge shows how full the context window is,
// capsule bars the areas, a glowing curve the tokens over time, a table what each agent does; with a brain open,
// a strip of its counts and the tracks of each spec being built.
// Pure: a view in, one SVG document out. Its one import is types, so it runs in the pane and in node.

import type { BrainView, MilestoneView, TrackView } from '../types'

export type Area = 'think' | 'code' | 'read' | 'shell' | 'tests' | 'git' | 'brain' | 'docs' | 'web' | 'review'
export type AgentState = 'running' | 'idle' | 'done' | 'failed' | 'stopped'

export type ViewAgent = {
  id: string
  name: string
  kind: string
  area: Area
  state: AgentState
  doing: string
  tokens: number
  ms: number
  isMain: boolean
}

export type View = {
  total: number
  rate: number
  elapsedMs: number
  mix: { input: number; output: number; cacheRead: number; cacheWrite: number }
  areas: Partial<Record<Area, number>>
  /** Tokens per minute, oldest first. */
  series: number[]
  agents: ViewAgent[]
  /** The main session's context window: the last request's tokens and the model's window; tokens absent before one. */
  context?: { tokens?: number; window: number }
  /** The active brain, or null when the session has none. */
  brain?: BrainView | null
}

export type Theme = {
  name: string
  bg: string
  panel: string
  hair: string
  text: string
  muted: string
  faint: string
  accent: string
  accent2: string
  head: string
  body: string
  num: string
  numWeight: number
  labelTrack: number
  radius: number
  wall: number
  /** A cool second colour for the quiet parts: grid, gridlines, the main session, cache reads. */
  cool?: string
}

export const THEMES: Record<string, Theme> = {
  ember: {
    name: 'Ember',
    bg: '#09090A', panel: '#111113', hair: '#26262A', text: '#F2EDE6', muted: '#8C8780', faint: '#4A4744',
    accent: '#FF7A1A', accent2: '#FFB27A',
    head: "Bahnschrift, 'DIN Alternate', 'Segoe UI', sans-serif",
    body: "Bahnschrift, 'Segoe UI', sans-serif",
    num: "Bahnschrift, 'Segoe UI', sans-serif",
    numWeight: 300, labelTrack: 1.6, radius: 10, wall: 3.5,
  },
  gold: {
    name: 'Gold',
    bg: '#09090A', panel: '#111113', hair: '#26262A', text: '#F2EDE3', muted: '#9C9483', faint: '#544E43',
    accent: '#C8A867', accent2: '#EFE7D6', cool: '#D8D0BF',
    head: "Bahnschrift, 'DIN Alternate', 'Segoe UI', sans-serif",
    body: "Bahnschrift, 'Segoe UI', sans-serif",
    num: "Bahnschrift, 'Segoe UI', sans-serif",
    numWeight: 300, labelTrack: 1.6, radius: 10, wall: 3.5,
  },
  tide: {
    name: 'Tide',
    bg: '#02070A', panel: '#061014', hair: '#14252C', text: '#E4F1F0', muted: '#7F99A2', faint: '#36505A',
    accent: '#34D1A0', accent2: '#6CC4F5', cool: '#4D7FE3',
    head: "Bahnschrift, 'DIN Alternate', 'Segoe UI', sans-serif",
    body: "Bahnschrift, 'Segoe UI', sans-serif",
    num: "Bahnschrift, 'Segoe UI', sans-serif",
    numWeight: 300, labelTrack: 1.6, radius: 10, wall: 3.5,
  },
  slate: {
    name: 'Slate',
    bg: '#1B1E24', panel: '#22262E', hair: '#333844', text: '#E9ECF1', muted: '#8A93A3', faint: '#4B5262',
    accent: '#F08A2C', accent2: '#F6B36E',
    head: "'Segoe UI Variable Display', 'Segoe UI', sans-serif",
    body: "'Segoe UI Variable Text', 'Segoe UI', sans-serif",
    num: "'Segoe UI Variable Display', 'Segoe UI', sans-serif",
    numWeight: 600, labelTrack: 1.2, radius: 8, wall: 5,
  },
  dusk: {
    name: 'Dusk',
    bg: '#0B1019', panel: '#111827', hair: '#232D40', text: '#F1EADF', muted: '#8E97A8', faint: '#3E4859',
    accent: '#E8A44A', accent2: '#F5CF94',
    head: "Georgia, Cambria, 'Times New Roman', serif",
    body: "'Segoe UI', sans-serif",
    num: "Georgia, Cambria, serif",
    numWeight: 400, labelTrack: 2.2, radius: 12, wall: 2.5,
  },
  terminal: {
    name: 'Mono',
    bg: '#050505', panel: '#0C0C0C', hair: '#1F1F1F', text: '#EDEDED', muted: '#7A7A7A', faint: '#3A3A3A',
    accent: '#FF6B00', accent2: '#FFA266',
    head: "'Cascadia Code', Consolas, monospace",
    body: "'Cascadia Code', Consolas, monospace",
    num: "'Cascadia Code', Consolas, monospace",
    numWeight: 300, labelTrack: 1, radius: 4, wall: 3,
  },
}

// ---------- the areas ----------

/** Every area in the order the bars stand, with its label. */
export const ROOMS: { area: Area; label: string }[] = [
  { area: 'think', label: 'Think' },
  { area: 'code', label: 'Code' },
  { area: 'read', label: 'Read' },
  { area: 'shell', label: 'Shell' },
  { area: 'tests', label: 'Tests' },
  { area: 'git', label: 'Git' },
  { area: 'review', label: 'Review' },
  { area: 'brain', label: 'Brain' },
  { area: 'docs', label: 'Docs' },
  { area: 'web', label: 'Web' },
]

// ---------- words and numbers ----------

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const fit = (s: string, px: number, size: number) => {
  const n = Math.max(0, Math.floor(px / (size * 0.56)))
  return s.length > n ? `${s.slice(0, Math.max(0, n - 1))}…` : s
}
export const tokens = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : `${Math.round(n)}`
export const duration = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}
/** A clock the plan rounds to the minute: `12m`, `1h 04m`, `<1m`. */
const minutes = (ms: number) => (ms < 60_000 ? '<1m' : duration(ms).replace(/ 00s$/, ''))
const r1 = (n: number) => Math.round(n * 10) / 10

/** A smooth path through the points (Catmull-Rom as cubic Béziers). */
function smooth(pts: [number, number][]): string {
  if (pts.length === 0) return ''
  let d = `M${r1(pts[0]![0])},${r1(pts[0]![1])}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!
    const p1 = pts[i]!
    const p2 = pts[i + 1]!
    const p3 = pts[i + 2] ?? p2
    const c1: [number, number] = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2: [number, number] = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${r1(c1[0])},${r1(c1[1])} ${r1(c2[0])},${r1(c2[1])} ${r1(p2[0])},${r1(p2[1])}`
  }
  return d
}

/** The series squeezed or kept to at most `n` points, each the mean of the minutes it holds. */
function resample(series: number[], n: number): number[] {
  if (series.length <= n) return series
  const per = series.length / n
  return Array.from({ length: n }, (_, i) => {
    const from = Math.floor(i * per)
    const to = Math.max(from + 1, Math.floor((i + 1) * per))
    let s = 0
    for (let j = from; j < to; j++) s += series[j] ?? 0
    return s / (to - from)
  })
}


/** Where a track stands, in a word or two, by its first milestone not landed; `hot` when it needs the user. */
export function trackState(tr: TrackView): { at: MilestoneView | undefined; word: string; hot: boolean } {
  const at = tr.milestones.find(m => !m.landed)
  if (at === undefined) return { at, word: 'landed', hot: false }
  if (at.squashed) return { at, word: at.phase === 'failed' ? 'landing failed' : 'landing', hot: at.phase === 'failed' }
  if (at.phase === 'ask') return { at, word: 'waits on you', hot: true }
  if (at.phase === 'failed') return { at, word: 'check failed', hot: true }
  if (at.blocked) return { at, word: 'blocked', hot: true }
  if (at.phase !== 'none') return { at, word: at.phase, hot: false }
  if (at.done > 0) return { at, word: 'building', hot: false }
  return { at, word: 'ready', hot: false }
}

// ---------- the drawing ----------

/** The tallest each part grows as the pane widens. */
const GAUGE_MAX_R = 78
const CHART_MAX_H = 150
const MAX_ROWS = 8
const MAX_SPECS = 3
const MAX_TRACKS = 5
/** The colour of a track that needs the user, in every theme. */
const WARN = '#E5484D'
/** From this share of the context window the ring warns. */
const CONTEXT_WARN = 0.85
/** How much of the editor shows through: the background almost all, the cards some. */
const BG_ALPHA = 0.18
const CARD_ALPHA = 0.4
/** From this inner width the gauge and the bars sit side by side, and the agents' table spreads into columns. */
const WIDE = 640

/** A point on a circle, the angle in degrees clockwise from the right. */
const polar = (cx: number, cy: number, r: number, deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}
const arc = (cx: number, cy: number, r: number, from: number, to: number) => {
  const [x1, y1] = polar(cx, cy, r, from)
  const [x2, y2] = polar(cx, cy, r, to)
  return `M${r1(x1)},${r1(y1)} A${r1(r)},${r1(r)} 0 ${to - from > 180 ? 1 : 0} 1 ${r1(x2)},${r1(y2)}`
}

export function drawWatcher(v: View, width: number, t: Theme): { source: string; height: number } {
  const W = Math.max(340, Math.round(width))
  const P = 14
  const G = 12
  const inner = W - P * 2
  const wide = inner >= WIDE
  const cool = t.cool ?? t.muted
  const out: string[] = []
  const label = (x: number, y: number, s: string, fill = t.muted, size = 10.5, anchor = 'start', weight = 600) =>
    `<text x="${r1(x)}" y="${r1(y)}" font-family="${esc(t.body)}" font-size="${size}" font-weight="${weight}" letter-spacing="${t.labelTrack}" fill="${fill}" text-anchor="${anchor}">${esc(s.toUpperCase())}</text>`
  const text = (x: number, y: number, s: string, o: { fill?: string; size?: number; weight?: number; anchor?: string; font?: string; opacity?: number } = {}) =>
    `<text x="${r1(x)}" y="${r1(y)}" font-family="${esc(o.font ?? t.body)}" font-size="${o.size ?? 13}" font-weight="${o.weight ?? 400}" fill="${o.fill ?? t.text}" text-anchor="${o.anchor ?? 'start'}"${o.opacity === undefined ? '' : ` opacity="${o.opacity}"`}>${esc(s)}</text>`
  /** Text in capitals is about this wide per letter, tracking included. */
  const capsW = (s: string, size: number) => s.length * (size * 0.66 + t.labelTrack)
  /** A card: raised panel, lit faintly from the top, its title after a small gold dot. */
  const card = (x: number, y: number, w: number, h: number, title: string, note?: string) => {
    out.push(`<g filter="url(#lift)"><rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" rx="${t.radius}" fill="${t.panel}" fill-opacity="${CARD_ALPHA}"/></g>`)
    out.push(`<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" rx="${t.radius}" fill="url(#sheen)" stroke="${t.hair}"/>`)
    out.push(`<circle cx="${r1(x + 16)}" cy="${r1(y + 20)}" r="3" fill="${t.accent}"/>`)
    out.push(label(x + 26, y + 24, title))
    if (note && capsW(title, 10.5) + capsW(note, 9.5) + 60 < w) out.push(label(x + w - 14, y + 24, note, t.faint, 9.5, 'end', 500))
  }

  const running = v.agents.filter(a => a.state === 'running' && !a.isMain)
  let y = P

  // ----- header: the name in a light face, the session's pills -----
  out.push(text(P + 2, y + 15, 'Agent Watcher', { size: 17, weight: 300, font: t.head }))
  out.push(text(P + 2, y + 29, `session · ${minutes(v.elapsedMs)}`, { size: 11, fill: t.muted }))
  const pills: [string, boolean][] = [[`${tokens(v.rate)}/min`, false], [`${running.length} live`, running.length > 0]]
  let pxr = W - P
  for (const [s, live] of pills) {
    const pw = s.length * 7.4 + (live ? 32 : 22)
    pxr -= pw
    out.push(`<rect x="${r1(pxr)}" y="${y + 3}" width="${r1(pw)}" height="24" rx="12" fill="${t.panel}" stroke="${live ? t.accent : t.hair}" stroke-opacity="${live ? 0.55 : 1}"/>`)
    if (live) {
      out.push(`<circle cx="${r1(pxr + 13)}" cy="${y + 15}" r="3.5" fill="${t.accent}" filter="url(#glow)"><animate attributeName="opacity" values="1;0.35;1" dur="2s" repeatCount="indefinite"/></circle>`)
    }
    out.push(text(pxr + (live ? 23 : 11), y + 19.5, s, { size: 12, fill: live ? t.accent2 : t.text, font: t.num }))
    pxr -= 8
  }
  y += 30 + G + 4

  // ----- the brain: a strip of its counts -----
  const brain = v.brain ?? null
  if (brain !== null) {
    const stripH = 82
    card(P, y, inner, stripH, 'Brain', brain.name)
    const cells: [string, number, boolean][] = [
      ['notes', brain.notes, false],
      ['repos', brain.repos, false],
      ['active', brain.inFlight, brain.inFlight > 0],
      ['landed', brain.landed, false],
      ['drafts', brain.drafts, brain.drafts > 0],
    ]
    const cw = (inner - 28) / cells.length
    cells.forEach(([k, n, lit], i) => {
      const x = P + 14 + i * cw
      if (i > 0) out.push(`<line x1="${r1(x)}" y1="${y + 40}" x2="${r1(x)}" y2="${y + stripH - 12}" stroke="${t.hair}"/>`)
      out.push(text(x + (i > 0 ? 12 : 2), y + 60, String(n), { size: 22, font: t.num, weight: t.numWeight, fill: lit ? t.accent2 : t.text }))
      out.push(label(x + (i > 0 ? 12 : 2), y + 73, k, t.faint, 9))
    })
    y += stripH + G
  }

  // ----- the gauge: a 270° ring filled to how much of the context window the main session uses -----
  const parts: [string, number, string][] = [
    ['in', v.mix.input, t.accent],
    ['out', v.mix.output, t.accent2],
    ['cache read', v.mix.cacheRead, cool],
    ['cache write', v.mix.cacheWrite, t.faint],
  ]
  const all = parts.reduce((s, p) => s + p[1], 0)
  // wide: a card of its own beside the areas, key under the ring; narrow: full width, key beside it
  const gw = wide ? Math.min(320, Math.round(inner * 0.36)) : inner
  const R = wide ? Math.min(GAUGE_MAX_R, (gw - 76) / 2) : Math.min(GAUGE_MAX_R, Math.max(46, (inner - 210) / 2))
  const gaugeH = wide ? Math.round(44 + (R + 18) * 2 + 50) : Math.round(44 + (R + 18) * 2 + 10)
  card(P, y, gw, gaugeH, 'Tokens')
  const gcx = wide ? P + gw / 2 : P + 18 + R + 16
  const gcy = y + 44 + R + 18
  const A0 = 135
  const SWEEP = 270
  for (let i = 0; i <= 54; i++) {
    const deg = A0 + (SWEEP * i) / 54
    const long = i % 9 === 0
    const [x1, y1] = polar(gcx, gcy, R + 9, deg)
    const [x2, y2] = polar(gcx, gcy, R + (long ? 15 : 12), deg)
    out.push(`<line x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}" stroke="${long ? t.muted : t.faint}" stroke-width="${long ? 1.2 : 0.8}"/>`)
  }
  out.push(`<circle cx="${r1(gcx)}" cy="${r1(gcy)}" r="${r1(R - 12)}" fill="url(#orb)"/>`)
  out.push(`<circle cx="${r1(gcx)}" cy="${r1(gcy)}" r="${r1(R - 12)}" fill="none" stroke="${t.accent}" stroke-opacity="0.18"/>`)
  out.push(`<path d="${arc(gcx, gcy, R, A0, A0 + SWEEP)}" fill="none" stroke="${t.hair}" stroke-width="7" stroke-linecap="round"/>`)
  const ctx = v.context
  const used = ctx?.tokens !== undefined && ctx.window > 0 ? ctx.tokens / ctx.window : undefined
  // past CONTEXT_WARN the ring turns red: compaction is near
  const full = used !== undefined && used >= CONTEXT_WARN
  if (used !== undefined && used > 0.002) {
    const end = A0 + Math.min(1, used) * SWEEP
    out.push(`<path d="${arc(gcx, gcy, R, A0, end)}" fill="none" stroke="${full ? WARN : 'url(#ring)'}" stroke-width="7" stroke-linecap="round" filter="url(#glow)"/>`)
    const [ex, ey] = polar(gcx, gcy, R, end)
    out.push(`<circle cx="${r1(ex)}" cy="${r1(ey)}" r="5" fill="${t.panel}" stroke="${full ? WARN : t.accent2}" stroke-width="2" filter="url(#glow)"/>`)
  }
  const big = Math.min(36, R * 0.5)
  out.push(text(gcx, gcy + big * 0.22, used === undefined ? '—' : `${Math.round(used * 100)}%`, { size: big, anchor: 'middle', font: t.num, weight: t.numWeight, fill: full ? WARN : t.text }))
  out.push(label(gcx, gcy + big * 0.22 + 16, 'context', t.muted, 9.5, 'middle'))
  const ofWindow = ctx === undefined ? tokens(v.total) : `${ctx.tokens === undefined ? '—' : tokens(ctx.tokens)} / ${tokens(ctx.window)}`
  out.push(text(gcx, gcy + R * 0.95, ofWindow, { size: 12, anchor: 'middle', fill: t.accent2, font: t.num }))
  // the key: two by two under the ring, or a column beside it
  const keyX = wide ? P + 18 : gcx + R + 30
  const keyW = wide ? gw - 36 : P + inner - 18 - keyX
  parts.forEach(([k, n, c], i) => {
    const col = wide ? i % 2 : 0
    const row = wide ? Math.floor(i / 2) : i
    const cw2 = wide ? keyW / 2 : keyW
    const lx = keyX + col * cw2
    const yy = wide ? y + gaugeH - 38 + row * 19 : gcy - 33 + row * 24
    out.push(`<rect x="${r1(lx)}" y="${r1(yy - 7)}" width="10" height="4" rx="2" fill="${c}"/>`)
    out.push(text(lx + 16, yy, k, { size: 12, fill: t.muted }))
    out.push(text(lx + cw2 - (wide ? 12 : 0), yy, `${all > 0 ? Math.round((n / all) * 100) : 0}%`, { size: 12, anchor: 'end', font: t.num }))
  })
  if (!wide) out.push(label(keyX, gcy - 58, 'the mix', t.faint, 9.5))

  // ----- the areas -----
  const share = (a: Area) => (v.total > 0 ? (v.areas[a] ?? 0) / v.total : 0)
  const topShare = Math.max(0.0001, ...ROOMS.map(r => share(r.area)))
  const lit = new Set(running.map(a => a.area))
  // the session's total over the areas, in millions, in a light face
  const AREAS_TOTAL_H = 32
  const areasTotal = (x: number, base: number) => {
    const m = `${(v.total / 1e6).toFixed(v.total >= 1e7 ? 1 : 2)}M`
    out.push(text(x, base, m, { size: 20, font: t.num, weight: 300 }))
    out.push(label(x + m.length * 11 + 8, base, 'tokens', t.faint, 9.5))
  }
  if (wide) {
    // a vertical capsule each, beside the gauge
    const ax = P + gw + G
    const aw = inner - gw - G
    card(ax, y, aw, gaugeH, 'Areas', 'share of tokens')
    const bx0 = ax + 18
    const bw0 = aw - 36
    areasTotal(bx0, y + 54)
    const btop = y + 62 + AREAS_TOTAL_H
    const bbot = y + gaugeH - 38
    const bh = bbot - btop
    for (let i = 0; i <= 3; i++) {
      const gy = btop + (bh * i) / 3
      out.push(`<line x1="${r1(bx0)}" y1="${r1(gy)}" x2="${r1(bx0 + bw0)}" y2="${r1(gy)}" stroke="${cool}" stroke-opacity="0.16" stroke-dasharray="2 4"/>`)
    }
    const slot = bw0 / ROOMS.length
    const cw = Math.max(8, Math.min(20, slot * 0.4))
    ROOMS.forEach((r, i) => {
      const cx = bx0 + slot * (i + 0.5)
      const s = share(r.area)
      const on = lit.has(r.area)
      out.push(`<rect x="${r1(cx - cw / 2)}" y="${r1(btop)}" width="${r1(cw)}" height="${r1(bh)}" rx="${r1(cw / 2)}" fill="${t.hair}" fill-opacity="0.45"/>`)
      if (s > 0) {
        const h = Math.max(cw, (s / topShare) * bh)
        const top = bbot - h
        out.push(`<rect x="${r1(cx - cw / 2)}" y="${r1(top)}" width="${r1(cw)}" height="${r1(h)}" rx="${r1(cw / 2)}" fill="url(#bar)"${on ? ' filter="url(#glow)"' : ''}/>`)
        out.push(`<circle cx="${r1(cx)}" cy="${r1(top + cw / 2)}" r="${r1(cw * 0.17)}" fill="${t.bg}" fill-opacity="0.75"/>`)
        out.push(text(cx, top - 8, `${Math.round(s * 100)}%`, { size: 11, anchor: 'middle', font: t.num, fill: on ? t.accent2 : t.text }))
      }
      if (on) out.push(`<circle cx="${r1(cx)}" cy="${r1(bbot + 9)}" r="2.2" fill="${t.accent}" filter="url(#glow)"><animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite"/></circle>`)
      const lab = capsW(r.label, 9.5) <= slot ? r.label : r.label.slice(0, 3)
      out.push(label(cx, bbot + 25, lab, on ? t.accent : s > 0 ? t.muted : t.faint, 9.5, 'middle'))
    })
    y += gaugeH + G
  } else {
    // a horizontal capsule for each area with tokens, or with an agent in it
    y += gaugeH + G
    const shown = ROOMS.filter(r => share(r.area) > 0 || lit.has(r.area))
    const rowH = 26
    const areasH = 48 + AREAS_TOTAL_H + Math.max(1, shown.length) * rowH + 8
    card(P, y, inner, areasH, 'Areas', 'share of tokens')
    const lx = P + 18
    const tx0 = P + 92
    const tw0 = inner - 92 - 18 - 48
    areasTotal(lx, y + 60)
    const rows0 = y + 52 + AREAS_TOTAL_H
    if (shown.length === 0) out.push(text(lx, rows0 + 14, 'No tokens yet', { size: 12, fill: t.faint }))
    shown.forEach((r, i) => {
      const s = share(r.area)
      const on = lit.has(r.area)
      const mid = rows0 + i * rowH + rowH / 2
      if (on) out.push(`<circle cx="${r1(lx + 3)}" cy="${r1(mid)}" r="2.5" fill="${t.accent}" filter="url(#glow)"><animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite"/></circle>`)
      out.push(label(lx + 12, mid + 4, r.label, on ? t.accent : t.muted, 10))
      out.push(`<rect x="${r1(tx0)}" y="${r1(mid - 5)}" width="${r1(tw0)}" height="10" rx="5" fill="${t.hair}" fill-opacity="0.45"/>`)
      if (s > 0) out.push(`<rect x="${r1(tx0)}" y="${r1(mid - 5)}" width="${r1(Math.max(10, (s / topShare) * tw0))}" height="10" rx="5" fill="url(#hbar)"${on ? ' filter="url(#glow)"' : ''}/>`)
      out.push(text(P + inner - 18, mid + 4.5, `${Math.round(s * 100)}%`, { size: 12.5, anchor: 'end', font: t.num, fill: on ? t.accent2 : t.text }))
    })
    y += areasH + G
  }

  // ----- building: each spec in flight, a row per track, a segment per milestone -----
  if (brain !== null && brain.specs.length > 0) {
    const specs = brain.specs.slice(0, MAX_SPECS)
    const rowH = wide ? 30 : 44
    const heights = specs.map(sp => 34 + Math.min(MAX_TRACKS, sp.tracks.length) * rowH + 6)
    const more = brain.specs.length - specs.length
    const buildH = 40 + heights.reduce((a, b) => a + b, 0) + (more > 0 ? 20 : 0)
    card(P, y, inner, buildH, 'Building', `${brain.specs.length} spec${brain.specs.length === 1 ? '' : 's'} in flight`)
    let sy = y + 40
    specs.forEach((sp, si) => {
      if (si > 0) out.push(`<line x1="${P + 14}" y1="${r1(sy - 4)}" x2="${P + inner - 14}" y2="${r1(sy - 4)}" stroke="${t.hair}"/>`)
      out.push(text(P + 16, sy + 18, sp.id, { size: 14, font: t.num, fill: t.accent2 }))
      out.push(text(P + 52, sy + 18, fit(sp.title, inner - 52 - 90, 14), { size: 14, weight: 600 }))
      const landedM = sp.tracks.reduce((a, tr) => a + tr.milestones.filter(m => m.landed).length, 0)
      const allM = sp.tracks.reduce((a, tr) => a + tr.milestones.length, 0)
      out.push(text(P + inner - 16, sy + 18, `${landedM}/${allM} landed`, { size: 11, anchor: 'end', fill: t.faint }))
      sp.tracks.slice(0, MAX_TRACKS).forEach((tr, ti) => {
        const ry = sy + 34 + ti * rowH
        const st = trackState(tr)
        const at = st.at
        const what = at === undefined ? 'all landed' : `M${at.num} · ${at.done}/${at.total} tickets`
        const wordC = st.hot ? WARN : st.word === 'landed' ? t.faint : t.accent2
        // wide: slug, bar, where it stands, its word; narrow: slug and word, then the bar and where it stands
        const slugW = wide ? 130 : inner - 32
        const barX = wide ? P + 16 + slugW : P + 16
        const barW = wide ? inner - 32 - slugW - 250 : inner - 32 - 150
        const barY = wide ? ry + 6 : ry + 24
        const mid = wide ? ry + 10 : ry + 8
        if (st.hot) out.push(`<circle cx="${P + 19}" cy="${r1(mid)}" r="3" fill="${WARN}"><animate attributeName="opacity" values="1;0.3;1" dur="1.4s" repeatCount="indefinite"/></circle>`)
        out.push(label(P + (st.hot ? 28 : 16), mid + 3.5, fit(tr.slug, wide ? slugW - 16 : inner / 2, 10), st.hot ? WARN : t.muted, 10))
        const n = Math.max(1, tr.milestones.length)
        const gap = 4
        const segW = (barW - gap * (n - 1)) / n
        tr.milestones.forEach((m, mi) => {
          const sx = barX + mi * (segW + gap)
          out.push(`<rect x="${r1(sx)}" y="${r1(barY)}" width="${r1(segW)}" height="8" rx="4" fill="${t.hair}" fill-opacity="0.6"/>`)
          if (m.landed) out.push(`<rect x="${r1(sx)}" y="${r1(barY)}" width="${r1(segW)}" height="8" rx="4" fill="${t.accent2}" fill-opacity="0.38"/>`)
          else if (m === at) {
            const part = m.squashed ? 1 : m.total > 0 ? Math.max(0.08, m.done / m.total) : 0.08
            out.push(`<rect x="${r1(sx)}" y="${r1(barY)}" width="${r1(Math.max(8, segW * part))}" height="8" rx="4" fill="${st.hot ? WARN : 'url(#hbar)'}" filter="url(#glow)"/>`)
          }
        })
        const whatX = wide ? barX + barW + 16 : barX + barW + 12
        out.push(text(whatX, wide ? mid + 4.5 : barY + 8, what, { size: 12, fill: t.muted, font: t.num }))
        out.push(text(P + inner - 16, mid + 4.5, st.word, { size: 12, anchor: 'end', fill: wordC, weight: st.hot ? 600 : 400 }))
      })
      if (sp.tracks.length > MAX_TRACKS) out.push(text(P + inner - 16, sy + 34 + MAX_TRACKS * rowH - 8, `+${sp.tracks.length - MAX_TRACKS} tracks`, { size: 10.5, anchor: 'end', fill: t.faint }))
      sy += heights[si]!
    })
    if (more > 0) out.push(text(P + 16, sy + 8, `+${more} more in flight`, { size: 11, fill: t.faint }))
    y += buildH + G
  }

  // ----- tokens over time: a rail of dots, a glowing curve, the latest rate tagged -----
  const chartH = Math.max(92, Math.min(CHART_MAX_H, Math.round(inner * 0.22)))
  const chartCard = chartH + 80
  card(P, y, inner, chartCard, 'Tokens / min', v.series.length <= 1 ? 'since start' : `last ${minutes(v.series.length * 60_000)}`)
  const series = resample(v.series.length > 0 ? v.series : [0], wide ? 48 : 24)
  const cx0 = P + 52
  const cwid = inner - 52 - 18
  const cy0 = y + 48
  const max = Math.max(1, ...series)
  const niceMax = (() => {
    const p = 10 ** Math.floor(Math.log10(max))
    return Math.ceil(max / p) * p
  })()
  for (let i = 1; i < 6; i++) {
    const gx = cx0 + (cwid * i) / 6
    out.push(`<line x1="${r1(gx)}" y1="${r1(cy0)}" x2="${r1(gx)}" y2="${r1(cy0 + chartH)}" stroke="${cool}" stroke-opacity="0.12"/>`)
  }
  for (let i = 0; i <= 2; i++) {
    const gy = cy0 + (chartH * i) / 2
    out.push(`<line x1="${r1(cx0)}" y1="${r1(gy)}" x2="${r1(cx0 + cwid)}" y2="${r1(gy)}" stroke="${cool}" stroke-opacity="${i === 2 ? 0.35 : 0.16}"${i === 2 ? '' : ' stroke-dasharray="2 4"'}/>`)
    out.push(text(cx0 - 12, gy + 4, tokens((niceMax * (2 - i)) / 2), { size: 10.5, fill: t.faint, anchor: 'end' }))
  }
  out.push(`<line x1="${r1(cx0)}" y1="${r1(cy0)}" x2="${r1(cx0)}" y2="${r1(cy0 + chartH)}" stroke="${t.accent}" stroke-opacity="0.55"/>`)
  for (let i = 0; i <= 2; i++) out.push(`<circle cx="${r1(cx0)}" cy="${r1(cy0 + (chartH * i) / 2)}" r="3" fill="${t.panel}" stroke="${t.accent}" stroke-width="1.2"/>`)
  const pts: [number, number][] = series.map((n, i) => [
    cx0 + (series.length === 1 ? cwid : (cwid * i) / (series.length - 1)),
    cy0 + chartH - (n / niceMax) * chartH,
  ])
  if (pts.length === 1) pts.unshift([cx0, pts[0]![1]])
  const line = smooth(pts)
  const last = pts[pts.length - 1]!
  out.push(`<path d="${line} L${r1(last[0])},${r1(cy0 + chartH)} L${r1(pts[0]![0])},${r1(cy0 + chartH)} Z" fill="url(#area)"/>`)
  out.push(`<path d="${line}" fill="none" stroke="${t.accent}" stroke-width="1.8" filter="url(#glow)"/>`)
  out.push(`<line x1="${r1(last[0])}" y1="${r1(last[1])}" x2="${r1(last[0])}" y2="${r1(cy0 + chartH)}" stroke="${t.accent2}" stroke-opacity="0.5" stroke-dasharray="2 3"/>`)
  out.push(`<circle cx="${r1(last[0])}" cy="${r1(last[1])}" r="3.5" fill="${t.accent2}" filter="url(#glow)"/>`)
  const tag = tokens(series[series.length - 1] ?? 0)
  const tw = tag.length * 7.6 + 16
  const tx = last[0] - tw - 8
  const ty = Math.max(cy0 - 2, Math.min(cy0 + chartH - 21, last[1] - 10.5))
  out.push(`<rect x="${r1(tx)}" y="${r1(ty)}" width="${r1(tw)}" height="21" rx="5" fill="${t.bg}" stroke="${t.accent}" stroke-opacity="0.6"/>`)
  out.push(text(tx + tw / 2, ty + 14.5, tag, { size: 12, anchor: 'middle', fill: t.accent2, font: t.num }))
  out.push(text(cx0, cy0 + chartH + 19, v.series.length <= 1 ? 'start' : `${minutes(v.series.length * 60_000)} ago`, { size: 10.5, fill: t.faint }))
  out.push(text(cx0 + cwid, cy0 + chartH + 19, 'now', { size: 10.5, fill: t.faint, anchor: 'end' }))
  y += chartCard + G

  // ----- agents: one rounded row each; columns when wide, two lines when narrow -----
  const sorted = [...v.agents].sort((a, b) => Number(b.isMain) - Number(a.isMain) || Number(b.state === 'running') - Number(a.state === 'running'))
  const rows = sorted.slice(0, MAX_ROWS)
  const hidden = sorted.length - rows.length
  const rowH = wide ? 38 : 48
  const top = wide ? 62 : 46
  const more = hidden > 0 ? 24 : 0
  const tableH = top + rows.length * (rowH + 4) + more + 6
  card(P, y, inner, tableH, 'Agents', `${running.length} running · ${sorted.filter(a => !a.isMain && a.state !== 'running').length} done`)
  const xName = P + 32
  const xArea = P + 164
  const xDoing = P + 262
  const xTime = W - P - 18
  const xTok = xTime - 64
  const xBar = xTok - 112
  const showBar = inner >= 760
  if (wide) {
    const hy = y + 50
    out.push(label(xName, hy, 'agent', t.faint, 9.5))
    out.push(label(xArea, hy, 'area', t.faint, 9.5))
    out.push(label(xDoing, hy, 'doing', t.faint, 9.5))
    if (showBar) out.push(label(xBar, hy, 'share', t.faint, 9.5))
    out.push(label(xTok, hy, 'tokens', t.faint, 9.5, 'end'))
    out.push(label(xTime, hy, 'time', t.faint, 9.5, 'end'))
  }
  const most = Math.max(1, ...rows.map(a => a.tokens))
  rows.forEach((a, i) => {
    const ry = y + top + i * (rowH + 4)
    const live = a.state === 'running'
    const dim = !live && !a.isMain
    const mid = ry + rowH / 2
    out.push(`<rect x="${P + 8}" y="${r1(ry)}" width="${inner - 16}" height="${rowH}" rx="${Math.min(8, t.radius)}" fill="${live ? t.accent : '#FFFFFF'}" fill-opacity="${live ? 0.06 : i % 2 === 0 ? 0.025 : 0}"${live ? ` stroke="${t.accent}" stroke-opacity="0.22"` : ''}/>`)
    const dotC = live ? t.accent : a.state === 'failed' ? '#E5484D' : a.isMain ? cool : t.faint
    const dotY = wide ? mid : ry + 17
    out.push(
      a.isMain
        ? `<circle cx="${P + 20}" cy="${r1(dotY)}" r="4.5" fill="none" stroke="${dotC}" stroke-width="1.5"/>`
        : `<circle cx="${P + 20}" cy="${r1(dotY)}" r="4.5" fill="${dotC}"${live ? ' filter="url(#glow)"' : ''}/>`,
    )
    const room = ROOMS.find(r => r.area === a.area)?.label ?? a.area
    const doing = dim ? `${a.state} · ${a.doing}` : a.doing
    const tok = text(wide ? xTok : xTime, wide ? mid + 5 : ry + 21.5, tokens(a.tokens), { size: 14, anchor: 'end', font: t.num, weight: Math.max(400, t.numWeight), fill: dim ? t.muted : t.text })
    const time = a.isMain ? '—' : minutes(a.ms)
    if (wide) {
      out.push(text(xName, mid + 5, fit(a.name, xArea - xName - 8, 14), { size: 14, weight: 600, fill: dim ? t.muted : t.text }))
      const pw = capsW(room, 9.5) + 16
      out.push(`<rect x="${r1(xArea)}" y="${r1(mid - 10)}" width="${r1(pw)}" height="20" rx="10" fill="${live ? t.accent : 'none'}" fill-opacity="${live ? 0.14 : 0}" stroke="${live ? t.accent : t.hair}" stroke-opacity="0.6"/>`)
      out.push(label(xArea + pw / 2 + t.labelTrack / 2, mid + 3.5, room, live ? t.accent2 : t.muted, 9.5, 'middle'))
      const doingEnd = (showBar ? xBar : xTok - 60) - 12
      out.push(text(xDoing, mid + 4.5, fit(doing, doingEnd - xDoing, 12.5), { size: 12.5, fill: t.muted }))
      if (showBar) {
        out.push(`<rect x="${r1(xBar)}" y="${r1(mid - 2.5)}" width="70" height="5" rx="2.5" fill="${t.hair}"/>`)
        out.push(`<rect x="${r1(xBar)}" y="${r1(mid - 2.5)}" width="${r1(Math.max(5, (70 * a.tokens) / most))}" height="5" rx="2.5" fill="${live ? t.accent : a.isMain ? cool : t.faint}"/>`)
      }
      out.push(tok)
      out.push(text(xTime, mid + 4.5, time, { size: 11.5, anchor: 'end', fill: t.faint }))
    } else {
      // line one: name and area, tokens on the right; line two: what it is doing, its time on the right
      const nameW = Math.min(a.name.length * 14 * 0.6, xTime - 70 - xName - 70)
      out.push(text(xName, ry + 21.5, fit(a.name, nameW + 4, 14), { size: 14, weight: 600, fill: dim ? t.muted : t.text }))
      out.push(label(xName + nameW + 10, ry + 21, room, live ? t.accent : t.faint, 9.5))
      out.push(tok)
      out.push(text(xName, ry + 39, fit(doing, xTime - 54 - xName, 12), { size: 12, fill: t.muted }))
      out.push(text(xTime, ry + 39, time, { size: 11, anchor: 'end', fill: t.faint }))
    }
  })
  if (hidden > 0) out.push(text(xName, y + top + rows.length * (rowH + 4) + 14, `+${hidden} more`, { size: 11.5, fill: t.faint }))
  y += tableH + P

  const H = Math.round(y)
  const defs = `<defs>
<linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.045"/><stop offset="0.35" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
<radialGradient id="orb" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="${t.accent2}" stop-opacity="0.22"/><stop offset="0.7" stop-color="${t.accent}" stop-opacity="0.06"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></radialGradient>
<linearGradient id="ring" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${t.accent}"/><stop offset="1" stop-color="${t.accent2}"/></linearGradient>
<linearGradient id="bar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.accent2}"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0.55"/></linearGradient>
<linearGradient id="hbar" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t.accent}" stop-opacity="0.6"/><stop offset="1" stop-color="${t.accent2}"/></linearGradient>
<linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.accent}" stop-opacity="0.38"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></linearGradient>
<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="lift" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="6" stdDeviation="7" flood-color="#000" flood-opacity="0.35"/></filter>
</defs>`
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs}<rect width="${W}" height="${H}" fill="${t.bg}" fill-opacity="${BG_ALPHA}"/>${out.join('')}</svg>`
  return { source, height: H }
}
