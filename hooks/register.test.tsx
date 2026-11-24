import { expect, test } from 'claude-code/testing'

import { brainOfPath, findBrain, readBrain } from './brain'
import type { Files } from './brain'
import { trackState } from './draw'
import { areaOf } from './register'

const PANE = {
  plugin: 'alper-brain',
  component: 'Pane',
  requestId: 'agent-watcher',
  props: { title: 'Agent Watcher', isFocused: false, bodyColumns: 70, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
} as const

const USAGE = { model: 'claude-sonnet-5-5', input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 8000, cache_creation_input_tokens: 500 }

test('rooms follow what a call touches', () => {
  expect(areaOf('Bash', { command: 'git status' })).toBe('git')
  expect(areaOf('Bash', { command: 'npm test' })).toBe('tests')
  expect(areaOf('Edit', { file_path: 'src/a.ts' })).toBe('code')
  expect(areaOf('Edit', { file_path: 'C:/r/.brain/x.md' })).toBe('brain')
  expect(areaOf('Read', { file_path: 'README.md' })).toBe('docs')
  expect(areaOf('Edit', { file_path: 'src/a.ts' }, 'reviewer')).toBe('review')
})

test("a subagent at work lights its room, on every surface", async ($, on) => {
  const time = { at: 1_000_000 }
  const stored: Record<string, unknown> = {}
  on('clock.now', () => ({ value: time.at }))
  on('clock.every', () => ({ value: undefined }))
  on('clock.after', () => ({ value: undefined }))
  on('store.get', (_, e) => ({ value: stored[e.key] }))
  on('store.set', (_, e) => {
    stored[e.key] = e.value
    return { value: undefined }
  })
  on('command.register', () => ({ value: { command: 'watcher' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: 'a1' }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.step', async function* (_, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [{ name: 'Edit', input: { file_path: 'src/map.ts' } }], stopReason: 'tool_use' as const, usage: USAGE }
  })
  on('tool.call', () => ({ result: {} }))

  await $.session.start({ cwd: '/', surface: 'vscode', isInteractive: true })
  await $.agent.spawn({ tool_use_id: 'tu1', prompt: 'Map', description: 'Map columns', subagentType: 'alper-brain:builder', parentModel: 'claude-opus-5-5', background: true, fork: false } as never)
  await $.turn.start({ text: 'Map', turnId: 't1', agentId: 'a1' })
  for await (const _ of $.turn.step({ turnId: 't1', index: 0, model: 'claude-sonnet-5-5', messageCount: 1, agentId: 'a1' })) {
  }
  await $.tool.call({ tool: 'Edit', file_path: 'src/map.ts', old_string: 'a', new_string: 'b', agentId: 'a1' })

  const term = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await term.find({ type: 'Text', text: /^Code\s+100% 10k$/ })).toBeDefined()
  expect(await term.find({ type: 'Text', text: /● builder · code · edit map\.ts/ })).toBeDefined()
  await term.unmount()

  for (const surface of ['desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const svg = await ui.find({ type: 'Svg' })
    const source = String((svg?.props as { source?: string } | undefined)?.source ?? '')
    expect(source.startsWith('<svg')).toBe(true)
    expect(source.length).toBeLessThan(131072)
    expect(source).toContain('edit map.ts')
    expect(String((svg?.props as { alt?: string }).alt)).toContain('builder in code, edit map.ts')
    await ui.unmount()
  }
})

/** A folder of files held in memory: each key a file's path, its value the text. */
const filesOf = (tree: Record<string, string>): Files => {
  const paths = Object.keys(tree)
  return {
    exists: async p => paths.some(k => k === p || k.startsWith(`${p}/`)),
    read: async p => {
      const text = tree[p]
      if (text === undefined) throw new Error(`ENOENT ${p}`)
      return text
    },
    list: async p => {
      const seen = new Map<string, 'file' | 'dir'>()
      for (const k of paths.filter(k => k.startsWith(`${p}/`))) {
        const [head, ...rest] = k.slice(p.length + 1).split('/')
        seen.set(head!, rest.length > 0 ? 'dir' : 'file')
      }
      return [...seen].map(([name, kind]) => ({ name, kind }))
    },
  }
}

const MS = (phase: string, squash = 'none', landed = 'none') => `# M

**Phase:** ${phase}
**Squash:** ${squash}
**Landed:** ${landed}
`
const TICKET = (status: string) => `# T

**Status:** ${status}
`
const B = 'C:/work/acme-brain'
const BRAIN = filesOf({
  [`${B}/BRAIN.md`]: '# acme',
  [`${B}/notes/authored/retry-keys.md`]: 'x',
  [`${B}/notes/repos/api/REPO.md`]: 'x',
  [`${B}/notes/repos/api/explored/billing.md`]: 'x',
  [`${B}/notes/repos/web/REPO.md`]: 'x',
  [`${B}/.brain/drafts/idea.md`]: 'x',
  [`${B}/.brain/specs/001-old/spec.md`]: '# Old\n\n**Landed:** api@abc1234\n',
  [`${B}/.brain/specs/002-gone/spec.md`]: '# Gone\n\n**Abandoned:** not needed\n',
  [`${B}/.brain/specs/003-v2/spec.md`]: '# Billing v2\n\n**Repos:** api, web\n',
  [`${B}/.brain/specs/003-v2/milestones/api/001-expand/milestone.md`]: MS('none', 'abc', 'def1234'),
  [`${B}/.brain/specs/003-v2/milestones/api/001-expand/001-add.md`]: TICKET('done'),
  [`${B}/.brain/specs/003-v2/milestones/api/002-contract/milestone.md`]: MS('review'),
  [`${B}/.brain/specs/003-v2/milestones/api/002-contract/002-drop.md`]: TICKET('done'),
  [`${B}/.brain/specs/003-v2/milestones/web/001-migrate/milestone.md`]: MS('ask'),
  [`${B}/.brain/specs/003-v2/milestones/web/001-migrate/001-use.md`]: TICKET('done'),
  [`${B}/.brain/specs/003-v2/milestones/web/001-migrate/002-ui.md`]: TICKET('doing'),
})

test('the brain is found from a folder inside it, or from a path into its .brain', async () => {
  expect(await findBrain(BRAIN, `${B}/notes/repos`)).toBe(B)
  expect(await findBrain(BRAIN, 'C:/elsewhere')).toBe(undefined)
  expect(brainOfPath('C:\\work\\acme-brain\\.brain\\specs\\003-v2\\spec.md')).toBe(B)
  expect(brainOfPath('C:/work/api/src/main.ts')).toBe(undefined)
})

test('the brain counts its notes and specs, and reads each track of a spec in flight', async () => {
  const b = await readBrain(BRAIN, B)
  expect([b.name, b.notes, b.repos, b.drafts, b.inFlight, b.landed]).toEqual(['acme-brain', 2, 2, 1, 1, 1])
  expect(b.specs.map(s => [s.id, s.title])).toEqual([['003', 'Billing v2']])
  const [api, web] = b.specs[0]!.tracks
  expect(api!.milestones.map(m => [m.num, m.landed, m.phase])).toEqual([['001', true, 'none'], ['002', false, 'review']])
  expect(trackState(api!)).toMatchObject({ word: 'review', hot: false })
  expect(web!.milestones[0]).toMatchObject({ done: 1, total: 2 })
  expect(trackState(web!)).toMatchObject({ word: 'waits on you', hot: true })
})
