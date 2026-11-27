// Run: node --test skills/brain/scripts/brain-view.test.mjs
// Runs brain.html's THE BRAIN VIEW block in Node over a stand-in for the browser's document, and reads what the details
// panel draws.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// The working tree may hold CRLF line endings (git's core.autocrlf); the blocks are read with LF.
const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'brain.html'), 'utf8').replace(/\r\n/g, '\n')
const section = (banner) => new RegExp(String.raw`// =+ ${banner}\n([\s\S]*?)</script>`).exec(html)[1]
const GitRead = new Function(`${section('GIT READER')}\nreturn GitRead;`)()
const BrainSource = new Function('GitRead', `${section('BRAIN SOURCE')}\nreturn BrainSource;`)(GitRead)

// An element that takes any call and any property, and keeps what is written to innerHTML.
const element = () => new Proxy({ innerHTML: '', value: '', querySelectorAll: () => [], classList: { add() {}, remove() {}, contains: () => false }, style: { setProperty() {} }, dataset: {} }, {
  get: (o, k) => (k in o ? o[k] : typeof k === 'symbol' ? undefined : () => element()),
  set: (o, k, v) => { o[k] = v; return true },
})

// App over a page of stand-in elements, one per id; `shown` gives the elements by id.
const appOf = () => {
  const shown = new Map()
  const document = { getElementById: (id) => { if (!shown.has(id)) shown.set(id, element()); return shown.get(id) }, addEventListener() {}, querySelectorAll: () => [], querySelector: () => element(), documentElement: element() }
  const window = { addEventListener() {}, dispatchEvent() {}, innerWidth: 1200 }
  const location = { hash: '#/b/team/overview' }
  const names = ['document', 'window', 'location', 'getComputedStyle', 'localStorage']
  const browser = [document, window, location, () => ({ getPropertyValue: () => '' }), { getItem: () => null, setItem() {} }]
  const Theme = new Function(...names, `${section('THE THEME')}\nreturn Theme;`)(...browser)
  const App = new Function('Theme', 'BrainSource', ...names, `${section('THE BRAIN VIEW')}\nreturn App;`)(Theme, BrainSource, ...browser)
  return { App, shown }
}

const DATA = { name: 'team', specs: [], repos: [], notes: [{ id: 'known', links: ['unwritten'], repos: [] }], ghosts: ['unwritten'], timeline: { commits: [] } }

test('the draft form of a note not written yet renders, naming the layout drafts folder', () => {
  const { App, shown } = appOf()
  App.load('team', DATA, { edit: async () => {} })
  App.state.sel = { kind: 'ghost', id: 'unwritten' }
  App.render()
  assert.match(shown.get('insp').innerHTML, new RegExp(`into ${BrainSource.LAYOUT.drafts}/ ·`))
})
