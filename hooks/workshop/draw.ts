import type { Station } from '../../types'
import { millions } from '../format'
import type { Tone } from '../theme'
import { FULL, LIGHTS, LIGHT_DEFS, SCENES, SPLIT } from './scene-data'
import { spotOf } from './stations'

// Draws the workshop pane: the room gen.py drew (scene-data.ts), lit where agents work,
// the agents as people in the room's style, and a rail with what waits on the user, the
// spec's tokens, its tracks and the crew. One Svg holds at most 128 KB, so the drawing
// comes back as two strips, cut where the room's strips meet, for the pane to stack.

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
const GOLD = '#F4C542'
const TONE: Record<Tone, string> = { active: '#40d8ff', done: '#3FB68B', failed: '#e5534b', blocked: '#e3b341', idle: '#8a8f98' }

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

const label = (x: number, y: number, w: number, t: string) =>
  `<text x="${x}" y="${y + 9}" font-size="9" font-weight="700" letter-spacing="1.2" fill="#6b7280">${esc(t)}</text><rect x="${f1(x + t.length * 6.6 + 6)}" y="${y + 5}" width="${f1(Math.max(0, w - t.length * 6.6 - 6))}" height="1" fill="#23262e"/>`

function alertsBlock(alerts: string[], x: number, y: number, w: number, fs: number): Block {
  let s = `<text x="${x}" y="${y + 9}" font-size="9" font-weight="700" letter-spacing="1.2" fill="#ff7a70">WAITS ON YOU · ${alerts.length}</text>`
  let cy = y + 15
  const n = Math.max(12, Math.floor((w - 38) / (fs * 0.56)))
  for (const raw of alerts) {
    const lines = wrap(raw.replace(/^[⚠️\s]+/u, ''), n)
    const h = 12 + lines.length * (fs + 3.5)
    s += `<g><rect x="${x}" y="${cy}" width="${w}" height="${f1(h)}" rx="5" fill="#3a1416" stroke="#e5534b" stroke-width="1.6"><animate attributeName="stroke-opacity" values="1;.35;1" dur="1.6s" repeatCount="indefinite"/></rect>`
    s += `<path d="M${x + 15} ${f1(cy + h / 2 - 7)}l8 14h-16z" fill="#e5534b"/><rect x="${x + 14.2}" y="${f1(cy + h / 2 - 3)}" width="1.6" height="5" fill="#3a1416"/><rect x="${x + 14.2}" y="${f1(cy + h / 2 + 3)}" width="1.6" height="1.8" fill="#3a1416"/>`
    lines.forEach((l, q) => {
      s += `<text x="${x + 30}" y="${f1(cy + 6 + fs + q * (fs + 3.5))}" font-size="${fs}" font-weight="600" fill="#ffd9d6">${esc(l)}</text>`
    })
    s += '</g>'
    cy += h + 5
  }
  return { s, h: cy - y - 5 }
}

