// Run: node --test skills/brain/scripts/notes-graph.test.mjs
// Runs brain.html's Notes graph block in Node (page-blocks.support.mjs) over a brain's data, and reads the nodes and edges it builds.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { graphOf } from './page-blocks.support.mjs'

// toData's shape for two notes linking each other, one of them linking a note nobody wrote.
const note = (id, links, repos, shared, relations = []) => ({ id, type: 'concept', description: '', links, relations, repos, shared, draft: null })
const DATA = {
  name: 'team', specs: [], repos: [], timeline: { commits: [] }, ghosts: ['unwritten'],
  notes: [note('billing', ['invoice', 'unwritten'], ['api'], false), note('invoice', ['billing'], ['api', 'web'], true)],
}

test('the graph has one node per note and one per ghost', () => {
  const { nodes } = graphOf(DATA)
  assert.deepEqual(nodes.map((d) => [d.id, d.kind]), [['billing', 'note'], ['invoice', 'note'], ['unwritten', 'ghost']])
})

test('two notes linking each other are joined by one edge', () => {
  const { links } = graphOf(DATA)
  assert.deepEqual(links.map((l) => [l.source.id, l.target.id]), [['billing', 'invoice'], ['billing', 'unwritten']])
})

// billing issues invoices and links a note nobody wrote; invoice links back to billing.
const RELATED = {
  ...DATA,
  notes: [note('billing', ['invoice', 'unwritten'], ['api'], false, [{ verb: 'issues', target: 'invoice' }]), note('invoice', ['billing'], ['api', 'web'], true)],
}
const edgeOf = (links, a, b) => links.filter((l) => [l.source.id, l.target.id].sort().join('|') === [a, b].sort().join('|'))

test('an edge built from a relation carries its verb', () => {
  const { links } = graphOf(RELATED)
  assert.deepEqual(edgeOf(links, 'billing', 'invoice').map((l) => l.verbs), [[{ from: 'billing', verb: 'issues' }]])
})

test('an edge from a plain link carries no verb', () => {
  const { links } = graphOf(RELATED)
  assert.deepEqual(edgeOf(links, 'billing', 'unwritten').map((l) => l.verbs), [[]])
})

test('a relation and a plain link between two notes make one edge', () => {
  const { links } = graphOf(RELATED)
  assert.deepEqual(edgeOf(links, 'billing', 'invoice').map((l) => l.verbs.length), [1])
})

test('a verb shows while a node of its edge is hovered, and goes when the pointer leaves', () => {
  const graph = graphOf(RELATED), seen = [graph.verbs()]
  graph.hover('billing'); seen.push(graph.verbs())
  graph.leave(); seen.push(graph.verbs())
  assert.deepEqual(seen, [[], ['billing issues invoice'], []])
})

test('a verb shows while a node of its edge is selected', () => {
  const graph = graphOf(RELATED)
  graph.select('invoice')
  assert.deepEqual(graph.verbs(), ['billing issues invoice'])
})

test('a verb of an edge away from the focused node stays hidden', () => {
  const graph = graphOf(RELATED)
  graph.hover('unwritten')
  assert.deepEqual(graph.verbs(), [])
})
