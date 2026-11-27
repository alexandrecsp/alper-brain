// The one-folder move of migrate-layout.mjs: takes a brain in today's layout into the clusters layout by the spec's move list.
// It moves tracked files with `git mv`, so their history follows them, and ignored files with a plain move; it rewrites each draft's `target`
// to the new path of its note and removes each leftover snapshot through its clone. It does not commit.
// Called by migrate-layout.mjs with the host or the `.brain/` itself; it throws an Error whose message says what stopped it.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import { brainRootOf, fwd, noteHome, pathsOf, relativeTo } from './layout.mjs'
import { listOf, parse } from './notes.mjs'
import { clonesOf, removeSnapshot } from './remove-snapshots.mjs'

// Folders of the brain that no move reads: git's own, the vault's, and the new local folder.
const SKIPPED = new Set(['.git', '.obsidian', '.local'])
// The kind a doc folder's files take in their names.
const DOC_KINDS = { tours: 'tour', refactors: 'refactors' }

// Every file under a folder as a relative path, but the snapshot folders, which are never moved, and the root's own skipped folders.
const walk = (dir, rel = '') => readdirSync(join(dir, rel), { withFileTypes: true }).flatMap((e) => {
  if (!e.isDirectory()) return [`${rel}${e.name}`]
  const skipped = rel ? e.name === 'snapshots' && /^repos\/[^/]+\/$/.test(rel) : SKIPPED.has(e.name)
  return skipped ? [] : walk(dir, `${rel}${e.name}/`)
})

// Where a file of the brain goes, by its path relative to the brain root, as an absolute path; null for a file that stays.
function destOf(root, rel) {
  const at = pathsOf(root)
  const p = rel.split('/')
  const under = (n) => p.slice(n).join('/')
  if (p[0] === 'notes' && p[1] === 'authored' && p.length > 2) {
    return join(noteHome(root, listOf(parse(readFileSync(join(root, rel), 'utf8')).fm.repos)), under(2))
  }
  if (p[0] === 'notes' && p[1] === 'exploration' && p.length > 3) return join(at.repoNotes(p[2]), under(3))
  if (p[0] === 'notes' && p[1] === 'drafts' && p.length > 2) return join(at.drafts, under(2))
  if (p[0] === 'repos' && p.length === 2 && p[1] === 'repos.json') return at.reposJson
  if (p[0] === 'repos' && p.length >= 3) {
    const [, slug, folder] = p
    if (folder === 'REPO.md' && p.length === 3) return at.card(slug)
    if (folder === 'pages') return join(at.repoDocs(slug), under(3))
    if (folder in DOC_KINDS) {
      const name = p.at(-1)
      return join(at.repoDocs(slug), p.slice(3, -1).join('/'), `${basename(name, extname(name))}-${DOC_KINDS[folder]}${extname(name)}`)
    }
    return null
  }
  if (rel === 'config.json') return at.config
  if (p[0] === 'specs' && p.length > 1) return join(at.specs, p[2] === 'milestones' ? [p[1], ...p.slice(3)].join('/') : under(1))
  const folders = [['pages', at.sharedDocs], ['prototypes', at.prototypes], ['research', at.research], ['explore', at.explore], ['locks', at.locks], ['handoff', at.handoff]]
  for (const [folder, dest] of folders) {
    if (p[0] === folder && p.length > 1) return join(dest, under(1))
  }
  return null
}

// A target in an older layout, as the path its note holds in today's layout (notes/authored/, notes/exploration/), with the
// repository the old path names for it, if any. A target in today's layout or the clusters layout comes back as it is.
function todaysTarget(target) {
  const p = target.split('/')
  if (p[0] === 'shared' && p.length === 2) return { target: `notes/authored/${p[1]}`, repos: [] }
  if (p[0] === 'repos' && p.length === 4 && p[2] === 'explored') return { target: `notes/exploration/${p[1]}/${p[3]}`, repos: [] }
  if (p[0] === 'notes' && p[1] === 'repos' && p.length === 5 && p[3] === 'explored') return { target: `notes/exploration/${p[2]}/${p[4]}`, repos: [] }
  if (p[0] === 'repos' && p.length === 3 && p[2] !== 'REPO.md') return { target: `notes/authored/${p[2]}`, repos: [p[1]] }
  return { target, repos: [] }
}

