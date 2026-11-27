// Reads the brain's notes and drafts by FORMAT.md, so every script agrees on what a note is: recall.mjs ranks them,
// schema.mjs checks them. parse and noteOf work on text alone;
// loadBrain reads the brain's folders by the paths layout.mjs's pathsOf gives. placeOf is the one reader of a path's place
// in the brain's clusters layout; noteOf is the one reader of a note's kind, authored or explored, from its `explored` line.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathsOf, relativeTo } from './layout.mjs'

export const TYPES = new Set(['feature', 'concept', 'decision', 'how-to', 'contract', 'term'])
export const LAYERS = new Set(['business', 'application'])

// Frontmatter is flat `key: value` lines. A key with no value followed by `  - item` lines holds that list, as
// Obsidian writes `aliases` (and a term's `avoid`); an inline `[a, b]` stays a string until listOf reads it.
export function parse(text) {
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n')
  const fm = {}
  let end = 0
  if (lines[0]?.trim() === '---') {
    end = lines.findIndex((l, i) => i > 0 && l.trim() === '---')
    let listKey = null
    for (const line of lines.slice(1, end < 0 ? 0 : end)) {
      const item = /^\s+-\s+(.*)$/.exec(line)
      if (item && listKey) {
        fm[listKey].push(unquote(item[1].trim()))
        continue
      }
      listKey = null
      const kv = /^([\w-]+):\s*(.*)$/.exec(line)
      if (!kv) continue
      if (kv[2].trim() === '') {
        fm[kv[1]] = []
        listKey = kv[1]
      } else fm[kv[1]] = unquote(kv[2].trim())
    }
    end = end < 0 ? 0 : end + 1
  }
  return { fm, body: lines.slice(end).join('\n').trim() }
}