function headerBlock(b: SceneBuild | null, x: number, y: number, w: number, tall: boolean): Block {
  const h = tall ? 40 : 28
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="#151821"/>`
  if (b === null) {
    s += `<text x="${x + 10}" y="${y + (tall ? 17 : 18)}" font-size="12.5" font-weight="700" fill="#d6d8dd">No build running</text>`
    if (tall) s += `<text x="${x + 10}" y="${y + 31}" font-size="10.5" fill="#8a8f98">The workshop is quiet</text>`
    return { s, h }
  }
  s += `<text x="${x + 10}" y="${y + (tall ? 17 : 18)}" font-size="12.5" font-weight="700" fill="#f2f3f5">${esc(cut(b.spec, Math.floor((w - 110) / 7)))}</text>`
  s += `<text x="${x + w - 10}" y="${y + (tall ? 20 : 18)}" text-anchor="end" font-size="14" font-weight="700" fill="#7fe7ff">${millions(b.tokens)} tok</text>`
  if (tall) {
    s += `<text x="${x + 10}" y="${y + 31}" font-size="10.5" fill="#8a8f98">${b.edits} edits · ${b.commits} commits · ${b.tracks.length} track${b.tracks.length === 1 ? '' : 's'}</text>`
    s += `<text x="${x + w - 10}" y="${y + 32}" text-anchor="end" font-size="8.5" letter-spacing="1" fill="#6b7280">TOKENS</text>`
  }
  return { s, h }
}

const TICKET: Record<string, string> = { done: '#3FB68B', doing: '#40d8ff', blocked: '#e3b341', todo: '#2b303b' }

function trackCard(t: SceneTrack, x: number, y: number, w: number, tall: boolean): Block {
  const tone = TONE[t.tone]
  const state = t.state.toUpperCase()
  const pw = state.length * 5.8 + 14
  const has = t.total > 0
  const h = tall ? (has ? 52 : 36) : has ? 30 : 20
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="#151821"/><rect x="${x}" y="${y}" width="3" height="${h}" rx="1.5" fill="${tone}"/>`
  const repoW = Math.min(t.repo.length, 18) * (tall ? 7.2 : 6.4)
  const pillY = y + (tall ? 5 : 3.5)
  const pillH = tall ? 15 : 13
  s += `<g><rect x="${f1(x + w - pw - 7)}" y="${pillY}" width="${f1(pw)}" height="${pillH}" rx="3" fill="${tone}" fill-opacity=".18" stroke="${tone}" stroke-width="1" stroke-opacity=".6"/><text x="${f1(x + w - pw / 2 - 7)}" y="${pillY + pillH - 4}" text-anchor="middle" font-size="8.5" font-weight="700" letter-spacing=".6" fill="${tone}">${esc(state)}</text>`
  if (t.tone === 'active') s += '<animate attributeName="opacity" values="1;.6;1" dur="2s" repeatCount="indefinite"/>'
  s += '</g>'
  s += `<text x="${x + 12}" y="${y + (tall ? 16 : 12.5)}" font-size="${tall ? 12.5 : 11}" font-weight="700" fill="#f2f3f5">${esc(cut(t.repo, 18))}</text>`
  const room = w - 12 - repoW - pw - 22
  if (tall) {
    s += `<text x="${f1(x + 12 + repoW + 6)}" y="${y + 16}" font-size="10.5" fill="#9aa0ab">${esc(cut(t.milestone, Math.max(0, Math.floor(room / 6))))}</text>`
    const sub = t.title && t.detail ? `${t.title} · ${t.detail}` : t.title || t.detail
    s += `<text x="${x + 12}" y="${y + 30}" font-size="10" fill="#7d838f">${esc(cut(sub, Math.floor((w - 22) / 5.3)))}</text>`
  } else {
    const more = [t.milestone, has ? '' : t.detail].filter(Boolean).join(' · ')
    s += `<text x="${f1(x + 12 + repoW + 5)}" y="${y + 12.5}" font-size="9.5" fill="#9aa0ab">${esc(cut(more, Math.max(0, Math.floor(room / 5.2))))}</text>`
  }
  if (has) {
    const by = y + (tall ? 38 : 19)
    const bh = tall ? 6 : 5
    const bx = x + 12
    const bw = w - 12 - 10 - 32
    const n = t.tickets.length || t.total
    const seg = Math.max(3, (bw - (n - 1) * 2) / n)
    for (let q = 0; q < n; q++) {
      const st = t.tickets[q]?.status ?? (q < t.done ? 'done' : 'todo')
      s += `<rect x="${f1(bx + q * (seg + 2))}" y="${by}" width="${f1(seg)}" height="${bh}" rx="1.5" fill="${TICKET[st] ?? TICKET.todo}">${st === 'doing' ? '<animate attributeName="opacity" values="1;.4;1" dur="1.4s" repeatCount="indefinite"/>' : ''}</rect>`
    }
    s += `<text x="${x + w - 8}" y="${by + bh + 1}" text-anchor="end" font-size="10" font-weight="700" fill="${t.done >= t.total ? '#3FB68B' : '#d6d8dd'}">${t.done}/${t.total}</text>`
  }
  return { s, h }
}

function tracksBlock(tracks: SceneTrack[], x: number, y: number, w: number, tall: boolean): Block {
  let s = label(x, y, w, `TRACKS · ${tracks.length}`)
  const gap = tall ? 5 : 4
  let cy = y + 16
  for (const t of tracks) {
    const c = trackCard(t, x, cy, w, tall)
    s += c.s
    cy += c.h + gap
  }
  return { s, h: cy - y - gap }
}

