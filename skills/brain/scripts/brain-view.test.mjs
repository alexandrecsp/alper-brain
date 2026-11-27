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

// App over a page of stand-in elements, one per id; `shown` gives the elements by id, `click` the page's click handler. The
// draft form in the details panel holds `draft`'s values, by field name.
const appOf = ({ draft = {} } = {}) => {
  const shown = new Map(), listeners = new Map()
  const form = { querySelector: (selector) => ({ value: draft[selector.slice('[data-'.length, -1)] ?? '' }) }
  const document = {
    getElementById: (id) => { if (!shown.has(id)) shown.set(id, element()); return shown.get(id) },
    addEventListener: (type, listener) => listeners.set(type, listener),
    querySelectorAll: () => [], querySelector: (selector) => (selector === '#insp [data-draft]' ? form : element()), documentElement: element(),
  }
  const window = { addEventListener() {}, dispatchEvent() {}, innerWidth: 1200 }
  const location = { hash: '#/b/team/overview' }
  const names = ['document', 'window', 'location', 'getComputedStyle', 'localStorage']
  const browser = [document, window, location, () => ({ getPropertyValue: () => '' }), { getItem: () => null, setItem() {} }]
  const Theme = new Function(...names, `${section('THE THEME')}\nreturn Theme;`)(...browser)
  const App = new Function('Theme', 'BrainSource', ...names, `${section('THE BRAIN VIEW')}\nreturn App;`)(Theme, BrainSource, ...browser)
  return { App, shown, click: (button) => listeners.get('click')({ target: { closest: (selector) => (selector.includes('data-draft-save') ? button : null) } }) }
}

const DATA = { name: 'team', specs: [], repos: [], notes: [{ id: 'known', links: ['unwritten'], repos: [] }], ghosts: ['unwritten'], timeline: { commits: [] } }

test('the draft form of a note not written yet renders, naming the layout drafts folder', () => {
  const { App, shown } = appOf()
  App.load('team', DATA, { edit: async () => {} })
  App.state.sel = { kind: 'ghost', id: 'unwritten' }
  App.render()
  assert.match(shown.get('insp').innerHTML, new RegExp(`into ${BrainSource.LAYOUT.drafts}/ ·`))
})

// The draft the page saves when its form is saved: the path and the text it writes, over an edit that finds no file there.
const savedDraft = async (draft, repos = [{ slug: 'api' }, { slug: 'web' }]) => {
  const { App, click } = appOf({ draft })
  const saved = []
  App.load('team', { ...DATA, repos }, { edit: async (path, change) => saved.push({ path, text: change(undefined) }) })
  await click({ dataset: { draftSave: 'unwritten' } })
  return saved
}
const FORM = { type: 'concept', layer: 'application', description: 'One line', body: 'The fact.' }

test("a draft of one repository lands in .local/drafts with its target in that repository's notes", async () => {
  const [draft] = await savedDraft({ ...FORM, repos: 'api' })
  assert.deepEqual([draft.path, /^target: (.*)$/m.exec(draft.text)[1]], ['.local/drafts/unwritten.md', 'notes/repos/api/unwritten.md'])
})

test("a draft of several repositories lands in .local/drafts with its target in the shared notes", async () => {
  const [draft] = await savedDraft({ ...FORM, repos: 'api, web' })
  assert.deepEqual([draft.path, /^target: (.*)$/m.exec(draft.text)[1]], ['.local/drafts/unwritten.md', 'notes/shared/unwritten.md'])
})
