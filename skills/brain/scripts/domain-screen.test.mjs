// Run: node --test skills/brain/scripts/domain-screen.test.mjs
// Runs brain.html's THE DOMAIN SCREEN block in Node, over App and a stand-in for the browser's document, and reads what the
// screen draws from the domain route's JSON.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { appOf } from './page-blocks.support.mjs'

const CUSTOMER = {
  name: 'customer',
  description: 'A Customer is a person or company that buys from us',
  repos: ['billing-api', 'web-app'],
  aliases: ['cliente'],
  avoid: ['client'],
  pairings: [
    { repo: 'billing-api', word: 'Customer', degree: 'narrower', nuance: 'Only who has paid at least once', avoid: ['buyer'] },
    { repo: 'web-app', context: 'checkout', word: 'User', degree: 'broader', nuance: 'Anyone signed up', avoid: [] },
  ],
  relations: [{ verb: 'places', target: 'order' }, { verb: 'is a', target: 'party' }],
  decisions: ['retry-idempotency'],
}
const ORDER = {
  name: 'order', description: 'What a Customer buys', repos: ['billing-api'], aliases: [], avoid: [],
  pairings: [{ repo: 'billing-api', word: 'Order', degree: 'same', avoid: [] }], relations: [], decisions: ['retry-idempotency'],
}
const MAP = { terms: [CUSTOMER, ORDER] }

const DATA = { name: 'team', specs: [], repos: [{ slug: 'billing-api' }, { slug: 'web-app' }], notes: [], ghosts: [], timeline: { commits: [] } }

// d3 takes any call and gives back something that takes any call: the layout has nothing to settle, so each node stays where the screen put it.
const chain = () => new Proxy(function () {}, { get: (o, k) => (k === 'then' ? undefined : chain()), apply: () => chain() })

// The page on the Domain screen, its route answering `map` (or what `fetch` answers); `fetched` lists the paths asked.
const pageOf = ({ viaServer = true, map = MAP, hash = '#/b/team/domain' } = {}) => {
  const fetched = []
  const fetch = async (path) => { fetched.push(path); if (fetch.fail) throw new Error('the server is gone'); return { ok: true, json: async () => map } }
  const page = appOf({ hash, domain: { fetch, viaServer, d3: chain() } })
  const settle = () => new Promise((resolve) => setImmediate(resolve))
  return { ...page, fetch, fetched, settle, screen: () => page.shown.get('screen').innerHTML }
}
const shownFor = async (options) => {
  const page = pageOf(options)
  page.App.load('team', DATA, { edit: async () => {} })
  await page.settle()
  return page
}
const all = (text, pattern) => [...text.matchAll(pattern)].map((m) => m[1])

test("the screen draws one node per term of the route's JSON", async () => {
  const page = await shownFor()
  assert.deepEqual(all(page.screen(), /data-node="term\|([^"]+)"/g), ['customer', 'order'])
})

test('the screen draws one edge per relation, labelled with its verb', async () => {
  const page = await shownFor()
  const edges = [...page.screen().matchAll(/<g data-edge="([^"]+)">.*?<text[^>]*>([^<]*)<\/text>/gs)].map((m) => [m[1], m[2]])
  assert.deepEqual(edges, [['customer|places|order', 'places'], ['customer|is a|party', 'is a']])
})

test('the screen draws one node per decision, linked to the terms it binds', async () => {
  const screen = (await shownFor()).screen()
  assert.deepEqual(
    [all(screen, /data-node="decision\|([^"]+)"/g), all(screen, /data-link="decision\|retry-idempotency\|([^"]+)"/g)],
    [['retry-idempotency'], ['customer', 'order']],
  )
})

// The screen after the user selects a node, as the page's click handler reads it: `node` is the node's data-node value.
const selecting = async (node) => {
  const page = await shownFor()
  page.shown.get('screen').onclick({ target: { closest: () => ({ dataset: { node } }) } })
  return page
}
const inspectorOf = (page) => /<aside data-inspector[^>]*>(.*?)<\/aside>/s.exec(page.screen())[1]
const plain = (markup) => markup.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

test("selecting a term shows its pairings as chips in their repositories' colours", async () => {
  const page = await selecting('term|customer')
  const chips = [...inspectorOf(page).matchAll(/<div data-pairing="([^"]+)"[^>]*>(.*?)<\/div>/gs)].map((m) => ({ repo: m[1], color: /color-mix\(in srgb, (.+?) 16%, transparent/.exec(m[2])[1], text: plain(m[2]) }))
  assert.deepEqual(chips, [
    { repo: 'billing-api', color: page.Theme.color(0), text: 'billing-api: Customer (narrower) Only who has paid at least once' },
    { repo: 'web-app', color: page.Theme.color(1), text: 'web-app · checkout: User (broader) Anyone signed up' },
  ])
})

test('selecting a term shows its definition, avoided words, relations and decisions', async () => {
  const page = await selecting('term|customer')
  const sections = [...inspectorOf(page).matchAll(/<section data-section="([^"]+)"[^>]*>(.*?)<\/section>/gs)].map((m) => [m[1], plain(m[2])])
  assert.deepEqual(sections.filter(([name]) => name !== 'Pairings'), [
    ['Definition', 'Definition A Customer is a person or company that buys from us'],
    ['Avoid', 'Avoid client buyer (billing-api)'],
    ['Relations', 'Relations places → order is a → party'],
    ['Decisions', 'Decisions retry-idempotency'],
  ])
})

test('over file:/// the screen says it needs the brain server and draws no graph', async () => {
  const page = await shownFor({ viaServer: false })
  assert.deepEqual(
    { needsServer: /needs the brain server/.test(page.screen()), graph: page.screen().includes('<svg'), fetched: page.fetched },
    { needsServer: true, graph: false, fetched: [] },
  )
})

test('a render over the same data reads the route once, and a reload of the brain reads it again', async () => {
  const page = await shownFor()
  page.App.render()
  await page.settle()
  const rendered = page.fetched.length
  page.App.load('team', { ...DATA }, { edit: async () => {} })
  await page.settle()
  assert.deepEqual([rendered, page.fetched.length], [1, 2])
})

test('the Domain screen sits in the navigation beside the other screens', async () => {
  const page = pageOf()
  for (const screen of ['overview', 'board', 'notes', 'activity']) page.App.register(screen, { render() {} })
  page.App.load('team', DATA, { edit: async () => {} })
  const nav = page.shown.get('nav').innerHTML
  assert.deepEqual([...nav.matchAll(/data-go="([^"]+)"/g)].map((m) => m[1]), ['overview', 'board', 'notes', 'domain', 'activity'])
})

test('selecting a decision lists the terms it binds', async () => {
  const page = await selecting('decision|retry-idempotency')
  assert.equal(plain(inspectorOf(page)), 'retry-idempotency Terms customer order')
})

test('a route that cannot be read leaves a message in place of the graph', async () => {
  const page = pageOf()
  page.fetch.fail = true
  page.App.load('team', DATA, { edit: async () => {} })
  await page.settle()
  assert.deepEqual([/could not read the domain map/.test(page.screen()), page.screen().includes('<svg')], [true, false])
})

test('a brain with no term yet says so and draws no graph', async () => {
  const page = await shownFor({ map: { terms: [] } })
  assert.deepEqual([/no term yet/.test(page.screen()), page.screen().includes('<svg')], [true, false])
})
