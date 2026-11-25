// The one home of the brain's paths, so a layout change is one edit: pathsOf gives every path of a brain by its root.
// The brain root is the folder holding BRAIN.md: `<repo or host>/.brain/`. An old layout is found by oldLayoutOf only, to be offered
// MIGRATE.md's layout move; no other script reads its paths.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, join, relative } from 'node:path'

export const fwd = (p) => p.split('\\').join('/')

// A path relative to a folder, spelled with `/`.
export const relativeTo = (root, path) => fwd(relative(root, path))

// Every path of the layout tree under a brain root, as absolute paths with forward slashes.
export function pathsOf(root) {
  const at = (...parts) => fwd(join(root, ...parts))
  const repoDir = (slug) => at('repos', slug)
  return {
    root: fwd(root),
    brainMd: at('BRAIN.md'),
    gitignore: at('.gitignore'),
    config: at('config.json'),
    notes: at('notes'),
    authored: at('notes', 'authored'),
    explorations: at('notes', 'exploration'),
    exploration: (slug) => at('notes', 'exploration', slug),
    drafts: at('notes', 'drafts'),
    repos: at('repos'),
    reposJson: at('repos', 'repos.json'),
    repoDir,
    card: (slug) => `${repoDir(slug)}/REPO.md`,
    tours: (slug) => `${repoDir(slug)}/tours`,
    refactors: (slug) => `${repoDir(slug)}/refactors`,
    snapshots: (slug) => `${repoDir(slug)}/snapshots`,
    prototypes: at('prototypes'),
    research: at('research'),
    specs: at('specs'),
    explore: at('explore'),
    locks: at('locks'),
    handoff: at('handoff'),
  }
}

// The brain a folder holds: its `.brain/` holding BRAIN.md, or the folder itself when it holds BRAIN.md. Null when
// the folder holds none.
export function findBrain(folder) {
  const inner = join(folder, '.brain')
  if (existsSync(join(inner, 'BRAIN.md'))) return fwd(inner)
  if (existsSync(join(folder, 'BRAIN.md'))) return fwd(folder)
  return null
}

export const KINDS = new Set(['standalone', 'embedded', 'local'])

// The brain's kind, from the `kind` line in BRAIN.md's frontmatter. Null when the line is missing or names none.
export function kindOf(root) {
  const lines = readFileSync(join(root, 'BRAIN.md'), 'utf8').replace(/\r\n?/g, '\n').split('\n')
  if (lines[0]?.trim() !== '---') return null
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---')
  const line = lines.slice(1, end < 0 ? 0 : end).map((l) => /^kind:\s*(\S+)\s*$/.exec(l)).find(Boolean)
  return line && KINDS.has(line[1]) ? line[1] : null
}

// The brain's name: the last segment of its remote without `.git`, else the name of the folder holding `.brain/`
// (the folder itself for a brain not in a `.brain/`).
export function nameOf(root) {
  let remote = ''
  try {
    remote = execFileSync('git', ['-C', root, 'remote', 'get-url', 'origin'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }).trim()
  } catch {}
  const segment = remote.replace(/\/+$/, '').split(/[/:]/).at(-1).replace(/\.git$/, '')
  return segment || basename(basename(root) === '.brain' ? dirname(root) : root)
}

// The brain root above a spec folder: `<brain>/specs/NNN-<slug>` sits two levels below it.
export const brainOfSpec = (specDir) => fwd(dirname(dirname(specDir)))

// The old layout a folder holds, if any, as its kind: `embedded` (a `brain/` folder holding BRAIN.md), `local` (a
// `.brain-local/` folder), or, for a folder holding BRAIN.md at its root, `sdd` (a `.sdd/` folder, the old name of
// the pipeline's `.brain/`), `legacy` (no `notes/`) or `standalone`. Null for a new-layout brain or no brain.
export function oldLayoutOf(folder) {
  const has = (...parts) => existsSync(join(folder, ...parts))
  if (has('.brain', 'BRAIN.md') || basename(folder) === '.brain') return null
  if (has('brain', 'BRAIN.md')) return 'embedded'
  if (has('.brain-local', 'BRAIN.md')) return 'local'
  if (!has('BRAIN.md')) return null
  if (has('.sdd')) return 'sdd'
  return has('notes') ? 'standalone' : 'legacy'
}
