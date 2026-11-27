#!/usr/bin/env node
// Moves the brain in a folder into the new layout, `<repo or host>/.brain/`, whatever its old kind. It moves tracked files
// with `git mv`, so their history follows them, and ignored files with a plain move. It does not commit.
// A brain already in today's one-folder layout is moved into the clusters layout by move-to-clusters.mjs, and an older kind
// takes that move after its own, in the same run.
//   node migrate-layout.mjs <folder> [--dry-run]
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, rmdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative } from 'node:path'
import { findBrain, fwd, oldLayoutOf, relativeTo } from './layout.mjs'
import { moveToClusters } from './move-to-clusters.mjs'
import { clonesOf, removeSnapshot } from './remove-snapshots.mjs'

const args = process.argv.slice(2)
const dry = args.includes('--dry-run')
const folder = fwd(args.find((a) => !a.startsWith('--')) ?? '')
const fail = (message) => { console.error(message); process.exit(1) }
if (!folder || !existsSync(folder)) fail('usage: node migrate-layout.mjs <folder> [--dry-run]')

const old = oldLayoutOf(folder)
if (old === 'one-folder') {
  try { moveToClusters(folder, { dry }) } catch (e) { fail(e.message) }
  process.exit(0)
}
if (!old) {
  if (!findBrain(folder)) fail(`${folder} holds no brain`)
  console.log(`Nothing to move: ${folder} holds no brain in an old layout.`)
  process.exit(0)
}

const TEAM = ['BRAIN.md', 'notes', 'repos', 'shared', '.obsidian', 'timeline.json', '.brain', '.sdd']
const GITIGNORE = ['config.json', 'notes/drafts/', 'repos/repos.json', 'repos/*/snapshots/', 'specs/', 'explore/', 'locks/', 'handoff/'].join('\n') + '\n'
const kind = { standalone: 'standalone', sdd: 'standalone', legacy: 'standalone', embedded: 'embedded', local: 'local' }[old]
// The folder holding the old brain's files, the new root they move into, and the folder git works in.
const teamDir = { embedded: `${folder}/brain`, local: `${folder}/.brain-local` }[old] ?? folder
// A local brain stays in its own folder while it is restructured, then the folder itself is renamed to `.brain`.
const inPlace = old === 'local'
const newRoot = inPlace ? teamDir : `${folder}/.brain`
const gitCwd = inPlace ? teamDir : folder
// A standalone brain shares its folder with its repository's own files, so only the brain's own entries move.
const sharesFolder = teamDir === folder

// Where a pipeline file goes, by its path under the old `.brain/` (or `.sdd/`).
function pipelineOf(q) {
  const [first, slug, ...tail] = q
  if (first === 'drafts') return ['notes', 'drafts', slug, ...tail].filter(Boolean).join('/')
  if (first === 'links.json' && !slug) return 'repos/repos.json'
  if (['tours', 'refactors', 'snapshots'].includes(first) && slug) return ['repos', slug, first, ...tail].join('/')
  return q.join('/')
}

// Where a file of the old brain goes, by its path relative to the old brain; null for a file that leaves.
function mapOf(rel) {
  const p = rel.split('/')
  if (p[0] === '.brain' || p[0] === '.sdd') return pipelineOf(p.slice(1))
  if (rel === 'timeline.json') return null
  if (p[0] === 'notes' && p[1] === 'repos' && p.length >= 4) {
    const [, , slug, f, ...tail] = p
    return f === 'explored' ? ['notes', 'exploration', slug, ...tail].join('/') : ['repos', slug, f, ...tail].join('/')
  }
  if (p[0] === 'repos' && p.length >= 3) {
    const [, slug, f, ...tail] = p
    if (f === 'explored') return ['notes', 'exploration', slug, ...tail].join('/')
    return f === 'REPO.md' && !tail.length ? rel : ['notes', 'authored', f, ...tail].join('/')
  }
  if (p[0] === 'shared') return ['notes', 'authored', ...p.slice(1)].join('/')
  return rel
}

