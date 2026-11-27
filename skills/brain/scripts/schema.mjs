#!/usr/bin/env node
// Checks notes and drafts against the brain's FORMAT.md frontmatter rules, so Record never writes, and Consolidate
// never commits, a note recall and the brain page would misread. Links to notes not written yet are allowed: they
// mark a note worth writing. A draft is checked as the note it lands as, at its target.
// Run: node schema.mjs <brain> <file>...   (prints one <path>: <rule> per finding and exits 1, else prints schema: ok;
//      a <path>: warn: <rule> line flags what FORMAT.md asks of new notes without failing the check)
//      node schema.mjs <brain>             (checks every note and draft, to list the ones already breaking a rule)
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { KINDS, pathsOf, kindOf, noteHome, relativeTo } from './layout.mjs'
import { TYPES, LAYERS, cardOf, draftOf, loadBrain, noteOf, placeOf } from './notes.mjs'

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
const draftsDir = relativeTo(brain, pathsOf(brain).drafts)
const rel = (p) => relativeTo(brain, resolve(p))

// The files to check: those named, read as BRAIN.md, a note or a draft by where they sit, else BRAIN.md and every note and draft.
const BRAIN_MD = { path: 'BRAIN.md', brainMd: true }
let checked
if (fileArgs.length) {
  checked = fileArgs.map((arg) => {
    const path = rel(arg)
    if (path.startsWith('..') || !existsSync(join(brain, path)) || !statSync(join(brain, path)).isFile()) fail(`${arg}: not a file in the brain`)
    if (path === 'BRAIN.md') return BRAIN_MD
    const text = readFileSync(join(brain, path), 'utf8')
    return path.startsWith(`${draftsDir}/`) ? draftOf(path, text) : noteOf(path, text)
  })
} else checked = [BRAIN_MD, ...notes, ...drafts]

// Names are unique across the committed notes; a draft may share its own target's name.
const owners = new Map()
for (const n of notes) owners.set(n.name, [...(owners.get(n.name) ?? []), n.path])

// What FORMAT.md asks of a new note, which a note written before the rule may lack: a warning, never a finding.
function warned(n) {
  if (n.brainMd || n.draft === 'delete' || n.explored || n.repos.length !== 1 || typeof n.fm.name !== 'string') return []
  const slug = n.repos[0]
  return n.fm.name.startsWith(`${slug}-`) ? [] : [`name ${n.fm.name} does not start with ${slug}-, the repository its repos names`]
}

// The folder git says holds the brain, or null when the brain is in no repository.
function gitTop() {
  try {
    const top = execFileSync('git', ['-C', brain, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }).trim()
    return realpathSync.native(top)
  } catch {
    return null
  }
}

// Each rule BRAIN.md breaks: its `kind` line names a kind, and the git test agrees with it. A local brain is a git
// repository of its own, so git's top level is its folder; a standalone or an embedded brain sits in its host's repository.
function brokenKind() {
  const kind = kindOf(brain)
  if (!kind) return [`kind is missing; it is one of ${[...KINDS].join(', ')}`]
  const top = gitTop()
  if (!top) return []
  const own = top === realpathSync.native(brain)
  if (kind === 'local' && !own) return ['kind is local, but the brain is not a git repository of its own']
  if (kind !== 'local' && own) return [`kind is ${kind}, but the brain is a git repository of its own, which only a local brain is`]
  return []
}

// Each rule a note breaks, as one line. The note is read where it lands: its target for a draft.
function broken(n) {
  if (n.brainMd) return brokenKind()
  const out = []
  const fm = n.fm
  const at = n.target.split('/')
  const place = placeOf(n.target)
  // The note's kind, from its explored line; a note is placed when its path is a note's, which is no card's.
  const placed = place && !place.card
  const where = placed ? (n.explored ? 'explored' : 'authored') : null

  if (n.draft) {
    if (typeof fm.target !== 'string' || !fm.target) out.push('a draft needs target: the path the note lands at')
    if (!ACTIONS.has(fm.action)) out.push(`action is ${fm.action ? `"${fm.action}"` : 'missing'}; it is one of ${[...ACTIONS].join(', ')}`)
    if (fm.action === 'supersede' && !(typeof fm.supersedes === 'string' && fm.supersedes)) out.push('a supersede draft needs supersedes: the decision it replaces')
    if (fm.action === 'delete') return out
  }
  const repoNotesDir = 'notes/repos/<slug>/'
  const paths = `${repoNotesDir}<name>.md or notes/shared/<name>.md`
  if (!where) out.push(`${n.draft ? 'target' : 'path'} ${n.target} is not ${paths}`)
  if (placed && place.slug && !slugs.includes(place.slug)) out.push(`repository ${place.slug} is not registered: it has no ${cardOf(brain, place.slug)}`)

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
  if (fm.type === 'contract' && where === 'explored') out.push('a contract is an authored note')
  if (fm.type === 'contract' && LAYERS.has(fm.layer) && fm.layer !== 'application') out.push('a contract is always application')
  if (fm.type === 'feature' && where && where !== 'explored') out.push(`a feature is an explored note only, in ${repoNotesDir}`)
  if (fm.type === 'feature' && LAYERS.has(fm.layer) && fm.layer !== 'business') out.push('a feature is always business')
  // An explored decision mirrors one of the repository's ADRs, and takes that decision's layer.
  if (where === 'explored' && fm.type !== 'decision' && LAYERS.has(fm.layer) && fm.layer !== 'business') out.push('an explored note is business, unless it is a decision')

  const isList = (v) => Array.isArray(v) || (typeof v === 'string' && /^\[.*\]$/.test(v))
  // repos is required where the folder names no repository: every authored note.
  if (where === 'authored') {
    if (fm.repos === undefined || !n.repos.length) out.push('an authored note needs repos: the slugs it bears on, as [a, b]')
    else if (!isList(fm.repos)) out.push('repos is a list, as [a, b]')
    else {
      for (const r of n.repos) if (!slugs.includes(r)) out.push(`repos names ${r}, which is not registered`)
      if (fm.type === 'contract' && n.repos.length < 2) out.push('a contract names at least two repos: its producer and a consumer')
    }
  } else if (fm.repos !== undefined) out.push('repos belongs on an authored note only: an explored note takes its repository from its folder')

  // An explored note sits in its repository's folder; an authored note sits at the noteHome of its repos line.
  if (placed && n.explored && !place.slug) out.push(`an explored note belongs in ${repoNotesDir}, its repository's folder`)
  if (where === 'authored' && isList(fm.repos) && n.repos.length) {
    const home = relativeTo(brain, noteHome(brain, n.repos))
    if (at.slice(0, -1).join('/') !== home) out.push(`an authored note on ${n.repos.join(', ')} belongs in ${home}/`)
  }

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
  if (fm.avoid !== undefined) {
    if (fm.type !== 'concept') out.push('avoid belongs on a concept note only: the term whose avoided words it lists')
    else if (!isList(fm.avoid)) out.push('avoid is a list, as [a, b] or one "- word" line each')
    else if (!n.avoid.length) out.push('avoid is empty: list the words the domain avoids for the term, or leave the line out')
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
