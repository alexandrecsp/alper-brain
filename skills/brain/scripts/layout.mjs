// The one home of the brain's paths, so a layout change is one edit: pathsOf gives every path of a brain by its root.
// The brain root is the folder holding BRAIN.md: `<repo or host>/.brain/`. An old layout is found by oldLayoutOf only, to be offered
// MIGRATE.md's layout move; only the layout move's scripts, build's sdd.mjs (STRUCTURE.md names its exception) and the
// note history's service read an old layout's paths.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, dirname, join, relative } from 'node:path'

export const fwd = (p) => p.split('\\').join('/')

// A path relative to a folder, spelled with `/`.
export const relativeTo = (root, path) => fwd(relative(root, path))

// Every path of the layout tree under a brain root, as absolute paths with forward slashes.
export function pathsOf(root) {
  const at = (...parts) => fwd(join(root, ...parts))
  return {
    root: fwd(root),
    brainMd: at('BRAIN.md'),
    gitignore: at('.gitignore'),
    repos: at('repos'),
    card: (slug) => at('repos', `${slug}.md`),
    notes: at('notes'),
    repoNotesRoot: at('notes', 'repos'),
    repoNotes: (slug) => at('notes', 'repos', slug),
    sharedNotes: at('notes', 'shared'),
    research: at('notes', 'research'),
    docs: at('docs'),
    repoDocs: (slug) => at('docs', 'repos', slug),
    sharedDocs: at('docs', 'shared'),
    prototypes: at('docs', 'prototypes'),
    local: at('.local'),
    config: at('.local', 'config.json'),
    reposJson: at('.local', 'repos.json'),
    drafts: at('.local', 'drafts'),
    specs: at('.local', 'specs'),
    snapshots: (slug) => at('.local', 'snapshots', slug),
    explore: at('.local', 'explore'),
    locks: at('.local', 'locks'),
    handoff: at('.local', 'handoff'),
  }
}

// The folder an authored note belongs in, by its `repos` list: its repository's notes for a list of one slug, else notes/shared/.
export const noteHome = (root, repos) => {
  const at = pathsOf(root)
  return repos.length === 1 ? at.repoNotes(repos[0]) : at.sharedNotes
}

// The brain root of a folder that is a host or a `.brain/` itself: the `.brain/` folder, with forward slashes. It need not exist.
export const brainRootOf = (folder) => fwd(basename(folder) === '.brain' ? folder : join(folder, '.brain'))

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

// The brain root above a spec folder: `<brain>/.local/specs/NNN-<slug>` sits three levels below it.
export const brainOfSpec = (specDir) => fwd(dirname(dirname(dirname(specDir))))

// The spec folder holding a spec, track, milestone or ticket path: the folder straight under the brain's `.local/specs/`.
// The last `specs` folder of the path holds the spec, so a `specs` folder above the brain does not count. Null when the path has none.
export function specFolderOf(path) {
  const parts = fwd(path).split('/')
  const specsIndex = parts.findLastIndex((part, i) => part === 'specs' && i + 1 < parts.length)
  return specsIndex < 0 ? null : parts.slice(0, specsIndex + 2).join('/')
}

// The old layout a folder holds, if any, as its kind: `embedded` (a `brain/` folder holding BRAIN.md), `local` (a
// `.brain-local/` folder), or, for a folder holding BRAIN.md at its root, `sdd` (a `.sdd/` folder, the old name of
// the pipeline's `.brain/`), `legacy` (no `notes/`) or `standalone`. A `.brain/` holding the layout before the clusters, by the host or by
// the `.brain/` itself, is `one-folder`. Null for a clusters brain or no brain.
export function oldLayoutOf(folder) {
  const has = (...parts) => existsSync(join(folder, ...parts))
  const root = brainRootOf(folder)
  const inRoot = (...parts) => existsSync(join(root, ...parts))
  const cards = () => readdirSync(join(root, 'repos'), { withFileTypes: true }).some((e) => e.isDirectory() && inRoot('repos', e.name, 'REPO.md'))
  if (inRoot('BRAIN.md') && (inRoot('notes', 'authored') || inRoot('notes', 'exploration') || inRoot('specs') || (inRoot('repos') && cards()))) return 'one-folder'
  if (inRoot('BRAIN.md') || basename(folder) === '.brain') return null
  if (has('brain', 'BRAIN.md')) return 'embedded'
  if (has('.brain-local', 'BRAIN.md')) return 'local'
  if (!has('BRAIN.md')) return null
  if (has('.sdd')) return 'sdd'
  return has('notes') ? 'standalone' : 'legacy'
}