function crewRow(a: SceneAgent, x: number, y: number, w: number, tall: boolean): Block {
  const h = tall ? 30 : 15
  const nameW = a.name.length * (tall ? 7 : 6.3)
  let s = `<g${a.isDone ? ' opacity=".5"' : ''}>`
  if (a.isLead) s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="#241f10" stroke="${GOLD}" stroke-width="1.2"/>`
  if (tall) {
    s += `<circle cx="${x + 11}" cy="${y + 10}" r="4" fill="${a.color}"/>`
    s += `<text x="${x + 22}" y="${y + 13}" font-size="12" font-weight="700" fill="${a.isLead ? GOLD : '#f2f3f5'}">${esc(a.name)}</text>`
    if (a.job) s += `<text x="${f1(x + 22 + nameW + 6)}" y="${y + 13}" font-size="10" font-weight="700" fill="${a.color}">${esc(a.job)}</text>`
    if (a.isLead) s += `<rect x="${x + w - 36}" y="${y + 5}" width="30" height="12" rx="3" fill="${GOLD}"/><text x="${x + w - 21}" y="${y + 14}" text-anchor="middle" font-size="8" font-weight="700" letter-spacing=".6" fill="#1a1405">LEAD</text>`
    else if (a.isDone) s += `<rect x="${x + w - 36}" y="${y + 5}" width="30" height="12" rx="3" fill="#2a2d35"/><text x="${x + w - 21}" y="${y + 14}" text-anchor="middle" font-size="8" font-weight="700" letter-spacing=".6" fill="#9aa0ab">DONE</text>`
    s += `<text x="${x + 22}" y="${y + 25}" font-size="10.5" fill="#8a8f98">${esc(cut(a.task, Math.floor((w - 30) / 5.7)))}</text>`
  } else {
    s += `<circle cx="${x + 8}" cy="${y + 7.5}" r="3" fill="${a.color}"/>`
    s += `<text x="${x + 16}" y="${y + 11}" font-size="10.5" font-weight="700" fill="${a.isLead ? GOLD : '#f2f3f5'}">${esc(a.name)}</text>`
    let x0 = x + 16 + nameW + 5
    if (a.job) {
      s += `<text x="${f1(x0)}" y="${y + 11}" font-size="9.5" font-weight="700" fill="${a.color}">${esc(a.job)}</text>`
      x0 += a.job.length * 5.8 + 5
    }
    s += `<text x="${f1(x0)}" y="${y + 11}" font-size="10" fill="#8a8f98">${esc(cut(a.isDone ? 'done' : a.task, Math.floor((x + w - x0 - 4) / 5.3)))}</text>`
  }
  return { s: `${s}</g>`, h }
}

function crewBlock(agents: SceneAgent[], x: number, y: number, w: number, tall: boolean): Block {
  let s = label(x, y, w, `CREW · ${agents.length}`)
  let cy = y + 16
  const groups: Record<string, SceneAgent[]> = {}
  for (const a of agents) (groups[a.role] ??= []).push(a)
  for (const r of Object.keys(groups).sort((p, q) => rank(p) - rank(q))) {
    const list = groups[r] ?? []
    const col = list[0]?.color ?? '#8a8f98'
    s += `<circle cx="${x + 5}" cy="${cy + 7}" r="3.5" fill="${col}"/><text x="${x + 14}" y="${cy + 10.5}" font-size="10" font-weight="700" fill="${col}">${esc(ROLE_LABEL[r] ?? `${r}s`)}</text><text x="${x + w}" y="${cy + 10.5}" text-anchor="end" font-size="10" fill="#6b7280">${list.length}</text>`
    cy += 17
    for (const a of list) {
      const row = crewRow(a, x, cy, w, tall)
      s += row.s
      cy += row.h + (tall ? 3 : 1)
    }
    cy += 3
  }
  return { s, h: cy - y - 3 }
}

// One column (the wide rail) or two (the dock's bottom panel, the inline rail): alerts and the header span both.
function railContent(view: SceneView, W: number, cols: number, tall: boolean): Block {
  const b = view.build
  const pad = 12
  const iw = W - pad * 2
  let s = ''
  let y = 12
  if (b !== null && b.alerts.length > 0) {
    const a = alertsBlock(b.alerts, pad, y, iw, tall ? 11 : 10.5)
    s += a.s
    y += a.h + 10
  } else if (b !== null) {
    s += `<circle cx="${pad + 5}" cy="${y + 7}" r="3.5" fill="#3FB68B" opacity=".7"/><text x="${pad + 15}" y="${y + 11}" font-size="10.5" fill="#6f8f80">Nothing waits on you</text>`
    y += 22
  }
  const hd = headerBlock(b, pad, y, iw, tall)
  s += hd.s
  y += hd.h + 10
  const tracks = b?.tracks ?? []
  if (cols === 1) {
    if (tracks.length > 0) {
      const t = tracksBlock(tracks, pad, y, iw, tall)
      s += t.s
      y += t.h + 12
    }
    const c = crewBlock(view.agents, pad, y, iw, tall)
    s += c.s
    y += c.h
  } else if (tracks.length > 0) {
    const gap = 14
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
  return { s, h: y + 12 }
}

// ---------------------------------------------------------------- the room
// gen.py's projection: a tile is 32x16 and a unit of height 16.
const P = (x: number, y: number, z = 0): [number, number] => [(x - y) * 16, (x + y) * 8 - z * 16]
const OUTLINE = '#12131a'

// The light each station turns on while someone works there; the servers, the vault and the sconces always glow.
const STATION_LIGHT: Record<Station, string[]> = {
  bay: ['gantry'], tools: ['tool_bench'], shelves: ['archive'], brain: ['brain'], computer: ['holo_station'], comms: ['comms'],
  holo: ['holo'], table: ['meeting'], lounge: ['lounge'], tests: ['research'], dock: ['dock'], gate: ['gate'],
}
const ALWAYS = ['ambient', 'data_center', 'brain']

// ---- people, in the room's own style: outlined iso boxes, three shades to a box
const pts = (list: [number, number][]) => list.map(p => `${f1(p[0])},${f1(p[1])}`).join(' ')
const shade = (h: string, f: number) =>
  `#${[1, 3, 5].map(i => Math.max(0, Math.min(255, Math.round(parseInt(h.slice(i, i + 2), 16) * f))).toString(16).padStart(2, '0')).join('')}`
// A box's three faces in sight; a box in currentColor shades through black and white overlays.
function box(x: number, y: number, z: number, w: number, d: number, h: number, c: string) {
  const L = [P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h)]
  const R = [P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)]
  const T = [P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)]
  const cur = c === 'currentColor'
  const face = (p: [number, number][], fill: string, over?: [string, number]) =>
    `<polygon points="${pts(p)}" fill="${fill}"/>${over ? `<polygon points="${pts(p)}" fill="${over[0]}" fill-opacity="${over[1]}"/>` : ''}`
  return `<g stroke="${OUTLINE}" stroke-width=".6" stroke-linejoin="round">${face(L, c)}${face(R, cur ? c : shade(c, 0.68), cur ? ['#000', 0.32] : undefined)}${face(T, cur ? c : shade(c, 1.3), cur ? ['#fff', 0.28] : undefined)}</g>`
}
const TROUSERS = '#2b3142'
const SHOES = '#15161c'
const legs = (dy: number) =>
  box(-0.23, -0.1 + dy, 0, 0.2, 0.2, 0.12, SHOES) + box(-0.23, -0.1 + dy, 0.12, 0.2, 0.2, 0.98, TROUSERS) +
  box(0.03, -0.1 - dy, 0, 0.2, 0.2, 0.12, SHOES) + box(0.03, -0.1 - dy, 0.12, 0.2, 0.2, 0.98, TROUSERS)
