#!/usr/bin/env node
// Lists the brain's notes a piece of work needs, by the brain's RECALL.md, so recall reads a short ranked list
// instead of every description. It filters by repository, layer and type, ranks the rest by BM25 against the
// query (over each note's name, description and body), and always lists every contract on those repositories,
// since a contract must never be ranked out. A superseded decision gives way to the decision that replaced it.
// Drafts in .sdd/drafts/ are listed beside the notes, marked as drafts.
// Run: node recall.mjs <brain> [--repo <slug>]... [--layer business|application] [--type <type>]...
//                              [--query "<words>"] [--top <n>]
//      node recall.mjs <brain> --legacy   (lists the notes FORMAT.md's types and layers do not yet describe)
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const TYPES = new Set(['feature', 'concept', 'decision', 'how-to', 'contract'])
const LAYERS = new Set(['business', 'application'])

// ---- Arguments

const argv = process.argv.slice(2)
const opts = { repos: [], types: [], layer: null, query: '', top: 15, legacy: false }
let brain = null
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  const value = () => {
    if (i + 1 >= argv.length) fail(`${a} needs a value`)
    return argv[++i]
  }
  if (a === '--repo') opts.repos.push(value())
  else if (a === '--type') opts.types.push(value())
  else if (a === '--layer') opts.layer = value()
  else if (a === '--query') opts.query = value()
  else if (a === '--top') opts.top = Number(value())
  else if (a === '--legacy') opts.legacy = true
  else if (a.startsWith('--')) fail(`unknown option ${a}`)
  else if (!brain) brain = resolve(a)
  else fail(`unexpected argument ${a}`)
}
function fail(message) {
  console.error(`recall: ${message}`)
  console.error('Usage: node recall.mjs <brain> [--repo <slug>]... [--layer business|application] [--type <type>]... [--query "<words>"] [--top <n>] | --legacy')
  process.exit(2)
}
if (!brain) fail('name the brain folder')
if (!existsSync(join(brain, 'BRAIN.md'))) fail(`${brain} holds no BRAIN.md`)
if (opts.layer && !LAYERS.has(opts.layer)) fail(`--layer takes business or application, not ${opts.layer}`)
for (const t of opts.types) if (!TYPES.has(t)) fail(`--type takes ${[...TYPES].join(', ')}, not ${t}`)
if (!(opts.top > 0)) fail('--top takes a positive number')

// ---- Reading the notes

const list = (dir) => (existsSync(dir) && statSync(dir).isDirectory() ? readdirSync(dir) : [])
const mdIn = (rel) => list(join(brain, rel)).filter((f) => f.endsWith('.md')).map((f) => `${rel}/${f}`)