// A draft's `target` in the clusters layout, by its `action`: a note the draft updates or deletes is at the path its move gives it;
// any other draft lands at `noteHome` of its own `repos` line. Null when the draft has no `target`, or its target needs no change.
// `moves` holds each file's `rel` path and its `dest`, absolute.
function newTarget(root, fm, moves) {
  if (typeof fm.target !== 'string') return null
  const old = todaysTarget(fm.target)
  if (fm.action === 'update' || fm.action === 'delete') {
    const note = moves.find(({ rel }) => rel === old.target)
    return note ? relativeTo(root, note.dest) : null
  }
  return relativeTo(root, join(noteHome(root, listOf(fm.repos).length ? listOf(fm.repos) : old.repos), basename(old.target)))
}

export function moveToClusters(folder, { dry = false } = {}) {
  const root = brainRootOf(folder)
  const at = pathsOf(root)
  const git = (...a) => spawnSync('git', ['-C', root, ...a], { encoding: 'utf8', windowsHide: true })
  const ls = git('ls-files', '-z')
  const tracked = new Set(ls.status === 0 ? ls.stdout.split('\0').filter(Boolean) : [])

  const moves = []
  const left = []
  for (const rel of walk(root)) {
    const dest = destOf(root, rel)
    if (dest) moves.push({ rel, dest })
    else if (rel.startsWith('repos/') && rel.split('/').length >= 3) left.push(rel)
  }
  // A leftover snapshot is a worktree folder of a linked clone, at repos/<slug>/snapshots.
  const old = { repos: join(root, 'repos'), reposJson: join(root, 'repos', 'repos.json'), snapshots: (slug) => join(root, 'repos', slug, 'snapshots') }
  const clones = clonesOf(old.reposJson)
  const snapshots = existsSync(old.repos) ? readdirSync(old.repos, { withFileTypes: true }).filter((e) => e.isDirectory() && existsSync(old.snapshots(e.name))).map((e) => e.name) : []
  const taken = new Set()
  for (const { rel, dest } of moves) {
    if (taken.has(dest) || existsSync(dest)) throw new Error(`cannot move ${rel}: ${relativeTo(root, dest)} already exists; nothing was changed`)
    taken.add(dest)
  }

  console.log(`Moving the one-folder brain in ${fwd(folder)} into the clusters layout`)
  for (const { rel, dest } of moves) console.log(`move ${rel} -> ${relativeTo(root, dest)}`)
  for (const rel of left) console.log(`leave ${rel}`)
  for (const slug of snapshots) console.log(`remove ${relativeTo(root, old.snapshots(slug))}: through its clone, never moved`)
  const drafts = moves.filter(({ dest }) => fwd(dest).startsWith(`${at.drafts}/`))
  const retargets = drafts.flatMap(({ rel, dest }) => {
    const text = readFileSync(join(root, rel), 'utf8')
    const fm = parse(text).fm
    const target = newTarget(root, fm, moves)
    return target && target !== fm.target ? [{ rel, dest, target, next: text.replace(/^(target:[ 	]*).*$/m, (_, key) => key + target) }] : []
  })
  for (const { rel, target } of retargets) console.log(`retarget ${rel}: target ${target}`)
  console.log(`write ${relativeTo(root, at.gitignore)}`)
  if (dry) return

  for (const slug of snapshots) removeSnapshot(old.snapshots(slug), clones[slug])
  for (const { rel, dest } of moves) {
    mkdirSync(dirname(dest), { recursive: true })
    if (tracked.has(rel)) {
      const r = git('mv', '--', rel, relativeTo(root, dest))
      if (r.status !== 0) throw new Error(`git mv ${rel} failed: ${r.stderr.trim()}`)
    } else renameSync(join(root, rel), dest)
  }
  for (const { dest, next } of retargets) writeFileSync(dest, next)
  const sources = new Set(moves.flatMap(({ rel }) => rel.split('/').slice(0, -1).map((_, i, d) => d.slice(0, i + 1).join('/'))))
  for (const dir of [...sources].sort((a, b) => b.length - a.length)) {
    try { rmdirSync(join(root, dir)) } catch {}
  }
  writeFileSync(at.gitignore, '.local/\n')
  console.log(`Moved ${moves.length} files.`)
}
