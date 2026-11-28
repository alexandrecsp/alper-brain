// Run: node --test skills/brain/scripts/brain-view.test.mjs
// Runs brain.html's THE BRAIN VIEW block in Node over a stand-in for the browser's document (page-blocks.support.mjs), and
// reads what the details panel draws.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BrainSource, appOf, toData } from './page-blocks.support.mjs'

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

test('a draft of a term lands in .local/drafts with its target in the domain notes', async () => {
  const [draft] = await savedDraft({ ...FORM, type: 'term', layer: 'business', repos: 'api, web' })
  assert.deepEqual([draft.path, /^target: (.*)$/m.exec(draft.text)[1]], ['.local/drafts/unwritten.md', 'notes/domain/unwritten.md'])
})

test('the details panel shows business for a feature with no layer line', () => {
  const files = new Map([['notes/repos/api/billing.md', '---\ntype: feature\ndescription: Billing\n---\nBilling.\n']])
  const { App, shown } = appOf()
  App.load('team', toData('team', files), { edit: async () => {} })
  App.state.sel = { kind: 'note', id: 'billing' }
  App.render()
  assert.match(shown.get('insp').innerHTML, />Layer<[\s\S]*?>business</)
})

test('a draft of a term has no layer line', async () => {
  const [draft] = await savedDraft({ ...FORM, type: 'term', layer: 'business', repos: 'api, web' })
  assert.doesNotMatch(draft.text, /^layer:/m)
})

test('a draft of a decision keeps the layer chosen', async () => {
  const [draft] = await savedDraft({ ...FORM, type: 'decision', layer: 'business', repos: 'api, web' })
  assert.match(draft.text, /^layer: business$/m)
})
