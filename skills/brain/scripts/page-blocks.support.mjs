// Test support: runs blocks of brain.html in Node over a stand-in for the browser's document. Used by brain-view.test.mjs
// and domain-screen.test.mjs.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// The working tree may hold CRLF line endings (git's core.autocrlf); the blocks are read with LF.
const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'brain.html'), 'utf8').replace(/\r\n/g, '\n')
export const section = (banner) => new RegExp(String.raw`// =+ ${banner}\n([\s\S]*?)</script>`).exec(html)[1]
export const GitRead = new Function(`${section('GIT READER')}\nreturn GitRead;`)()
export const BrainSource = new Function('GitRead', `${section('BRAIN SOURCE')}\nreturn BrainSource;`)(GitRead)

// An element that takes any call and any property, and keeps what is written to innerHTML.
export const element = () => new Proxy({ innerHTML: '', value: '', querySelectorAll: () => [], classList: { add() {}, remove() {}, contains: () => false }, style: { setProperty() {} }, dataset: {} }, {
  get: (o, k) => (k in o ? o[k] : typeof k === 'symbol' ? undefined : () => element()),
  set: (o, k, v) => { o[k] = v; return true },
})

// App over a page of stand-in elements, one per id; `shown` gives the elements by id, `click` the page's click handler,
// `location` the page's location, `Theme` its theme. The draft form in the details panel holds `draft`'s values, by field name. With
// `domain`, { fetch, viaServer, d3 }, the Domain screen's block is loaded as the page loads it, after the force layout.
export const appOf = ({ draft = {}, hash = '#/b/team/overview', domain = null } = {}) => {
  const shown = new Map(), listeners = new Map()
  const form = { querySelector: (selector) => ({ value: draft[selector.slice('[data-'.length, -1)] ?? '' }) }
  const document = {
    getElementById: (id) => { if (!shown.has(id)) shown.set(id, element()); return shown.get(id) },
    addEventListener: (type, listener) => listeners.set(type, listener),
    querySelectorAll: () => [], querySelector: (selector) => (selector === '#insp [data-draft]' ? form : element()), documentElement: element(),
  }
  const window = { addEventListener() {}, dispatchEvent() {}, innerWidth: 1200 }
  const location = { hash }
  const names = ['document', 'window', 'location', 'getComputedStyle', 'localStorage']
  const browser = [document, window, location, () => ({ getPropertyValue: () => '' }), { getItem: () => null, setItem() {} }]
  const Theme = new Function(...names, `${section('THE THEME')}\nreturn Theme;`)(...browser)
  const App = new Function('Theme', 'BrainSource', ...names, `${section('THE BRAIN VIEW')}\nreturn App;`)(Theme, BrainSource, ...browser)
  if (domain) {
    const ForceLayout = new Function(`${section('THE FORCE LAYOUT')}\nreturn ForceLayout;`)()
    new Function('App', 'ForceLayout', 'd3', 'fetch', 'viaServer', section('THE DOMAIN SCREEN'))(App, ForceLayout, domain.d3, domain.fetch, domain.viaServer)
  }
  return { App, Theme, shown, location, click: (button) => listeners.get('click')({ target: { closest: (selector) => (selector.includes('data-draft-save') ? button : null) } }) }
}
