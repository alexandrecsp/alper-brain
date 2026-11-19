// Shrinks a gen.py SVG (polygon/polyline/line soup) toward the pane's 128 KB Svg cap; build-scene.mjs runs it.
//  1. parse each element into one op (fill and/or stroke over the same points);
//  2. collapse each cylinder's shaded side slices into one shape with a gradient;
//  3. cull ops that later opaque fills cover entirely (raster test on a 1/Q grid);
//  4. snap colours so near-identical shades share a style;
//  5. move each op back into the latest earlier path of the same style when nothing
//     painted in between overlaps it; write rounded relative path data, iso circles as arcs.
// Usage: node svgmin.mjs in.svg out.svg [Q=2] [snap=6]   (or import { minify, standalone })
import fs from 'node:fs'

const num = s => parseFloat(s)
const attrs = s => Object.fromEntries([...s.matchAll(/([a-z-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]))
const hex = c => { c = c.replace('#', ''); if (c.length === 3) c = [...c].map(x => x + x).join(''); return [0, 2, 4].map(i => parseInt(c.slice(i, i + 2), 16)) }
const toHex = rgb => { const h = '#' + rgb.map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join(''); return /^#([0-9a-f])\1([0-9a-f])\2([0-9a-f])\3$/.test(h) ? `#${h[1]}${h[3]}${h[5]}` : h }

export function parse(svg) {
  const ops = []
  const stack = []
  const re = /<(\/?)(g|polygon|polyline|line)\b([^>]*?)(\/?)>/g
  let m, gid = 0
  while ((m = re.exec(svg))) {
    const [, close, tag, rest, self] = m
    if (tag === 'g') {
      if (close) stack.pop()
      else if (!self) stack.push({ id: ++gid, filter: attrs(rest).filter ?? null })
      continue
    }
    const a = attrs(rest)
    const glow = !!(a.filter ?? stack.findLast(f => f.filter)?.filter)
    let pts, closed
    if (tag === 'line') { pts = [[num(a.x1), num(a.y1)], [num(a.x2), num(a.y2)]]; closed = false }
    else { pts = a.points.trim().split(/\s+/).map(p => p.split(',').map(num)); closed = tag === 'polygon' }
    const fill = closed && a.fill !== 'none' ? (a.fill ?? '#000') : null
    const stroke = a.stroke && a.stroke !== 'none' ? a.stroke : null
    ops.push({
      pts, closed, glow, g: stack.at(-1)?.id ?? 0,
      fill, fo: num(a['fill-opacity'] ?? 1),
      stroke, w: num(a['stroke-width'] ?? 1), so: num(a['stroke-opacity'] ?? 1),
      join: a['stroke-linejoin'] === 'round', cap: a['stroke-linecap'] === 'round',
    })
  }
  return ops
}

// gen.py draws a cylinder's side as n/2 slices, each filled and stroked (0.4) in its own shade.
export function collapseCylinders(ops, grads) {
  const out = []
  for (let i = 0; i < ops.length;) {
    const isSlice = o => o && o.closed && o.pts.length === 4 && o.fill && o.stroke === o.fill && o.w === 0.4
    let j = i
    while (isSlice(ops[j]) && ops[j].g === ops[i].g && ops[j].fo === ops[i].fo) j++
    if (j - i >= 6) {
      const run = ops.slice(i, j)
      // slice quad: b(a0) b(a1) t(a1) t(a0)
      const bottom = [run[0].pts[0], ...run.map(s => s.pts[1])]
      const top = [run[0].pts[3], ...run.map(s => s.pts[2])]
      const xs = bottom.map(p => p[0]), x0 = Math.min(...xs), x1 = Math.max(...xs)
      const picks = [0, run.length >> 2, run.length >> 1, (3 * run.length) >> 2, run.length - 1]
      const stops = picks.map(k => { const s = run[k]; const cx = (s.pts[0][0] + s.pts[1][0]) / 2; return [((cx - x0) / (x1 - x0 || 1)).toFixed(2), toHex(hex(s.fill))] })
      stops.sort((a, b) => a[0] - b[0])
      const key = stops.map(s => s.join(':')).join(',')
      if (!grads.has(key)) grads.set(key, `q${grads.size.toString(36)}`)
      out.push({ ...run[0], pts: [...bottom, ...top.reverse()], cyl: { n: bottom.length }, fill: `url(#${grads.get(key)})`, stroke: null, grad: true })
      i = j
    } else out.push(ops[i++])
  }
  return out
}

function bbox(o) {
  const xs = o.pts.map(p => p[0]), ys = o.pts.map(p => p[1])
  const pad = o.stroke ? o.w / 2 : 0
  return [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad]
}

// Pixel centres (on a 1/S grid) inside a polygon, even-odd, as a list of [x, y] indexes.
function scan(pts, S, W, H, ox, oy, each) {
  const P = pts.map(([x, y]) => [(x - ox) * S, (y - oy) * S])
  const ys = P.map(p => p[1])
  const y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(H - 1, Math.ceil(Math.max(...ys)))
  for (let y = y0; y <= y1; y++) {
    const cy = y + 0.5, xs = []
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length]
      if ((a[1] <= cy) !== (b[1] <= cy)) xs.push(a[0] + (cy - a[1]) / (b[1] - a[1]) * (b[0] - a[0]))
    }
    xs.sort((a, b) => a - b)
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.ceil(xs[k] - 0.5)), xb = Math.min(W - 1, Math.floor(xs[k + 1] - 0.5))
      for (let x = xa; x <= xb; x++) each(x, y)
    }
  }
}