const SKINS = ['#e9b48e', '#b98058', '#7a4f33']
const HAIRS = ['#2b2b33', '#5a3a22', '#d9b45a', '#3a5bd9', '#8e4fd6', '#b8463a', '#dcdcdc', '#1f8a7a']
const PERSON_DEFS = (() => {
  let s = `<symbol id="ps" overflow="visible">${legs(0)}</symbol><symbol id="pa" overflow="visible">${legs(0.13)}</symbol><symbol id="pb" overflow="visible">${legs(-0.13)}</symbol>`
  // the torso and the sleeves take the role's colour
  s += `<symbol id="pt" overflow="visible">${box(-0.44, -0.09, 1.2, 0.15, 0.18, 0.88, 'currentColor')}${box(-0.29, -0.18, 1.08, 0.58, 0.36, 1.1, 'currentColor')}${box(0.29, -0.09, 1.2, 0.15, 0.18, 0.88, 'currentColor')}</symbol>`
  SKINS.forEach((c, n) => {
    s += `<symbol id="ph${n}" overflow="visible">${box(-0.08, -0.08, 2.18, 0.16, 0.16, 0.08, shade(c, 0.85))}${box(-0.2, -0.2, 2.26, 0.4, 0.4, 0.4, c)}</symbol>`
  })
  s += `<symbol id="pr" overflow="visible">${box(-0.22, -0.22, 2.62, 0.44, 0.44, 0.13, 'currentColor')}${box(-0.22, -0.22, 2.38, 0.09, 0.44, 0.24, 'currentColor')}${box(-0.13, -0.22, 2.38, 0.35, 0.09, 0.24, 'currentColor')}</symbol>`
  return s
})()

