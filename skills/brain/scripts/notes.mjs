// Reads the brain's notes and drafts by FORMAT.md, so every script agrees on what a note is: recall.mjs ranks them,
// schema.mjs checks them. parse and noteOf work on text alone;
// loadBrain reads the brain's folders by the paths layout.mjs gives. placeOf is the one reader of a path's place in the
// brain's `.brain/` layout.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathsOf, relativeTo } from './layout.mjs'

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

// Where a path, relative to the brain, sits in it: an authored note, an explored note or a card, with the repository its
// folder names (null for an authored note in notes/authored/, whose repos line names them). Null for any other path.
export function placeOf(path) {
  const p = path.split('/')
  if (p[0] === 'notes' && p[1] === 'authored' && p.length === 3) return { kind: 'authored', slug: null }
  if (p[0] === 'notes' && p[1] === 'exploration' && p.length === 4) return { kind: 'explored', slug: p[2] }
  if (p[0] === 'repos' && p.length === 3 && p[2] === 'REPO.md') return { kind: 'card', slug: p[1] }
  return null
}

// A repository's card, relative to the brain.
export const cardOf = (brain, slug) => relativeTo(brain, pathsOf(brain).card(slug))

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

// A draft from its text: it lands at its `target`, else where it sits, by its `action`, else as a record.
export function draftOf(path, text) {
  const { fm } = parse(text)
  return noteOf(path, text, { target: typeof fm.target === 'string' && fm.target ? fm.target : path, draft: fm.action || 'record' })
}

// Every registered repository's slug, every committed note and every draft in the brain, each path relative to the
// brain.
export function loadBrain(brain) {
  const at = pathsOf(brain)
  const rel = (path) => relativeTo(brain, path)
  const mdIn = (dir) => list(dir).filter((f) => f.endsWith('.md')).map((f) => `${rel(dir)}/${f}`)
  const slugs = list(at.repos).filter((d) => existsSync(at.card(d)))
  const paths = [
    ...mdIn(at.authored),
    ...slugs.flatMap((s) => mdIn(at.exploration(s))),
  ]
  const notes = paths.map((path) => noteOf(path, readFileSync(join(brain, path), 'utf8')))
  const drafts = mdIn(at.drafts).map((path) => draftOf(path, readFileSync(join(brain, path), 'utf8')))
  return { slugs, notes, drafts }
}