const polyArea = p => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[i], r = p[(i + 1) % p.length]; a += q[0] * r[1] - r[0] * q[1] } return Math.abs(a) / 2 }

// minArea: a non-glowing fill smaller than this (in units^2) is too small to see in the pane.
export function cull(ops, vb, S = 2, minArea = 0) {
  const [ox, oy, vw, vh] = vb
  const W = Math.ceil(vw * S), H = Math.ceil(vh * S)
  const top = new Int32Array(W * H).fill(-1)
  ops.forEach((o, i) => { if (o.fill && o.fo >= 1 && !o.grad) scan(o.pts, S, W, H, ox, oy, (x, y) => { top[y * W + x] = i }) })
  ops.forEach((o, i) => { if (o.grad) scan(o.pts, S, W, H, ox, oy, (x, y) => { top[y * W + x] = i }) })
  const seen = (x, y, i) => { const px = Math.floor((x - ox) * S), py = Math.floor((y - oy) * S); return px < 0 || py < 0 || px >= W || py >= H || top[py * W + px] <= i }
  return ops.filter((o, i) => {
    if (o.glow) return true
    if (o.fill && polyArea(o.pts) < minArea) return false
    let vis = false
    if (o.fill) {
      let any = false
      scan(o.pts, S, W, H, ox, oy, (x, y) => { any = true; if (top[y * W + x] <= i) vis = true })
      if (!any) { const c = o.pts.reduce((s, p) => [s[0] + p[0] / o.pts.length, s[1] + p[1] / o.pts.length], [0, 0]); vis = seen(c[0], c[1], i) }
    }
    if (!vis && o.stroke) {
      const segs = o.pts.length - (o.closed ? 0 : 1)
      for (let k = 0; k < segs && !vis; k++) {
        const a = o.pts[k], b = o.pts[(k + 1) % o.pts.length]
        const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * S))
        for (let t = 0; t <= n && !vis; t++) {
          const x = a[0] + (b[0] - a[0]) * t / n, y = a[1] + (b[1] - a[1]) * t / n
          // a stroke on a shape's own edge sits under the next face's fill by half its width: probe both sides
          const d = o.w / 2 + 0.3
          if (seen(x, y, i) || seen(x + d, y, i) || seen(x - d, y, i) || seen(x, y + d, i) || seen(x, y - d, i)) vis = true
        }
      }
    }
    return vis
  })
}

export function snap(ops, step) {
  if (!step) return
  const s = c => c && c.startsWith('#') ? toHex(hex(c).map(v => Math.round(v / step) * step)) : c
  for (const o of ops) { o.fill = s(o.fill); o.stroke = s(o.stroke) }
}

