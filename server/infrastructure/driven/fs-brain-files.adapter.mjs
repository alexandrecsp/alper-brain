import { mkdirSync, readFileSync, readdirSync, statSync, watch, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { pathsOf, relativeTo } from '../../../skills/brain/scripts/layout.mjs'
import { watchIgnore } from './watch-ignore.support.mjs'

const POLL_MS = 2000
const SETTLE_MS = 100

const readText = (path) => {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

// Every `.md` under `dir` as `prefix + relative path`, into `files`, and each one's last change in ms into `times` when given.
// A folder that is missing holds nothing, and a file that vanishes while it is read is left out.
const walk = (dir, prefix, files, times) => {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const path = resolve(dir, entry.name)
    if (entry.isDirectory()) walk(path, `${prefix}${entry.name}/`, files, times)
    else if (entry.name.endsWith('.md')) {
      const text = readText(path)
      if (text === null) continue
      files[prefix + entry.name] = text
      if (times) times[prefix + entry.name] = Math.floor(statSync(path).mtimeMs)
    }
  }
}

// A brain's specs with times, the notes of its repositories and shared ones, its drafts, every card and `.local/repos.json`, as paths
// relative to the brain. It reads no research note and no doc.
const all = (root) => {
  const at = pathsOf(root)
  const files = {}
  const times = {}
  const under = (dir, withTimes) => walk(dir, `${relativeTo(root, dir)}/`, files, withTimes ? times : undefined)
  under(at.specs, true)
  under(at.repoNotesRoot)
  under(at.sharedNotes)
  under(at.drafts)
  let cards = []
  try {
    cards = readdirSync(at.repos, { withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith('.md')).map((e) => resolve(at.repos, e.name))
  } catch { /* no repos folder holds nothing */ }
  for (const file of [...cards, at.reposJson]) {
    const text = readText(file)
    if (text !== null) files[relativeTo(root, file)] = text
  }
  return { files, times }
}

// Rereads the brain every `POLL_MS`; returns the function that stops it.
const poll = (root, onChange) => {
  const timer = setInterval(() => onChange(all(root)), POLL_MS)
  return () => clearInterval(timer)
}

// Rereads the brain once its files have been quiet for `SETTLE_MS`, so changes that land close together make one call. It polls
// instead when recursive `fs.watch` is not available, as on Linux with Node older than 20, or stops working.
const watchRecursively = (root, onChange) => {
  // A brain leaves alone what its `.gitignore` ignores, read afresh since the file may change.
  const shown = [pathsOf(root).drafts, pathsOf(root).specs].map((path) => relativeTo(root, path))
  const ignored = (name) => watchIgnore(readText(pathsOf(root).gitignore), shown)(name)
  let settle
  let stopPolling
  let watcher
  try {
    watcher = watch(root, { recursive: true }, (_, name) => {
      if (name?.split(/[\\/]/)[0] === '.git') return
      if (name && ignored(name.split(/[\\/]/).join('/'))) return
      clearTimeout(settle)
      settle = setTimeout(() => onChange(all(root)), SETTLE_MS)
    })
    watcher.on('error', () => {
      watcher.close()
      stopPolling = poll(root, onChange)
    })
  } catch {
    return poll(root, onChange)
  }
  return () => {
    clearTimeout(settle)
    watcher.close()
    stopPolling?.()
  }
}

// The brain files port over `node:fs`. `recursiveWatch: false` makes it poll, as a platform without recursive `fs.watch` does.
export const fsBrainFiles = ({ recursiveWatch = true } = {}) => ({
  all,
  read: (root, path) => readText(resolve(root, path)),
  write(root, path, text) {
    const file = resolve(root, path)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, text)
  },
  watch: recursiveWatch ? watchRecursively : poll,
})
