// Reads the brain's notes and drafts by FORMAT.md, so every script agrees on what a note is: recall.mjs ranks them,
// schema.mjs checks them, timeline.mjs reads their past versions from git. parse and noteOf work on text alone;
// loadBrain reads the brain's folders. placeOf is the one reader of the brain's layout: `notes/`, or the legacy
// `repos/` and `shared/` a brain holds until MIGRATE.md's **Notes folder** moves it.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

export const TYPES = new Set(['feature', 'concept', 'decision', 'how-to', 'contract'])
export const LAYERS = new Set(['business', 'application'])

// Frontmatter is flat `key: value` lines. A key with no value followed by `  - item` lines holds that list, as
// Obsidian writes `aliases`; an inline `[a, b]` stays a string until listOf reads it.
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

// Where a path sits in the brain: an authored note, an explored note or a card, with the repository its folder names
// (null for an authored note in notes/ or shared/, whose repos line names them), and the layout it belongs to.
export function placeOf(path) {
  const p = path.split('/')
  if (p[0] === 'notes') {
    if (p[1] === 'authored' && p.length === 3) return { kind: 'authored', slug: null, layout: 'notes' }
    if (p[1] === 'repos' && p.length === 4 && p[3] === 'REPO.md') return { kind: 'card', slug: p[2], layout: 'notes' }
    if (p[1] === 'repos' && p.length === 5 && p[3] === 'explored') return { kind: 'explored', slug: p[2], layout: 'notes' }
    return null
  }
  if (p[0] === 'shared' && p.length === 2) return { kind: 'authored', slug: null, layout: 'legacy' }
  if (p[0] === 'repos' && p.length === 3) return { kind: p[2] === 'REPO.md' ? 'card' : 'authored', slug: p[1], layout: 'legacy' }
  if (p[0] === 'repos' && p.length === 4 && p[2] === 'explored') return { kind: 'explored', slug: p[1], layout: 'legacy' }
  return null
}

// The brain's layout: `notes` once it holds a notes/ folder, else `legacy`.
export const layoutOf = (brain) => (existsSync(join(brain, 'notes')) ? 'notes' : 'legacy')

// A repository's card, relative to the brain.
export const cardOf = (brain, slug) => (layoutOf(brain) === 'notes' ? `notes/repos/${slug}/REPO.md` : `repos/${slug}/REPO.md`)

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
    explored: !!fm.explored || place?.kind === 'explored',
    repos: place?.slug ? [place.slug] : listOf(fm.repos),
    superseded: fm.status === 'superseded',
    supersededBy: typeof fm.supersededBy === 'string' && fm.supersededBy ? fm.supersededBy : null,
  }
}

const list = (dir) => (existsSync(dir) && statSync(dir).isDirectory() ? readdirSync(dir) : [])

// Every registered repository's slug, every committed note and every draft in the brain.
export function loadBrain(brain) {
  const mdIn = (rel) => list(join(brain, rel)).filter((f) => f.endsWith('.md')).map((f) => `${rel}/${f}`)
  const layout = layoutOf(brain)
  const repos = layout === 'notes' ? 'notes/repos' : 'repos'
  const slugs = list(join(brain, repos)).filter((d) => existsSync(join(brain, repos, d, 'REPO.md')))
  const paths = layout === 'notes'
    ? [...mdIn('notes/authored'), ...slugs.flatMap((s) => mdIn(`notes/repos/${s}/explored`))]
    : [
        ...slugs.flatMap((s) => [...mdIn(`repos/${s}`).filter((p) => !p.endsWith('/REPO.md')), ...mdIn(`repos/${s}/explored`)]),
        ...mdIn('shared'),
      ]
  const notes = paths.map((path) => noteOf(path, readFileSync(join(brain, path), 'utf8')))
  const drafts = mdIn('.brain/drafts').map((path) => {
    const text = readFileSync(join(brain, path), 'utf8')
    const { fm } = parse(text)
    return noteOf(path, text, { target: typeof fm.target === 'string' && fm.target ? fm.target : path, draft: fm.action || 'record' })
  })
  return { layout, slugs, notes, drafts }
}