function isConvex(p) {
  if (p.length < 3) return false
  let sign = 0
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length], c = p[(i + 2) % p.length]
    const z = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])
    if (Math.abs(z) < 1e-9) continue
    if (sign === 0) sign = Math.sign(z)
    else if (Math.sign(z) !== sign) return false
  }
  return true
}

const EPS = 0.05
const bbHit = (a, b) => a[0] < b[2] - EPS && b[0] < a[2] - EPS && a[1] < b[3] - EPS && b[1] < a[3] - EPS
function separated(P, Q) {
  for (const poly of [P, Q]) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length]
      const nx = b[1] - a[1], ny = a[0] - b[0]
      const len = Math.hypot(nx, ny)
      if (len < 1e-9) continue
      let p0 = Infinity, p1 = -Infinity, q0 = Infinity, q1 = -Infinity
      for (const v of P) { const d = (v[0] * nx + v[1] * ny) / len; p0 = Math.min(p0, d); p1 = Math.max(p1, d) }
      for (const v of Q) { const d = (v[0] * nx + v[1] * ny) / len; q0 = Math.min(q0, d); q1 = Math.max(q1, d) }
      if (p1 <= q0 + EPS || q1 <= p0 + EPS) return true
    }
  }
  return false
}
const hit = (a, b) => bbHit(a.bb, b.bb) && !(a.convex && b.convex && separated(a.pts, b.pts))

const keyOf = o => [o.fill ?? '', o.fill ? o.fo : '', o.stroke ?? '', o.stroke ? `${o.w}/${o.so}/${+o.join}${+o.cap}` : '', +o.glow, o.grad ? Math.random() : ''].join('|')

export function merge(ops) {
  for (const o of ops) { o.bb = bbox(o); o.convex = o.closed && isConvex(o.pts); o.key = keyOf(o) }
  const groups = []
  for (const o of ops) {
    // A translucent op joins a path only if it overlaps none of its members, which would
    // double its alpha. An outlined face may join one it overlaps: one path paints all its
    // fills, then all its strokes, which moves an outline over a face by half its width at most.
    const strict = o.fo < 1 || o.so < 1
    let target = null
    for (let i = groups.length - 1; i >= 0; i--) {
      const g = groups[i]
      if (g.key === o.key) {
        if (!(strict && bbHit(g.bb, o.bb) && g.members.some(m => hit(m, o)))) { target = g; break }
      }
      if (bbHit(g.bb, o.bb) && g.members.some(m => hit(m, o))) break
    }
    if (target) {
      target.members.push(o)
      const b = target.bb
      target.bb = [Math.min(b[0], o.bb[0]), Math.min(b[1], o.bb[1]), Math.max(b[2], o.bb[2]), Math.max(b[3], o.bb[3])]
    } else groups.push({ key: o.key, first: o, members: [o], bb: [...o.bb] })
  }
  return groups
}

function ellipseOf(pts) {
  if (pts.length < 12) return null
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1])
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2, ry = (y1 - y0) / 2
  if (rx < 0.5 || ry < 0.25) return null
  for (const [x, y] of pts) if (Math.abs(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 - 1) > 0.1) return null
  return { cx, cy, rx, ry }
}

// Radii of the iso ellipse (rx = 2 ry) through a run of points, with its turn direction.
function arcFit(pts) {
  if (pts.length < 6) return null
  const q = pts.map(([x, y]) => [x / 2, y])
  const n = q.length
  let sx = 0, sy = 0; for (const [x, y] of q) { sx += x; sy += y }
  const mx = sx / n, my = sy / n
  let suu = 0, svv = 0, suv = 0, suuu = 0, svvv = 0, suvv = 0, svuu = 0
  for (const [x, y] of q) { const u = x - mx, v = y - my; suu += u * u; svv += v * v; suv += u * v; suuu += u ** 3; svvv += v ** 3; suvv += u * v * v; svuu += v * u * u }
  const det = suu * svv - suv * suv
  if (Math.abs(det) < 1e-9) return null
  const b1 = (suuu + suvv) / 2, b2 = (svvv + svuu) / 2
  const uc = (b1 * svv - b2 * suv) / det, vc = (suu * b2 - suv * b1) / det
  const r = Math.sqrt(uc * uc + vc * vc + (suu + svv) / n)
  const cx = uc + mx, cy = vc + my
  for (const [x, y] of q) if (Math.abs(Math.hypot(x - cx, y - cy) - r) > Math.max(0.15, r * 0.04)) return null
  let turn = 0
  const ang = p => Math.atan2(p[1] - cy, p[0] - cx)
  for (let i = 1; i < n; i++) { let d = ang(q[i]) - ang(q[i - 1]); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; turn += d }
  return { rx: 2 * r, ry: r, large: Math.abs(turn) > Math.PI ? 1 : 0, sweep: turn > 0 ? 1 : 0 }
}

