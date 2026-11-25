// Run: node --test skills/brain/scripts/layout-copies.test.mjs
// The places that keep a copy of layout.mjs's paths, since they cannot import it, checked against layout.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pathsOf } from './layout.mjs'

// The working tree may hold CRLF line endings (git's core.autocrlf); the blocks are read with LF.
const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'brain.html'), 'utf8').replace(/\r\n/g, '\n')
const GitRead = new Function(`${/\/\/ =+ GIT READER\n([\s\S]*?)<\/script>/.exec(html)[1]}\nreturn GitRead;`)()
const BrainSource = new Function('GitRead', `${/\/\/ =+ BRAIN SOURCE\n([\s\S]*?)<\/script>/.exec(html)[1]}\nreturn BrainSource;`)(GitRead)

// The pane is TypeScript, which the Node of the checks cannot import: its LAYOUT object is read from the source, its
// types dropped.
const paneSource = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'hooks', 'brain.ts'), 'utf8').replace(/\r\n/g, '\n')
const PANE_LAYOUT = new Function(`return ${/export const LAYOUT = (\{[\s\S]*?\n\})/.exec(paneSource)[1].replace(/\(slug: string\)/g, '(slug)')}`)()

const SLUG = 'api'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), 'a-host', '.brain')

// The paths named by `keys`, a repository's by `SLUG`, each as `toPath` gives it.
const pathsNamed = (paths, keys, toPath) => Object.fromEntries(keys.map((key) => [key, toPath(typeof paths[key] === 'function' ? paths[key](SLUG) : paths[key])]))

// Every key of a copy, as layout.mjs gives it, relative to the brain root.
const matchesLayout = (copy) => {
  const keys = Object.keys(copy)
  const fromLayout = pathsNamed(pathsOf(ROOT), keys, (path) => (path === undefined ? path : relative(ROOT, path).split('\\').join('/')))
  assert.deepEqual(pathsNamed(copy, keys, (path) => path), fromLayout)
}

test("the page's copy of the layout's paths matches layout.mjs", () => {
  matchesLayout(BrainSource.LAYOUT)
})

test("the pane's copy of the layout's paths matches layout.mjs", () => {
  assert.ok(Object.keys(PANE_LAYOUT).length > 0)
  matchesLayout(PANE_LAYOUT)
})