type Placed = { a: SceneAgent; key: number; s: string; x: number; y: number; dx: number; dy: number; el: number; dur: number }

// A walk eases in and out of its stations, at the same pace in between.
const EASE = 'calcMode="spline" keyTimes="0;1" keySplines=".45 0 .55 1"'

function person(a: SceneAgent, k: number, now: number): Placed {
  const sp = spotOf(a.station, k)
  const p = P(sp[0], sp[1])
  const el = (now - a.movedAt) / 1000
  const dur = a.walkMs / 1000
  const walking = a.from !== a.station && el >= 0 && el < dur
  const fsp = spotOf(a.from, 0)
  const fp = P(fsp[0], fsp[1])
  const h = hash(a.id)
  const left = (dur - el).toFixed(2)
  const anim = walking
    ? `<animateTransform attributeName="transform" type="translate" values="${Math.round(fp[0])} ${Math.round(fp[1])};${Math.round(p[0])} ${Math.round(p[1])}" ${EASE} dur="${dur}s" begin="-${el.toFixed(2)}s" fill="freeze"/>`
    : ''
  const fade = a.isDone ? '<animate attributeName="opacity" values="1;.15;1" dur="3.2s" repeatCount="indefinite"/>' : ''
  const stand = '<use href="#ps"/>'
  const legsUse = walking
    ? `<g><use href="#pa" class="wa"/><use href="#pb" class="wb"/><set attributeName="visibility" to="hidden" begin="${left}s"/></g><g visibility="hidden">${stand}<set attributeName="visibility" to="visible" begin="${left}s"/></g>`
    : stand
  const ring = a.isDone ? '' : `<ellipse rx="13" ry="6.5" fill="none" stroke="${a.isLead ? GOLD : a.color}" stroke-width="1.4" class="pulse"/>`
  const s = `<g transform="translate(${Math.round(p[0])} ${Math.round(p[1])})">${anim}<g>${fade}<ellipse rx="10" ry="5" fill="#000" opacity=".45"/>${ring}${legsUse}<use href="#pt" color="${a.color}"/><use href="#ph${h % 3}"/><use href="#pr" color="${HAIRS[(h >> 3) % HAIRS.length]}"/></g></g>`
  return { a, key: sp[0] + sp[1], s, x: p[0], y: p[1] - 46, dx: walking ? fp[0] - p[0] : 0, dy: walking ? fp[1] - p[1] : 0, el, dur }
}

function tags(list: Placed[], fs: number, x0: number, w0: number) {
  const placed: { x: number; y: number; w: number; h: number }[] = []
  let s = ''
  for (const t of [...list].sort((p, q) => q.y - p.y)) {
    const text = t.a.name + (t.a.job ? ` · ${t.a.job}` : '')
    const w = text.length * fs * 0.58 + fs * 1.5
    const h = fs * 1.7
    const x = Math.min(Math.max(t.x - w / 2, x0 + 4), x0 + w0 - 4 - w)
    let y = t.y - h - 3
    for (let n = 0; n < 6; n++) {
      const hit = placed.some(r => x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y)
      if (!hit) break
      y -= h + 2
    }
    placed.push({ x, y, w, h })
    const anim = t.dx || t.dy
      ? `<animateTransform attributeName="transform" type="translate" values="${f1(t.dx)} ${f1(t.dy)};0 0" ${EASE} dur="${t.dur}s" begin="-${t.el.toFixed(2)}s" fill="freeze"/>`
      : ''
    s += `<g${t.a.isDone ? ' opacity=".55"' : ''}>${anim}<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" rx="${f1(fs * 0.3)}" fill="#07090d" fill-opacity=".88" stroke="${t.a.isLead ? GOLD : '#4a505e'}" stroke-width="${f1(fs * (t.a.isLead ? 0.14 : 0.09))}"/><circle cx="${f1(x + fs * 0.65)}" cy="${f1(y + h / 2)}" r="${f1(fs * 0.25)}" fill="${t.a.color}"/><text x="${f1(x + fs * 1.15)}" y="${f1(y + h / 2 + fs * 0.35)}" font-size="${f1(fs)}" font-weight="600" fill="${t.a.isLead ? GOLD : '#eceef2'}">${esc(text)}</text></g>`
  }
  return s
}