const unquote = (s) => s.replace(/^(["'])(.*)\1$/, '$2')

// A list field, written inline (`[a, b]` or `a, b`) or as a block list.
export const listOf = (value) =>
  (Array.isArray(value) ? value : String(value ?? '').replace(/^\[|\]$/g, '').split(','))
    .map((v) => unquote(String(v).trim()))
    .filter(Boolean)

// The lines under a body's `## <title>` heading, up to the next `## ` heading, without the blank ones.
const sectionOf = (body, title) => {
  const lines = body.replace(/\r\n?/g, '\n').split('\n')
  const start = lines.findIndex((l) => l.trim() === `## ${title}`)
  if (start < 0) return []
  const next = lines.findIndex((l, i) => i > start && /^##\s/.test(l))
  return lines.slice(start + 1, next < 0 ? undefined : next).map((l) => l.trim()).filter(Boolean)
}

// A pairing line, as FORMAT.md's **A term note** writes it: ``- <slug>[ · <context>]: `<word>`, <degree>[. <nuance>][. Avoid: `<w>`, `<w>`].``
// The degree is any word here, so schema.mjs can tell a degree it does not know from a line that is no pairing.
const PAIRING = /^-\s+([a-z0-9]+(?:-[a-z0-9]+)*)(?: · (.+?))?:\s+`([^`]+)`,\s+(\w+)(?:\.(?:\s+(.*))?)?\s*$/
const AVOID = /(?:^|\s)Avoid:\s*(`[^`]+`(?:,\s*`[^`]+`)*)\.?\s*$/

// One pairing from its line, or null when the line does not parse.
function pairingOf(line) {
  const m = PAIRING.exec(line)
  if (!m) return null
  const rest = m[5] ?? ''
  const avoid = AVOID.exec(rest)
  return {
    repo: m[1],
    context: m[2] ?? '',
    word: m[3],
    degree: m[4],
    nuance: (avoid ? rest.slice(0, avoid.index) : rest).trim().replace(/\.$/, ''),
    avoid: avoid ? [...avoid[1].matchAll(/`([^`]+)`/g)].map((w) => w[1]) : [],
  }
}

// A relation line, `- <verb> [[<term>]]`, as { verb, target }, or null.
function relationOf(line) {
  const m = /^-\s+(.+?)\s+\[\[([^\]|#]+)\]\]\s*$/.exec(line)
  return m ? { verb: m[1], target: m[2].trim() } : null
}

// What a path, relative to the brain, tells of its place in it: the repository its folder names (null in notes/shared/ and notes/domain/,
// whose notes name theirs on a repos line; `domain` marks the second) and whether the file is a repository's card. It never tells a note's kind: the
// `explored` line does. Null for any path that is neither a note's nor a card's, a research note's included.
export function placeOf(path) {
  const p = path.split('/')
  if (p[0] === 'notes' && p[1] === 'repos' && p.length === 4) return { slug: p[2], card: false }
  if (p[0] === 'notes' && p[1] === 'shared' && p.length === 3) return { slug: null, card: false }
  if (p[0] === 'notes' && p[1] === 'domain' && p.length === 3) return { slug: null, card: false, domain: true }
  if (p[0] === 'repos' && p.length === 2 && p[1].endsWith('.md')) return { slug: p[1].replace(/\.md$/, ''), card: true }
  return null
}

// A repository's card, relative to the brain.
export const cardOf = (brain, slug) => relativeTo(brain, pathsOf(brain).card(slug))

// A term's pairings, the lines of its `## Pairings` section that do not parse, and its relations: the one parser of both sections.
const termPartsOf = (body) => {
  const lines = sectionOf(body, 'Pairings')
  const pairings = lines.map(pairingOf)
  return {
    pairings: pairings.filter(Boolean),
    badPairings: lines.filter((_, i) => !pairings[i]),
    relations: sectionOf(body, 'Relations').map(relationOf).filter(Boolean),
  }
}

// One note from its text. `path` is where the file is, `target` where the note lands (a draft's target), and
// `draft` the draft's action, or null for a committed note.
export function noteOf(path, text, { target = path, draft = null } = {}) {
  const { fm, body } = parse(text)
  const place = placeOf(target)
  return {
    path, target, draft, body, fm,
    name: typeof fm.name === 'string' && fm.name ? fm.name : path.split('/').at(-1).replace(/\.md$/, ''),
    description: typeof fm.description === 'string' ? fm.description : '',
    type: typeof fm.type === 'string' ? fm.type : '',
    layer: typeof fm.layer === 'string' ? fm.layer : '',
    aliases: fm.aliases === undefined ? [] : listOf(fm.aliases),
    avoid: fm.avoid === undefined ? [] : listOf(fm.avoid),
    explored: !!fm.explored,
    repos: place?.slug && fm.explored ? [place.slug] : listOf(fm.repos),
    superseded: fm.status === 'superseded',
    supersededBy: typeof fm.supersededBy === 'string' && fm.supersededBy ? fm.supersededBy : null,
    ...(fm.type === 'term' ? termPartsOf(body) : { pairings: [], badPairings: [], relations: [] }),
  }
}

const list = (dir) => (existsSync(dir) && statSync(dir).isDirectory() ? readdirSync(dir) : [])

// Every .md file under a folder, each path relative to the brain; a folder whose name starts with a dot is left out.
const mdUnder = (brain, dir) =>
  list(dir).flatMap((f) => {
    const path = join(dir, f)
    if (statSync(path).isDirectory()) return f.startsWith('.') ? [] : mdUnder(brain, path)
    return f.endsWith('.md') ? [relativeTo(brain, path)] : []
  })

// A draft from its text: it lands at its `target`, else where it sits, by its `action`, else as a record.
export function draftOf(path, text) {
  const { fm } = parse(text)
  return noteOf(path, text, { target: typeof fm.target === 'string' && fm.target ? fm.target : path, draft: fm.action || 'record' })
}

// Every registered repository's slug, every committed note (notes/repos/, notes/shared/ and notes/domain/, never research) and every
// draft in the brain, each path relative to the brain.
export function loadBrain(brain) {
  const at = pathsOf(brain)
  const slugs = list(at.repos).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''))
  const paths = [...mdUnder(brain, at.repoNotesRoot), ...mdUnder(brain, at.sharedNotes), ...mdUnder(brain, at.domainNotes)]
  const notes = paths.map((path) => noteOf(path, readFileSync(join(brain, path), 'utf8')))
  const drafts = mdUnder(brain, at.drafts).map((path) => draftOf(path, readFileSync(join(brain, path), 'utf8')))
  return { slugs, notes, drafts }
}
