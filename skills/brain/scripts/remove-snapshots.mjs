// Removes the snapshots a skill left in an old brain, for the layout move: a snapshot is a git worktree of a linked clone, so it
// is removed through that clone (FORMAT.md's snapshot rule), never moved: a worktree loses its link to the clone when moved.
// A folder the clone no longer lists, or whose clone is not linked, holds committed work only and is deleted as it is.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'

// Each linked slug's clone path, from a `repos.json` (or an old `links.json`) path; `{}` when the file is missing or unreadable.
export function clonesOf(linksPath) {
  try {
    const links = JSON.parse(readFileSync(linksPath, 'utf8')) ?? {}
    return Object.fromEntries(Object.entries(links).flatMap(([slug, link]) => {
      const path = typeof link === 'string' ? link : link?.path
      return typeof path === 'string' && path ? [[slug, path]] : []
    }))
  } catch { return {} }
}

// Removes the snapshot folder `dir` through `clone` (a path, or undefined for a repository that is not linked).
export function removeSnapshot(dir, clone) {
  const git = (...a) => spawnSync('git', ['-C', clone, ...a], { encoding: 'utf8', windowsHide: true })
  if (clone && existsSync(clone)) git('worktree', 'remove', '--force', dir)
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
  if (clone && existsSync(clone)) git('worktree', 'prune')
}