function parse(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const fm = {}
  let end = 0
  if (lines[0]?.trim() === '---') {
    end = lines.findIndex((l, i) => i > 0 && l.trim() === '---')
    for (const line of lines.slice(1, end < 0 ? 0 : end)) {
      const kv = /^([\w-]+):\s*(.*)$/.exec(line)
      if (kv) fm[kv[1]] = kv[2].trim().replace(/^(["'])(.*)\1$/, '$2')
    }
    end = end < 0 ? 0 : end + 1
  }
  return { fm, body: lines.slice(end).join('\n').trim() }
}
const reposOf = (path, fm) => {
  const parts = path.split('/')
  if (parts[0] === 'repos') return [parts[1]]
  return (fm.repos ?? '').replace(/^\[|\]$/g, '').split(',').map((r) => r.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
}

const slugs = list(join(brain, 'repos')).filter((d) => existsSync(join(brain, 'repos', d, 'REPO.md')))
const paths = [
  ...slugs.flatMap((s) => [...mdIn(`repos/${s}`).filter((p) => !p.endsWith('/REPO.md')), ...mdIn(`repos/${s}/explored`)]),
  ...mdIn('shared'),
]
const notes = paths.map((path) => {
  const { fm, body } = parse(readFileSync(join(brain, path), 'utf8'))
  return note(path, path, fm, body, null)
})
const drafts = mdIn('.sdd/drafts').map((path) => {
  const { fm, body } = parse(readFileSync(join(brain, path), 'utf8'))
  return note(path, fm.target ?? path, fm, body, fm.action || 'record')
})
function note(path, target, fm, body, draft) {
  return {
    path, target, draft, body,
    name: fm.name || path.split('/').at(-1).replace(/\.md$/, ''),
    description: fm.description ?? '',
    type: fm.type ?? '',
    layer: fm.layer ?? '',
    explored: !!fm.explored || target.split('/')[2] === 'explored',
    repos: reposOf(target, fm),
    superseded: fm.status === 'superseded',
    supersededBy: fm.supersededBy || null,
  }
}

// ---- Legacy: the notes to migrate by MIGRATE.md's **Note types**

if (opts.legacy) {
  const found = notes.flatMap((n) => {
    const why = []
    if (!TYPES.has(n.type)) why.push(`type ${n.type || 'missing'}`)
    if (!LAYERS.has(n.layer)) why.push(`layer ${n.layer || 'missing'}`)
    return why.length ? [`${n.path} · ${why.join(', ')}`] : []
  })
  console.log(found.length ? found.join('\n') : 'legacy: none')
  process.exit(0)
}

// ---- Filtering

const inRepos = (n) => !opts.repos.length || n.repos.some((r) => opts.repos.includes(r))
const contracts = notes.filter((n) => n.type === 'contract' && !n.superseded && inRepos(n))
// A note with no layer yet is kept under either layer, so a brain not yet migrated still recalls in full.
const fits = (n) =>
  n.type !== 'contract' && inRepos(n)
  && (!opts.layer || n.layer === opts.layer || !LAYERS.has(n.layer))
  && (!opts.types.length || opts.types.includes(n.type))
const pool = [...notes, ...drafts].filter(fits)

// ---- Ranking: BM25 over the name, the description (weighted three times) and the body

const STOP = new Set('a an and are as at be by for from has have in is it its of on or that the this to was when with which who will not no but if then than so do does into can'.split(' '))
const stem = (w) =>
  w.length > 4 && w.endsWith('ies') ? `${w.slice(0, -3)}y`
  : w.length > 5 && w.endsWith('ing') ? w.slice(0, -3)
  : w.length > 4 && w.endsWith('ed') ? w.slice(0, -2)
  : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1)
  : w
const terms = (text) =>
  (text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map(stem)

let ranked = pool.map((n) => ({ n, score: 0 }))
const query = [...new Set(terms(opts.query))]
if (opts.query && !query.length) fail(`--query "${opts.query}" holds no word to search by`)
if (query.length) {
  const docs = pool.map((n) => {
    const words = [...terms(n.name.replace(/-/g, ' ')), ...Array(3).fill(terms(n.description)).flat(), ...terms(n.body)]
    const tf = new Map()
    for (const w of words) tf.set(w, (tf.get(w) ?? 0) + 1)
    return { tf, len: words.length }
  })
  const avg = docs.reduce((s, d) => s + d.len, 0) / (docs.length || 1)
  const df = new Map(query.map((q) => [q, docs.filter((d) => d.tf.has(q)).length]))
  const k1 = 1.2
  const b = 0.75
  ranked = pool.map((n, i) => {
    const { tf, len } = docs[i]
    const score = query.reduce((s, q) => {
      const f = tf.get(q) ?? 0
      if (!f) return s
      const idf = Math.log(1 + (docs.length - df.get(q) + 0.5) / (df.get(q) + 0.5))
      return s + (idf * f * (k1 + 1)) / (f + k1 * (1 - b + (b * len) / avg))
    }, 0)
    return { n, score }
  })
  ranked = ranked.filter((r) => r.score > 0).sort((x, y) => y.score - x.score || x.n.path.localeCompare(y.n.path))
} else ranked.sort((x, y) => x.n.path.localeCompare(y.n.path))

// A superseded decision gives way to the head of its supersededBy chain, listed once, at the best rank either holds.
const byName = new Map(notes.map((n) => [n.name, n]))
const current = (n) => {
  const seen = new Set()
  while (n.superseded && n.supersededBy && byName.has(n.supersededBy) && !seen.has(n.name)) {
    seen.add(n.name)
    n = byName.get(n.supersededBy)
  }
  return n
}
const listed = new Map()
for (const { n } of ranked) {
  const head = n.draft ? n : current(n)
  if (head.superseded && !head.draft) continue
  if (!listed.has(head.path)) listed.set(head.path, { n: head, replaces: [] })
  if (head !== n) listed.get(head.path).replaces.push(n.name)
}
const all = [...listed.values()]
const shown = query.length ? all.slice(0, opts.top) : all

// ---- Output

const line = (n) => {
  const where = n.draft ? `${n.path} · draft ${n.draft} → ${n.target}` : n.path
  const kind = n.explored ? ' · explored' : ''
  return `  ${where} · ${n.type || 'type ?'} · ${n.layer || 'layer ?'}${kind} · ${n.description}`
}
const out = [`brain: ${brain.replace(/\\/g, '/')}`]
if (!opts.repos.length) {
  out.push('cards:')
  for (const s of slugs) {
    const { body } = parse(readFileSync(join(brain, 'repos', s, 'REPO.md'), 'utf8'))
    const summary = body.split('\n').find((l) => l.trim()) ?? ''
    out.push(`  ${s} · ${summary.length > 200 ? `${summary.slice(0, 200)}…` : summary}`)
  }
}
out.push(`contracts${opts.repos.length ? ` on ${opts.repos.join(', ')}` : ''}:`)
out.push(...(contracts.length ? contracts.map((n) => `  ${n.path} · repos ${n.repos.join(', ')} · ${n.description}`) : ['  none']))
const scope = [opts.layer, ...opts.types].filter(Boolean).join(', ')
out.push(`notes${scope ? ` (${scope})` : ''}: ${shown.length} of ${all.length}${query.length ? ' matching, best first' : ''}`)
out.push(...shown.map(({ n, replaces }) => line(n) + (replaces.length ? ` · supersedes ${replaces.join(', ')}` : '')))
if (shown.length < all.length) out.push(`  … ${all.length - shown.length} more: run again with --top ${opts.top * 2}`)
console.log(out.join('\n'))