/** The track whose progress the mech shows: 0 is an empty bay, 4 the whole mech, which also stands when no build runs. */
export function mechStage(b: SceneBuild | null): number {
  if (b === null) return 4
  const tr =
    b.tracks.find(t => (t.state === 'busy' || t.state === 'closing' || t.state === 'landing') && t.total > 0) ??
    b.tracks.find(t => t.tone === 'active' && t.total > 0) ??
    b.tracks.find(t => t.total > 0)
  return tr === undefined ? 0 : Math.min(4, Math.floor((tr.done / tr.total) * 4 + 1e-6))
}

function lightsOf(view: SceneView, stage: number) {
  const on = new Set(ALWAYS)
  for (const a of view.agents) if (!a.isDone) for (const g of STATION_LIGHT[a.station]) on.add(g)
  if (stage === 4) on.add('mecha')
  if (view.build !== null && view.build.alerts.length > 0) on.add('alarm')
  let glows = ''
  let geo = ''
  let css = ''
  let defs = ''
  for (const g of on) {
    const L = LIGHTS[g]
    if (L === undefined) continue
    const cls = g === 'alarm' ? ' class="alarm"' : g === 'holo' ? ' class="flick"' : ''
    glows += `<g${cls}>${L.glows}</g>`
    if (L.geo !== null) {
      geo += `<g${cls}>${L.geo.body}</g>`
      css += L.geo.css
      defs += L.geo.defs
    }
  }
  return { glows, geo, css, defs }
}

const STYLE =
  "text{font-family:Inter,'Segoe UI',system-ui,sans-serif}.n{fill:none}.g{filter:url(#glow)}.scr{mix-blend-mode:screen}" +
  '.wa{animation:wA .36s steps(1) infinite}.wb{animation:wB .36s steps(1) infinite}@keyframes wA{0%{opacity:1}50%{opacity:0}}@keyframes wB{0%{opacity:0}50%{opacity:1}}' +
  '.pulse{animation:pl 1.8s ease-in-out infinite}@keyframes pl{0%,100%{opacity:.95}50%{opacity:.3}}' +
  '.alarm{animation:al 1.1s steps(4) infinite}@keyframes al{0%,100%{opacity:1}50%{opacity:.25}}' +
  '.flick{animation:fl 2.6s ease-in-out infinite}@keyframes fl{0%,100%{opacity:1}50%{opacity:.75}}'
const GLOW = '<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
const VIGNETTE = '<radialGradient id="vg"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></radialGradient>'
// The part of the room worth showing, in gen.py's units: the pane crops at most a fifth of it.
const WORLD = { cx: FULL[0] + FULL[2] / 2, cy: FULL[1] + FULL[3] / 2 + 4, w: 800, h: 520 }

type Box = { x: number; y: number; w: number; h: number }

