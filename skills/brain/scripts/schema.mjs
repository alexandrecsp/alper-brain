#!/usr/bin/env node
// Checks notes and drafts against the brain's FORMAT.md frontmatter rules, so Record never writes, and Consolidate
// never commits, a note recall and the brain page would misread. Links to notes not written yet are allowed: they
// mark a note worth writing. A draft is checked as the note it lands as, at its target.
// Run: node schema.mjs <brain> <file>...   (prints one <path>: <rule> per finding and exits 1, else prints schema: ok)
//      node schema.mjs <brain>             (checks every note and draft, to list the ones already breaking a rule)
import { existsSync, readFileSync, statSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { TYPES, LAYERS, loadBrain, noteOf, parse } from './notes.mjs'

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

const { slugs, notes, drafts } = loadBrain(brain)
const rel = (p) => relative(brain, isAbsolute(p) ? p : resolve(p)).replace(/\\/g, '/')

// The files to check: those named, read as a note or a draft by where they sit, else every note and draft.
let checked
if (fileArgs.length) {
  checked = fileArgs.map((arg) => {
    const path = rel(arg)
    if (path.startsWith('..') || !existsSync(join(brain, path)) || !statSync(join(brain, path)).isFile()) fail(`${arg}: not a file in the brain`)
    const text = readFileSync(join(brain, path), 'utf8')
    if (!path.startsWith('.sdd/drafts/')) return noteOf(path, text)
    const { fm } = parse(text)
    return noteOf(path, text, { target: typeof fm.target === 'string' && fm.target ? fm.target : path, draft: fm.action || 'record' })
  })
} else checked = [...notes, ...drafts]

// Names are unique across the committed notes; a draft may share its own target's name.
const owners = new Map()
for (const n of notes) owners.set(n.name, [...(owners.get(n.name) ?? []), n.path])

// Each rule a note breaks, as one line. The note is read where it lands: its target for a draft.
function broken(n) {
  const out = []
  const fm = n.fm
  const at = n.target.split('/')
  const where = at[0] === 'shared' && at.length === 2 ? 'shared'
    : at[0] === 'repos' && at.length === 3 && at[2] !== 'REPO.md' ? 'authored'
    : at[0] === 'repos' && at.length === 4 && at[2] === 'explored' ? 'explored'
    : null

  if (n.draft) {
    if (typeof fm.target !== 'string' || !fm.target) out.push('a draft needs target: the path the note lands at')
    if (!ACTIONS.has(fm.action)) out.push(`action is ${fm.action ? `"${fm.action}"` : 'missing'}; it is one of ${[...ACTIONS].join(', ')}`)
    if (fm.action === 'supersede' && !(typeof fm.supersedes === 'string' && fm.supersedes)) out.push('a supersede draft needs supersedes: the decision it replaces')
    if (fm.action === 'delete') return out
  }
  if (!where) out.push(`${n.draft ? 'target' : 'path'} ${n.target} is not repos/<slug>/<name>.md, repos/<slug>/explored/<name>.md or shared/<name>.md`)
  if (at[0] === 'repos' && at[1] && !slugs.includes(at[1])) out.push(`repository ${at[1]} is not registered: it has no repos/${at[1]}/REPO.md`)

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
  if (fm.type === 'contract' && where && where !== 'shared') out.push('a contract lives in shared/')
  if (fm.type === 'contract' && LAYERS.has(fm.layer) && fm.layer !== 'application') out.push('a contract is always application')
  if (fm.type === 'feature' && where && where !== 'explored') out.push('a feature is an explored note only, in repos/<slug>/explored/')
  if (fm.type === 'feature' && LAYERS.has(fm.layer) && fm.layer !== 'business') out.push('a feature is always business')
  if (where === 'explored' && LAYERS.has(fm.layer) && fm.layer !== 'business') out.push('an explored note is always business')

  const isList = (v) => Array.isArray(v) || (typeof v === 'string' && /^\[.*\]$/.test(v))
  if (where === 'shared') {
    if (fm.repos === undefined || !n.repos.length) out.push('a shared note needs repos: the slugs it spans, as [a, b]')
    else if (!isList(fm.repos)) out.push('repos is a list, as [a, b]')
    else for (const r of n.repos) if (!slugs.includes(r)) out.push(`repos names ${r}, which is not registered`)
  } else if (fm.repos !== undefined) out.push('repos belongs on a shared/ note only')

  if (where === 'explored' && !fm.explored) out.push('an explored note needs explored: the short SHA it was read at')
  if (fm.explored !== undefined && where !== 'explored') out.push('explored: belongs on a note in repos/<slug>/explored/ only')

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
if (findings.length) {
  for (const f of findings) console.log(f)
  const notesHit = new Set(findings.map((f) => f.split(': ')[0])).size
  console.log(`schema: ${findings.length} finding${findings.length === 1 ? '' : 's'} in ${notesHit} of ${checked.length} file${checked.length === 1 ? '' : 's'}`)
  process.exit(1)
}
console.log(`schema: ok, ${checked.length} file${checked.length === 1 ? '' : 's'} checked`)
