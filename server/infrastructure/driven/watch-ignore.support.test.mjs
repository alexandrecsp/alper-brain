// Run: node --test server/infrastructure/driven/watch-ignore.support.test.mjs
// The paths a brain's watcher ignores: those its .gitignore ignores, except the drafts and the specs the page shows.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { watchIgnore } from './watch-ignore.support.mjs'

const SHOWN = ['.local/drafts', '.local/specs']
const gitignore = ['# this machine', '.local/', '*.tmp', '!keep.tmp', ''].join('\n')

test('the watcher ignores what .gitignore ignores, except .local/drafts/ and .local/specs/', () => {
  const ignored = watchIgnore(gitignore, SHOWN)
  const paths = [
    '.local/locks/a.md', '.local/locks', '.local/explore/app/area/n.md', '.local/snapshots/app/s.md', '.local/config.json', '.local/repos.json', 'notes/shared/x.tmp', 'keep.tmp',
    '.local/drafts/d.md', '.local/drafts', '.local/specs/001-a/spec.md', 'notes/repos/app/a.md', 'repos/app.md',
  ]
  assert.deepEqual(
    Object.fromEntries(paths.map((p) => [p, ignored(p)])),
    {
      '.local/locks/a.md': true, '.local/locks': true, '.local/explore/app/area/n.md': true, '.local/snapshots/app/s.md': true, '.local/config.json': true, '.local/repos.json': true, 'notes/shared/x.tmp': true, 'keep.tmp': false,
      '.local/drafts/d.md': false, '.local/drafts': false, '.local/specs/001-a/spec.md': false, 'notes/repos/app/a.md': false, 'repos/app.md': false,
    },
  )
})

test('a watcher with no .gitignore ignores nothing', () => {
  assert.equal(watchIgnore(null, SHOWN)('.local/locks/a.md'), false)
})

test('the watcher shows the paths it is given, even when .gitignore ignores them', () => {
  const ignored = watchIgnore('locks/\nexplore/\n', ['locks'])
  assert.deepEqual([ignored('locks/a.md'), ignored('explore/a.md')], [false, true])
})