// A tall pane puts the rail under the room; a wide one beside it.
function layout(view: SceneView, W: number, H: number) {
  const mode = H > W ? 'dock' : H >= 450 ? 'wide' : 'inline'
  let sc: Box
  let rail: Box & { c: Block }
  if (mode === 'dock') {
    // The room takes its own proportions at the pane's width, and the rail sits right
    // under it, taking the rest; the room shrinks only to leave the rail room for its content.
    const c = railContent(view, W, 2, false)
    const sh = Math.round(Math.max(120, Math.min((W * WORLD.h) / WORLD.w, H - Math.min(Math.ceil(c.h), 420))))
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

function draw(view: SceneView, W: number, H: number, lite: boolean): string[] {
  const b = view.build
  const { mode, sc, rail } = layout(view, W, H)
  const kFit = Math.min(sc.w / WORLD.w, sc.h / WORLD.h)
  const kFill = Math.max(sc.w / WORLD.w, sc.h / WORLD.h)
  const k = Math.min(kFill, kFit * 1.2)
  const vw = sc.w / k
  const vh = sc.h / k
  const vx = WORLD.cx - vw / 2
  const vy = WORLD.cy - vh / 2
  const fs = Math.min(Math.max(10 / k, 8), 18)
  const stage = mechStage(b)
  // the people, back to front
  const count: Partial<Record<Station, number>> = {}
  const crew: Placed[] = []
  for (const a of view.agents) {
    const n = (count[a.station] ?? -1) + 1
    count[a.station] = n
    crew.push(person(a, n, view.now))
  }
  crew.sort((p, q) => p.key - q.key)
  const people = crew.map(c => c.s).join('') + tags(crew, fs, vx, vw)
  const lit = lightsOf(view, stage)
  const live = view.agents.filter(a => !a.isDone).length
  const title = `<text x="${f1(vx + 14 / k)}" y="${f1(vy + 22 / k)}" font-size="${f1(10 / k)}" font-weight="700" letter-spacing="${f1(1.4 / k)}" fill="#6b7280">WORKSHOP · ${live} AT WORK</text>`
  const hot = b !== null && b.alerts.length > 0
  const pulse = hot ? '<animate attributeName="opacity" values="1;.4;1" dur="1.6s" repeatCount="indefinite"/>' : ''
  const edge = hot ? '#e5534b' : '#262a33'
  const railSvg =
    `<rect x="${rail.x}" y="${rail.y}" width="${rail.w}" height="${rail.h}" fill="#0e1015"/>` +
    (mode === 'dock'
      ? `<rect x="0" y="${rail.y}" width="${W}" height="2" fill="${edge}">${pulse}</rect>`
      : `<rect x="${rail.x}" y="0" width="2" height="${H}" fill="${edge}">${pulse}</rect>`) +
    `<svg x="${rail.x}" y="${rail.y + (mode === 'dock' ? 2 : 0)}" width="${rail.w}" height="${rail.h - (mode === 'dock' ? 2 : 0)}">${rail.c.s}</svg>`
  // the seam: where the room's strips meet on the canvas, on a whole pixel
  const ys = Math.min(Math.max(Math.round(sc.y + (SPLIT - vy) * k), 1), H - 1)
  const strips: [number, number][] = [[0, ys], [ys, H]]
  return strips.map(([y0, y1], i) => {
    const part = SCENES[stage]?.[i] ?? { css: '', defs: '', body: '' }
    let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${y1 - y0}" viewBox="0 ${y0} ${W} ${y1 - y0}">`
    s += `<style>${STYLE}${part.css}${lite ? '' : lit.css}</style><defs>${GLOW}${VIGNETTE}${LIGHT_DEFS}${PERSON_DEFS}${part.defs}${lite ? '' : lit.defs}</defs>`
    s += `<rect y="${y0}" width="${W}" height="${y1 - y0}" fill="#07080b"/>`
    if (sc.y < y1 && sc.y + sc.h > y0) {
      s += `<svg x="${sc.x}" y="${sc.y}" width="${f1(sc.w)}" height="${f1(sc.h)}" viewBox="${f1(vx)} ${f1(vy)} ${f1(vw)} ${f1(vh)}">`
      s += `<rect x="${f1(vx)}" y="${f1(vy)}" width="${f1(vw)}" height="${f1(vh)}" fill="#0d0e13"/>${part.body}`
      s += `<g class="scr">${lit.glows}</g>${lite ? '' : lit.geo}${people}`
      s += `<rect x="${f1(vx)}" y="${f1(vy)}" width="${f1(vw)}" height="${f1(vh)}" fill="url(#vg)"/>${title}</svg>`
    }
    if (rail.y < y1 && rail.y + rail.h > y0) s += railSvg
    return `${s}</svg>`
  })
}

/** The workshop as two Svg sources, top and bottom, each under CAP when it can be. */
export function drawWorkshop(view: SceneView, W: number, H: number): string[] {
  const out = draw(view, W, H, false)
  // over the cap, the lights' geometry (the hologram, the sirens) goes first
  return out.some(s => s.length > CAP) ? draw(view, W, H, true) : out
}