// Thin shapes (screen lines, slivers) keep a tenth of a unit; the rest round to 1/Q.
function isFine(o, Q) {
  const p = o.pts
  let per = 0, area = 0, minSeg = Infinity
  for (let i = 0; i < p.length - (o.closed ? 0 : 1); i++) {
    const a = p[i], b = p[(i + 1) % p.length]
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]); per += l; minSeg = Math.min(minSeg, l)
    area += a[0] * b[1] - b[0] * a[1]
  }
  if (o.closed && o.fill) return Math.abs(area) / (per || 1) < 0.4 / Q
  return minSeg < 0.5 / Q
}

export function pathData(members, Q) {
  // values are integers in tenths of a 1/Q unit
  const num = t => { const s = String(Math.abs(t) / 10).replace(/^0\./, '.'); return t < 0 ? '-' + s : s }
  const fmt = arr => { let out = ''; for (const v of arr) { const s = num(v); out += out && !s.startsWith('-') && !(s.startsWith('.') && /\.\d*$/.test(out.split(/[ -]/).pop())) ? ' ' + s : s } return out }
  const out = []
  let cur = null
  const move = p => (cur ? `m${fmt([p[0] - cur[0], p[1] - cur[1]])}` : `M${fmt(p)}`)
  for (const o of members) {
    const fine = isFine(o, Q)
    const R = v => fine ? Math.round(v * Q * 10) : Math.round(v * Q) * 10
    if (o.cyl) {
      // bottom arc, up the far side, top arc back, close
      const n = o.cyl.n, bot = o.pts.slice(0, n), top = o.pts.slice(n)
      const fb = arcFit(bot), ft = arcFit(top)
      if (fb && ft) {
        const b0 = bot[0].map(R), bn = bot.at(-1).map(R), tn = top[0].map(R), t0 = top.at(-1).map(R)
        out.push(`${move(b0)}a${num(R(fb.rx))} ${num(R(fb.ry))} 0 ${fb.large} ${fb.sweep}${fmt([bn[0] - b0[0], bn[1] - b0[1]])}l${fmt([tn[0] - bn[0], tn[1] - bn[1]])}a${num(R(ft.rx))} ${num(R(ft.ry))} 0 ${ft.large} ${ft.sweep}${fmt([t0[0] - tn[0], t0[1] - tn[1]])}z`)
        cur = b0
        continue
      }
    }
    const e = o.closed ? ellipseOf(o.pts) : null
    if (e) {
      const s = [R(e.cx - e.rx), R(e.cy)], d = R(e.cx + e.rx) - s[0], rx = R(e.rx), ry = R(e.ry)
      out.push(`${move(s)}a${num(rx)} ${num(ry)} 0 1 0 ${num(d)} 0a${num(rx)} ${num(ry)} 0 1 0${fmt([-d, 0])}z`)
      cur = s
      continue
    }
    const pts = o.pts.map(([x, y]) => [R(x), R(y)])
    const arc = !o.closed && o.pts.length >= 8 ? arcFit(o.pts) : null
    if (arc) {
      const s = pts[0], t = pts.at(-1)
      out.push(`${move(s)}a${num(R(arc.rx))} ${num(R(arc.ry))} 0 ${arc.large} ${arc.sweep}${fmt([t[0] - s[0], t[1] - s[1]])}`)
      cur = t
      continue
    }
    const p = pts.filter((q, i) => i === 0 || q[0] !== pts[i - 1][0] || q[1] !== pts[i - 1][1])
    if (o.closed && p.length > 1 && p[0][0] === p.at(-1)[0] && p[0][1] === p.at(-1)[1]) p.pop()
    if (o.fill && !o.stroke && p.length < 3) continue
    let s = move(p[0])
    const rel = []
    for (let i = 1; i < p.length; i++) rel.push(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1])
    if (rel.length) s += `l${fmt(rel)}`
    else s += 'h0'
    if (o.closed) { s += 'z'; cur = p[0] } else cur = p.at(-1)
    out.push(s)
  }
  return out.join('')
}