const walk = (rel) => {
  const abs = join(teamDir, rel)
  return readdirSync(abs, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${rel}/${e.name}`) : [`${rel}/${e.name}`]))
}
// The old pipeline folder, which holds the machine's files, and the snapshots it holds: each is removed through its clone, never moved.
const pipeline = ['.brain', '.sdd'].map((n) => join(teamDir, n)).find((d) => existsSync(d))
const clones = pipeline ? clonesOf(join(pipeline, 'links.json')) : {}
const snapshots = pipeline && existsSync(join(pipeline, 'snapshots')) ? readdirSync(join(pipeline, 'snapshots'), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : []
const names = sharesFolder ? TEAM : readdirSync(teamDir).filter((n) => n !== '.git')
const oldFiles = names.filter((n) => existsSync(join(teamDir, n))).flatMap((n) => (statSync(join(teamDir, n)).isDirectory() ? walk(n) : [n]))
  .filter((rel) => !(pipeline && rel.split('/')[0] === basename(pipeline) && rel.split('/')[1] === 'snapshots'))

const ls = spawnSync('git', ['-C', gitCwd, 'ls-files', '-z'], { encoding: 'utf8', windowsHide: true })
const tracked = new Set(ls.status === 0 ? ls.stdout.split('\0').filter(Boolean) : [])
// Git names a file of the old brain by its path from `gitCwd`, which for an embedded brain is its host: `brain/<rel>`.
const inGit = (rel) => relativeTo(gitCwd, join(teamDir, rel))
const git = (...a) => {
  const r = spawnSync('git', ['-C', gitCwd, ...a], { encoding: 'utf8', windowsHide: true })
  if (r.status !== 0) fail(`git ${a.join(' ')} failed: ${r.stderr.trim()}`)
}

// The plan: each file's move or deletion, then the files written.
const moves = []
const deletes = []
for (const rel of oldFiles) {
  const to = mapOf(rel)
  if (to === null) deletes.push(rel)
  else if (join(newRoot, to) !== join(teamDir, rel)) moves.push({ rel, to })
}
const taken = new Set()
for (const { rel, to } of moves) {
  const dest = join(newRoot, to)
  if (taken.has(dest) || existsSync(dest)) fail(`cannot move ${rel}: ${relative(folder, dest)} already exists; nothing was changed`)
  taken.add(dest)
}

if (inPlace && existsSync(`${folder}/.brain`)) fail(`cannot rename .brain-local to .brain: .brain already exists; nothing was changed`)
const shown = (abs) => relativeTo(folder, abs)
console.log(`Moving the ${old} brain in ${folder} into ${shown(newRoot)}/`)
for (const { rel, to } of moves) console.log(`move ${rel} -> ${shown(join(newRoot, to))}`)
for (const rel of deletes) console.log(`delete ${rel}`)
for (const slug of snapshots) console.log(`remove ${shown(join(pipeline, 'snapshots', slug))}: through its clone, never moved`)
if (sharesFolder && existsSync(join(teamDir, '.gitignore'))) console.log('edit .gitignore: drop the .brain/ and .sdd/ lines, since the new root commits its files')
console.log(`write ${shown(newRoot)}/BRAIN.md kind: ${kind}`)
console.log(`write ${shown(newRoot)}/.gitignore`)

// A local brain's host ignores it through its exclude file, which names `.brain-local/`.
const exclude = inPlace ? spawnSync('git', ['-C', folder, 'rev-parse', '--git-path', 'info/exclude'], { encoding: 'utf8', windowsHide: true }) : null
const excludePath = exclude?.status === 0 ? join(folder, exclude.stdout.trim()) : null
if (inPlace) console.log(excludePath ? `edit ${fwd(excludePath)}: .brain-local/ -> .brain/` : "the host has no exclude file: add the line .brain/ to the host's ignore file yourself")

// An embedded brain's host loads its agent file, which points at the brain.
const AGENT_LINE = "- `.brain/`: this repository's second brain (see `.brain/BRAIN.md`). Before changing code, invoke the `brain` skill to recall its notes."
if (old === 'embedded') console.log(`Set the Brain line of the host's agent file to:\n${AGENT_LINE}`)

const withKind = (text) => {
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const lines = text.split(/\r?\n/)
  const end = lines[0]?.trim() === '---' ? lines.findIndex((l, i) => i > 0 && l.trim() === '---') : -1
  if (end < 0) return `---${eol}kind: ${kind}${eol}---${eol}${eol}${text}`
  const front = lines.slice(1, end).filter((l) => !/^kind:/.test(l))
  return [lines[0], ...front, `kind: ${kind}`, ...lines.slice(end)].join(eol)
}

if (dry) console.log("After this move, the one-folder move into the clusters layout runs in the same run: run it with --dry-run once this move is done to see its plan.")
if (!dry) {
  for (const slug of snapshots) removeSnapshot(join(pipeline, 'snapshots', slug), clones[slug])
  if (snapshots.length) try { rmdirSync(join(pipeline, 'snapshots')) } catch {}
  // The brain's own `.gitignore` held `.brain/`, which the new root now commits.
  const own = join(teamDir, '.gitignore')
  if (sharesFolder && existsSync(own)) {
    const kept = readFileSync(own, 'utf8').split(/\r?\n/).filter((l) => !['.brain/', '.brain', '/.brain/', '.sdd/', '.sdd', '/.sdd/'].includes(l.trim()))
    if (kept.every((l) => !l.trim())) {
      if (tracked.has(inGit('.gitignore'))) git('rm', '-q', '-f', '--', inGit('.gitignore'))
      else rmSync(own)
    } else writeFileSync(own, kept.join('\n'))
  }
  for (const { rel, to } of moves) {
    const dest = join(newRoot, to)
    mkdirSync(dirname(dest), { recursive: true })
    if (tracked.has(inGit(rel))) git('mv', '--', inGit(rel), relativeTo(gitCwd, dest))
    else renameSync(join(teamDir, rel), dest)
  }
  for (const rel of deletes) {
    if (tracked.has(inGit(rel))) git('rm', '-q', '-f', '--', inGit(rel))
    else rmSync(join(teamDir, rel))
  }
  const sources = new Set(moves.flatMap(({ rel }) => rel.split('/').slice(0, -1).map((_, i, d) => d.slice(0, i + 1).join('/'))))
  for (const dir of [...sources].sort((a, b) => b.length - a.length)) {
    try { rmdirSync(join(teamDir, dir)) } catch {}
  }
  if (!sharesFolder && !inPlace) try { rmdirSync(teamDir) } catch {}
  writeFileSync(join(newRoot, 'BRAIN.md'), withKind(readFileSync(join(newRoot, 'BRAIN.md'), 'utf8')))
  writeFileSync(join(newRoot, '.gitignore'), GITIGNORE)
  if (inPlace) renameSync(teamDir, `${folder}/.brain`)
  if (excludePath) {
    const text = existsSync(excludePath) ? readFileSync(excludePath, 'utf8') : ''
    const eol = text.includes('\r\n') ? '\r\n' : '\n'
    const kept = text.split(/\r?\n/).filter((l, i, all) => !(i === all.length - 1 && !l) && !['.brain-local/', '.brain-local', '/.brain-local/', '/.brain-local'].includes(l.trim()))
    if (!kept.some((l) => l.trim() === '.brain/')) kept.push('.brain/')
    writeFileSync(excludePath, kept.join(eol) + eol)
  }
  console.log(`Moved ${moves.length} files.`)
  try { moveToClusters(folder) } catch (e) { fail(e.message) }
}
