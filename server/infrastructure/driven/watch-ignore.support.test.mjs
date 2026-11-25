// Run: node --test server/infrastructure/driven/watch-ignore.support.test.mjs
// The paths a brain's watcher ignores: those its .gitignore ignores, except the drafts and the specs the page shows.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { watchIgnore } from './watch-ignore.support.mjs'

const SHOWN = ['notes/drafts', 'specs']
const gitignore = ['# this machine', 'config.json', 'notes/drafts/', 'repos/repos.json', 'repos/*/snapshots/', 'specs/', 'explore/', 'locks/', 'handoff/', '*.tmp', '!keep.tmp', ''].join('\n')

test('the watcher ignores what .gitignore ignores, except notes/drafts/ and specs/', () => {
  const ignored = watchIgnore(gitignore, SHOWN)
  const paths = [
    'locks/a.md', 'locks', 'explore/app/area/n.md', 'repos/app/snapshots/s.md', 'config.json', 'repos/repos.json', 'notes/x.tmp', 'keep.tmp',
    'notes/drafts/d.md', 'notes/drafts', 'specs/001-a/spec.md', 'notes/authored/a.md', 'repos/app/REPO.md', 'repos/app/tours/t.md',
  ]
  assert.deepEqual(
    Object.fromEntries(paths.map((p) => [p, ignored(p)])),
    {
      'locks/a.md': true, locks: true, 'explore/app/area/n.md': true, 'repos/app/snapshots/s.md': true, 'config.json': true, 'repos/repos.json': true, 'notes/x.tmp': true, 'keep.tmp': false,
      'notes/drafts/d.md': false, 'notes/drafts': false, 'specs/001-a/spec.md': false, 'notes/authored/a.md': false, 'repos/app/REPO.md': false, 'repos/app/tours/t.md': false,
    },
  )
})

test('a watcher with no .gitignore ignores nothing', () => {
  assert.equal(watchIgnore(null, SHOWN)('locks/a.md'), false)
})

test('the watcher shows the paths it is given, even when .gitignore ignores them', () => {
  const ignored = watchIgnore('locks/\nexplore/\n', ['locks'])
  assert.deepEqual([ignored('locks/a.md'), ignored('explore/a.md')], [false, true])
})
