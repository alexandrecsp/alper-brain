// Test support: runs blocks of brain.html in Node over a stand-in for the browser's document. Used by brain-view.test.mjs,
// domain-screen.test.mjs, page-data.test.mjs, notes-graph.test.mjs and note-copies.test.mjs.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// The working tree may hold CRLF line endings (git's core.autocrlf); the blocks are read with LF.
const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'brain.html'), 'utf8').replace(/\r\n/g, '\n')
export const section = (banner) => new RegExp(String.raw`// =+ ${banner}\n([\s\S]*?)</script>`).exec(html)[1]
export const GitRead = new Function(`${section('GIT READER')}\nreturn GitRead;`)()
export const BrainSource = new Function('GitRead', `${section('BRAIN SOURCE')}\nreturn BrainSource;`)(GitRead)

// THE PAGE block's parsing: toData turns a brain's files into the page's data (notes, links, ghosts, specs), over the folder source's layout.
const parsing = /\/\/ -+ parsing: a brain's files into App's data -+\n([\s\S]*?\n\}\n)(?=\n\/\/ -+ the brain list)/.exec(section('THE PAGE'))[1]
export const toData = new Function('BrainSource', `${parsing}\nreturn toData;`)(BrainSource)

// A stand-in for d3 that takes any call and gives back something that takes any call, apart from what the Notes graph block reads
// back: `rollup` groups as d3's does, `min` and `max` give numbers, `zoomTransform` the unzoomed one, `forceSimulation` keeps the nodes and `forceLink` the links the
// block settles, their ends turned into the nodes as d3's simulation does, `on` keeps each handler the block binds, and `data` keeps
// what the block binds to a selection made by `selectAll(selector)`, under that selector.
const chain = (selector, log) => new Proxy(function () {}, {
  get: (o, k) => {
    if (k === 'then' || typeof k === 'symbol') return undefined
    if (k === 'selectAll') return (s) => chain(s, log)
    if (k === 'data') return (items) => { if (selector) log.drawn.push([selector, items]); return chain(selector, log) }
    if (k === 'on') return (event, handler) => { log.handlers.push([event, handler]); return chain(selector, log) }
    return chain(selector, log)
  },
  apply: () => chain(selector, log),
})

// The Notes graph block, run as the page loads it: it registers its screen on `App`, which here only keeps it. `graphOf(D)` renders
// that screen over a brain's data and gives the graph the block built, `{ nodes, links }`: a node is `{ id, kind, cluster, deg }`
// ('note' or 'ghost'), a link `{ source, target, kind, verbs }` between two nodes, `verbs` the relations of its notes written
// along it. The graph answers a person's pointer: `hover(id)` and `leave()` move it over a node, `select(id)` selects a note, and
// `verbs()` gives the text of each verb the graph shows now.
export const graphOf = (D) => {
  const log = { drawn: [], handlers: [] }, settled = { nodes: [], links: [] }
  const d3 = new Proxy(chain(null, log), {
    get: (o, k) => ({
      rollup: (items, reduce, key) => { const by = new Map(); for (const i of items) { const k2 = key(i); by.set(k2, [...(by.get(k2) || []), i]) } return new Map([...by].map(([k2, v]) => [k2, reduce(v)])) },
      min: () => 0, max: () => 0, zoomTransform: () => ({ k: 1 }),
      forceSimulation: (nodes) => { settled.nodes = nodes; return chain(null, log) },
      forceLink: (links) => {
        const byId = new Map(settled.nodes.map((n) => [n.id, n]))
        for (const l of links) { l.source = byId.get(l.source); l.target = byId.get(l.target) }
        settled.links = links; return chain(null, log)
      },
    }[k] ?? chain(null, log)),
  })
  let screen
  const App = { register: (name, s) => { if (name === 'notes') screen = s } }
  const ForceLayout = new Function(`${section('THE FORCE LAYOUT')}\nreturn ForceLayout;`)()
  const block = /\/\/ Notes graph screen[\s\S]*?\n\}\)\(\);\n/.exec(section('THE SCREENS'))[0]
  const page = { createElement: element, querySelector: element }
  new Function('App', 'ForceLayout', 'd3', 'document', 'localStorage', 'requestAnimationFrame', 'Theme', block)(
    App, ForceLayout, d3, page, { getItem: () => null, setItem() {} }, () => 0, { color: () => '' })
  const show = (sel) => screen.render(element(), { D, q: '', repo: null, sel, select() {}, repoColor: () => '' })
  show(null)
  const bound = (event) => log.handlers.find(([e]) => e === event)[1]
  return {
    ...settled,
    hover: (id) => bound('mouseenter')({}, settled.nodes.find((n) => n.id === id)),
    leave: () => bound('mouseleave')(),
    select: (id) => show({ kind: 'note', id }),
    verbs: () => log.drawn.filter(([selector]) => selector === 'text.np-verb').at(-1)[1].map((v) => v.text),
  }
}

// An element that takes any call and any property, and keeps what is written to innerHTML.
export const element = () => new Proxy({ innerHTML: '', value: '', querySelectorAll: () => [], classList: { add() {}, remove() {}, contains: () => false }, style: { setProperty() {} }, dataset: {} }, {
  get: (o, k) => (k in o ? o[k] : typeof k === 'symbol' ? undefined : () => element()),
  set: (o, k, v) => { o[k] = v; return true },
})

// App over a page of stand-in elements, one per id; `shown` gives the elements by id, `click` the page's click handler,
// `location` the page's location, `Theme` its theme; `marked` gives the markdown back as it is. The draft form in the details panel holds `draft`'s values, by field name. With
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
  const marked = { parse: (text) => text }
  const App = new Function('Theme', 'BrainSource', 'marked', ...names, `${section('THE BRAIN VIEW')}\nreturn App;`)(Theme, BrainSource, marked, ...browser)
  if (domain) {
    const ForceLayout = new Function(`${section('THE FORCE LAYOUT')}\nreturn ForceLayout;`)()
    new Function('App', 'ForceLayout', 'd3', 'fetch', 'viaServer', section('THE DOMAIN SCREEN'))(App, ForceLayout, domain.d3, domain.fetch, domain.viaServer)
  }
  return { App, Theme, shown, location, click: (button) => listeners.get('click')({ target: { closest: (selector) => (selector.includes('data-draft-save') ? button : null) } }) }
}
