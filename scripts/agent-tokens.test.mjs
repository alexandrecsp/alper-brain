// Run: node --test scripts/agent-tokens.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// A trace.jsonl of one sub-agent that reads each path once, then reports how agent-tokens.mjs classified the reads.
const kindsOfReads = (paths) => {
  const line = (e) => JSON.stringify(e)
  const trace = [
    line({ type: 'assistant', message: { id: 'm0', content: [{ type: 'tool_use', id: 'agent', name: 'Agent', input: { subagent_type: 'alper-brain:builder' } }] } }),
    ...paths.flatMap((path, i) => [
      line({ type: 'assistant', parent_tool_use_id: 'agent', message: { id: `a${i}`, usage: { input_tokens: 10, output_tokens: 1 }, content: [{ type: 'tool_use', id: `r${i}`, name: 'Read', input: { file_path: path } }] } }),
      line({ type: 'user', parent_tool_use_id: 'agent', message: { content: [{ type: 'tool_result', tool_use_id: `r${i}`, content: 'x'.repeat(400) }] } }),
    ]),
  ].join('\n')
  const file = join(mkdtempSync(join(tmpdir(), 'agent-tokens-')), 'trace.jsonl')
  writeFileSync(file, trace)
  const r = spawnSync('node', [join(import.meta.dirname, 'agent-tokens.mjs'), file], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  return r.stdout
}

test('counts a read of .local/specs/ as a ticket read and a milestone read as a spec read', () => {
  const out = kindsOfReads(['C:/work/.brain/.local/specs/001-x/milestones/api/001-m/002-t.md', 'C:/work/.brain/.local/specs/001-x/spec.md'])
  assert.match(out, /read:ticket\s+1\.0/)
  assert.match(out, /read:spec\/milestone\/review\s+1\.0/)
})

test('counts a read of notes/, repos/ and docs/ as a brain-notes read', () => {
  const out = kindsOfReads(['C:/work/.brain/notes/shared/a.md', 'C:/work/.brain/repos/api.md', 'C:/work/.brain/docs/shared/b.md'])
  assert.match(out, /read:brain-notes\s+3\.0/)
})

test('counts a read under notes/domain/ as a repository-docs read, beside the other brain notes it leaves as brain notes', () => {
  const out = kindsOfReads(['C:/work/.brain/notes/domain/customer.md', 'C:/work/.brain/notes/shared/a.md'])
  assert.match(out, /read:repo-docs\s+1\.0/)
  assert.match(out, /read:brain-notes\s+1\.0/)
})
