#!/usr/bin/env node
// Checks notes and drafts against the brain's FORMAT.md frontmatter rules, so Record never writes, and Consolidate
// never commits, a note recall and the brain page would misread. Links to notes not written yet are allowed: they
// mark a note worth writing. A draft is checked as the note it lands as, at its target.
// Run: node schema.mjs <brain> <file>...   (prints one <path>: <rule> per finding and exits 1, else prints schema: ok;
//      a <path>: warn: <rule> line flags what FORMAT.md asks of new notes without failing the check)
//      node schema.mjs <brain>             (checks every note and draft, to list the ones already breaking a rule)
import { existsSync, readFileSync, statSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { TYPES, LAYERS, cardOf, loadBrain, noteOf, parse, placeOf } from './notes.mjs'

const ACTIONS = new Set(['record', 'update', 'supersede', 'delete'])
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const fail = (message) => {
  console.error(`schema: ${message}`)
  console.error('Usage: node schema.mjs <brain> [<file>...]')
  process.exit(2)
}

const [brainArg, ...fileArgs] = process.argv.slice(2)
if (!brainArg) fail('name the brain folder')
const brain = resolve(brainArg)
if (!existsSync(join(brain, 'BRAIN.md'))) fail(`${brain} holds no BRAIN.md`)

const { layout, slugs, notes, drafts } = loadBrain(brain)
const rel = (p) => relative(brain, isAbsolute(p) ? p : resolve(p)).replace(/\\/g, '/')

// The files to check: those named, read as a note or a draft by where they sit, else every note and draft.
let checked
if (fileArgs.length) {
  checked = fileArgs.map((arg) => {
    const path = rel(arg)
    if (path.startsWith('..') || !existsSync(join(brain, path)) || !statSync(join(brain, path)).isFile()) fail(`${arg}: not a file in the brain`)
    const text = readFileSync(join(brain, path), 'utf8')
    if (!path.startsWith('.brain/drafts/')) return noteOf(path, text)
    const { fm } = parse(text)
    return noteOf(path, text, { target: typeof fm.target === 'string' && fm.target ? fm.target : path, draft: fm.action || 'record' })
  })
} else checked = [...notes, ...drafts]

// Names are unique across the committed notes; a draft may share its own target's name.
const owners = new Map()
for (const n of notes) owners.set(n.name, [...(owners.get(n.name) ?? []), n.path])

// What FORMAT.md asks of a new note, which a note written before the rule may lack: a warning, never a finding.
function warned(n) {
  if (n.draft === 'delete' || n.explored || n.repos.length !== 1 || typeof n.fm.name !== 'string') return []
  const slug = n.repos[0]
  return n.fm.name.startsWith(`${slug}-`) ? [] : [`name ${n.fm.name} does not start with ${slug}-, the repository its repos names`]
}

// Each rule a note breaks, as one line. The note is read where it lands: its target for a draft.
function broken(n) {
  const out = []
  const fm = n.fm
  const at = n.target.split('/')
  // A note sits where its brain's layout puts it: in the legacy layout, an authored note in shared/ spans repositories.
  const place = placeOf(n.target)
  const where = !place || place.kind === 'card' || place.layout !== layout ? null
    : place.kind === 'authored' && layout === 'legacy' && !place.slug ? 'shared'
    : place.kind

  if (n.draft) {
    if (typeof fm.target !== 'string' || !fm.target) out.push('a draft needs target: the path the note lands at')
    if (!ACTIONS.has(fm.action)) out.push(`action is ${fm.action ? `"${fm.action}"` : 'missing'}; it is one of ${[...ACTIONS].join(', ')}`)
    if (fm.action === 'supersede' && !(typeof fm.supersedes === 'string' && fm.supersedes)) out.push('a supersede draft needs supersedes: the decision it replaces')
    if (fm.action === 'delete') return out
  }
  const paths = layout === 'notes'
    ? 'notes/authored/<name>.md or notes/repos/<slug>/explored/<name>.md'
    : 'repos/<slug>/<name>.md, repos/<slug>/explored/<name>.md or shared/<name>.md'
  if (!where) out.push(`${n.draft ? 'target' : 'path'} ${n.target} is not ${paths}`)
  if (where && place.slug && !slugs.includes(place.slug)) out.push(`repository ${place.slug} is not registered: it has no ${cardOf(brain, place.slug)}`)

  const file = at.at(-1).replace(/\.md$/, '')
  if (typeof fm.name !== 'string' || !fm.name) out.push('name is missing')
  else {
    if (fm.name !== file) out.push(`name ${fm.name} differs from the file name ${file}`)
    if (!KEBAB.test(fm.name)) out.push(`name ${fm.name} is not kebab-case`)
    const others = (owners.get(fm.name) ?? []).filter((p) => p !== n.target)
    if (others.length && !(n.draft && n.draft !== 'record')) out.push(`name ${fm.name} is already taken by ${others.join(', ')}`)
  }
  if (typeof fm.description !== 'string' || !fm.description.trim()) out.push('description is missing')
  if (!TYPES.has(fm.type)) out.push(`type is ${fm.type ? `"${fm.type}"` : 'missing'}; it is one of ${[...TYPES].join(', ')}`)
  if (!LAYERS.has(fm.layer)) out.push(`layer is ${fm.layer ? `"${fm.layer}"` : 'missing'}; it is business or application`)
  if (fm.type === 'contract' && layout === 'legacy' && where && where !== 'shared') out.push('a contract lives in shared/')
  if (fm.type === 'contract' && where === 'explored') out.push('a contract is an authored note, in notes/authored/')
  if (fm.type === 'contract' && LAYERS.has(fm.layer) && fm.layer !== 'application') out.push('a contract is always application')
  if (fm.type === 'feature' && where && where !== 'explored') out.push(`a feature is an explored note only, in ${layout === 'notes' ? 'notes/' : ''}repos/<slug>/explored/`)
  if (fm.type === 'feature' && LAYERS.has(fm.layer) && fm.layer !== 'business') out.push('a feature is always business')
  if (where === 'explored' && LAYERS.has(fm.layer) && fm.layer !== 'business') out.push('an explored note is always business')

  const isList = (v) => Array.isArray(v) || (typeof v === 'string' && /^\[.*\]$/.test(v))
  // repos is required where the folder names no repository: every authored note in notes/, and shared/ in the legacy layout.
  const needsRepos = where === 'shared' || (where === 'authored' && layout === 'notes')
  if (needsRepos) {
    if (fm.repos === undefined || !n.repos.length) out.push(`${where === 'shared' ? 'a shared note' : 'an authored note'} needs repos: the slugs it bears on, as [a, b]`)
    else if (!isList(fm.repos)) out.push('repos is a list, as [a, b]')
    else {
      for (const r of n.repos) if (!slugs.includes(r)) out.push(`repos names ${r}, which is not registered`)
      if (fm.type === 'contract' && n.repos.length < 2) out.push('a contract names at least two repos: its producer and a consumer')
    }
  } else if (fm.repos !== undefined) out.push(layout === 'notes' ? 'repos belongs on an authored note only: an explored note takes its repository from its folder' : 'repos belongs on a shared/ note only')

  if (where === 'explored' && !fm.explored) out.push('an explored note needs explored: the short SHA it was read at')
  if (fm.explored !== undefined && where !== 'explored') out.push(`explored: belongs on a note in ${layout === 'notes' ? 'notes/' : ''}repos/<slug>/explored/ only`)

  if (fm.status !== undefined && fm.status !== 'superseded') out.push(`status is "${fm.status}"; the only status is superseded`)
  if (fm.status === 'superseded') {
    if (fm.type !== 'decision') out.push('only a decision is superseded')
    if (!n.supersededBy) out.push('a superseded decision needs supersededBy: the decision that replaced it')
  }
  if (fm.supersededBy !== undefined && fm.status !== 'superseded') out.push('supersededBy needs status: superseded')

  if (fm.aliases !== undefined) {
    if (!isList(fm.aliases)) out.push('aliases is a list, as [a, b] or one "- alias" line each')
    else if (!n.aliases.length) out.push('aliases is empty: list other words for the subject, or leave the line out')
  }
  return out
}

const findings = checked.flatMap((n) => broken(n).map((rule) => `${n.path}: ${rule}`))
const warnings = checked.flatMap((n) => warned(n).map((rule) => `${n.path}: warn: ${rule}`))
for (const w of warnings) console.log(w)
if (findings.length) {
  for (const f of findings) console.log(f)
  const notesHit = new Set(findings.map((f) => f.split(': ')[0])).size
  console.log(`schema: ${findings.length} finding${findings.length === 1 ? '' : 's'} in ${notesHit} of ${checked.length} file${checked.length === 1 ? '' : 's'}`)
  process.exit(1)
}
console.log(`schema: ok, ${checked.length} file${checked.length === 1 ? '' : 's'} checked${warnings.length ? `, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}` : ''}`)