export function minify(svg, { Q = 2, step = 6, doCull = true, prefix = 'a', clip = null } = {}) {
  const full = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(num)
  const vb = clip ?? full
  const grads = new Map()
  let ops = parse(svg)
  const n0 = ops.length
  ops = collapseCylinders(ops, grads)
  if (doCull) ops = cull(ops, full, 2, 1)
  if (clip) { const [cx, cy, cw, ch] = clip; ops = ops.filter(o => { const b = bbox(o); return b[2] > cx - 3 && b[0] < cx + cw + 3 && b[3] > cy - 3 && b[1] < cy + ch + 3 }) }
  snap(ops, step)
  const groups = merge(ops)
  const r = v => +(v * Q).toFixed(2)
  // Styles become short classes: one per fill, one per stroke, `n` for no fill, `g` for glow.
  const fills = new Map(), strokes = new Map()
  const name = (map, k) => { if (!map.has(k)) map.set(k, `${prefix}${map === fills ? '' : 's'}${map.size.toString(36)}`); return map.get(k) }
  const body = []
  for (const g of groups) {
    const d = pathData(g.members, Q)
    if (!d) continue
    const o = g.first
    const cls = []
    if (o.fill) cls.push(name(fills, `fill:${o.fill}${o.fo < 1 ? `;fill-opacity:${o.fo}` : ''}`))
    else cls.push('n')
    if (o.stroke) cls.push(name(strokes, `stroke:${o.stroke};stroke-width:${r(o.w)}${o.so < 1 ? `;stroke-opacity:${o.so}` : ''}${o.join ? ';stroke-linejoin:round' : ''}${o.cap ? ';stroke-linecap:round' : ''}`))
    if (o.glow) cls.push('g')
    body.push(`<path class="${cls.join(' ')}" d="${d}"/>`)
  }
  const css = [...fills, ...strokes].map(([k, c]) => `.${c}{${k}}`).join('').replaceAll('url(#q', `url(#${prefix}q`)
  const defs = [...grads].map(([k, id]) => `<linearGradient id="${prefix}${id}">${k.split(',').map(s => { const [off, c] = s.split(':'); return `<stop offset="${+off}" stop-color="${snapHex(c, step)}"/>` }).join('')}</linearGradient>`).join('')
  return { vb, Q, defs, css, body: body.join(''), paths: body.length, ops: n0, kept: ops.length }
}
const snapHex = (c, step) => step ? toHex(hex(c).map(v => Math.round(v / step) * step)) : c

export const STYLE = '.n{fill:none}.g{filter:url(#glow)}'
export const glowFilter = Q => `<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${2.2 * Q}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`

export function standalone(m, bg = '#0d0e13') {
  const [x, y, w, h] = m.vb.map(v => Math.round(v * m.Q))
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${w * 2 / m.Q}" height="${h * 2 / m.Q}">` +
    `<defs>${glowFilter(m.Q)}${m.defs}<style>${STYLE}${m.css}</style></defs>` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${bg}"/>${m.body}</svg>`
}

if (process.argv[1]?.endsWith('svgmin.mjs')) {
  const [, , inp, out, q, st, c] = process.argv
  const m = minify(fs.readFileSync(inp, 'utf8'), { Q: +(q ?? 2), step: +(st ?? 6), doCull: c !== 'nocull' })
  const s = standalone(m)
  fs.writeFileSync(out, s)
  console.log(`${inp.split('/').pop()} Q${m.Q} snap${st ?? 6}: ${m.ops} ops, kept ${m.kept} -> ${m.paths} paths, ${(s.length / 1024).toFixed(1)} KB`)
}
