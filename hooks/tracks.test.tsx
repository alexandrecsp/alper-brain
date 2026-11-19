import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'alper-brain',
  component: 'Pane',
  requestId: 'workshop',
  props: {
    title: 'Workshop',
    isFocused: false,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 60 },
    view: {},
  },
} as const

// The engine hands a hook Windows paths with backslashes.
const slash = (path: string) => path.replace(/\\/g, '/')

type On = Parameters<Parameters<typeof test>[1]>[1]

// An engine whose files are `tree`, listed as a folder lists them: its files, and the folders below it.
// Its clock stands still until the test moves `time.at` on.
const engine = (on: On, tree: Record<string, string>, agents: unknown[] = []) => {
  const time = { at: 1_000_000 }
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('clock.now', () => ({ value: time.at }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('fs.list', (_, e) => {
    const dir = `${slash(e.path)}/`
    const names = new Map<string, 'file' | 'dir'>()
    for (const path of Object.keys(tree).filter(one => one.startsWith(dir))) {
      const [name, ...rest] = path.slice(dir.length).split('/')
      if (name !== undefined) names.set(name, rest.length > 0 ? 'dir' : 'file')
    }
    if (names.size === 0) throw new Error(`no folder ${e.path}`)
    return { value: [...names].map(([name, kind]) => ({ name, kind, size: 1, mtimeMs: 1, isLink: false })) }
  })
  on('fs.read', (_, e) => {
    const text = tree[slash(e.path)]
    if (text === undefined) throw new Error(`no file ${e.path}`)
    return { value: text }
  })
  on('agent.list', () => ({ value: agents }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('tool.call', () => ({ result: {} }))
  return time
}

const SPEC = 'C:/repo/.brain/specs/003-invoice-export'
const milestone = (title: string, phase: string, squash = 'none', landed = 'none', buildsAfter = 'None') =>
  `# Milestone 001: ${title}\n\n**Builds after:** ${buildsAfter}\n\n**Lands after:** None\n\n**Phase:** ${phase}\n\n**Squash:** ${squash}\n\n**Landed:** ${landed}\n`
const ticket = (title: string, status: string, depends = 'None', notes = '', commit = 'none') =>
  `# Ticket 001: ${title}\n\n**Status:** ${status}\n\n**Depends on:** ${depends}\n\n**Commit:** ${commit}\n\n## Notes\n\n${notes}\n`

test('every track of the spec shows on top, and what waits on the user heads the pane', async ($, on) => {
  engine(on, {
    [`${SPEC}/spec.md`]: '# Spec: Invoice export\n',
    [`${SPEC}/milestones/billing-api/001-parse/milestone.md`]: milestone('Parse invoices', 'ask'),
    [`${SPEC}/milestones/billing-api/001-parse/001-read.md`]: ticket('Read rows', 'done'),
    [`${SPEC}/milestones/billing-api/001-parse/review.md`]:
      '# Review\n\nST1. parse.ts: renames a field. Judgement call, **escalate**.\n',
    [`${SPEC}/milestones/web-app/001-show/milestone.md`]: milestone('Show totals', 'none', 'none', 'none', 'billing-api/001'),
    [`${SPEC}/milestones/web-app/001-show/001-page.md`]: ticket('Totals page', 'todo'),
    [`${SPEC}/milestones/worker/001-sync/milestone.md`]: milestone('Sync', 'none'),
    [`${SPEC}/milestones/worker/001-sync/001-job.md`]: ticket('Sync job', 'blocked', 'None', '- The queue client is missing'),
    [`${SPEC}/milestones/mailer/001-send/milestone.md`]: milestone('Send', 'landed', 'c0ffee12', 'c0ffee12'),
    [`${SPEC}/milestones/mailer/001-send/001-send.md`]: ticket('Send mail', 'done'),
  })

  await $.tool.call({ tool: 'Read', file_path: `${SPEC}/milestones/billing-api/001-parse/milestone.md` })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(
    await ui.find({ type: 'Text', text: /⚠ billing-api M001: 1 escalation waits on your answers — \/build 003/ }),
  ).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /⚠ worker M001: T001 blocked: The queue client is missing/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Tracks 3 of 4 in flight/ })).toBeDefined()
  // web-app's milestone builds after billing-api's 001, still open.
  expect(await ui.find({ type: 'Text', text: /^web-app M001 0\/1 · after billing-api\/001$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^mailer · landed c0ffee1$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^worker M001 0\/1 · T001 blocked: The queue client is missing$/ })).toBeDefined()
  await ui.unmount()
})

test('a squashed milestone shows landing, and a landing that gave up shows as failed', async ($, on) => {
  const DIR = `${SPEC}/milestones/billing-api/001-parse`
  const tree: Record<string, string> = {
    [`${SPEC}/spec.md`]: '# Spec: Invoice export\n',
    [`${DIR}/milestone.md`]: milestone('Parse invoices', 'squash', 'abc1234f'),
    [`${DIR}/001-read.md`]: ticket('Read rows', 'done'),
  }
  engine(on, tree)

  await $.tool.call({ tool: 'Read', file_path: `${DIR}/milestone.md` })
  let ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /^billing-api M001 1\/1 · landing, squashed abc1234$/ })).toBeDefined()
  await ui.unmount()

  tree[`${DIR}/milestone.md`] = milestone('Parse invoices', 'failed', 'abc1234f')
  await $.tool.call({ tool: 'Edit', file_path: `${DIR}/milestone.md`, old_string: 'a', new_string: 'b' })
  ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /^billing-api M001 1\/1 · landing failed$/ })).toBeDefined()
  // A failed landing waits on the user.
  expect(await ui.find({ type: 'Text', text: /^⚠ billing-api M001: landing failed — \/build 003$/ })).toBeDefined()
  await ui.unmount()
})

test('the main session runs the tests at the test bench, and a finished builder leaves by the gate', async ($, on) => {
  const DIR = `${SPEC}/milestones/billing-api/001-parse`
  const tree: Record<string, string> = {
    [`${SPEC}/spec.md`]: '# Spec: Invoice export\n',
    [`${DIR}/milestone.md`]: milestone('Parse invoices', 'none'),
    [`${DIR}/001-read.md`]: ticket('Read rows', 'doing'),
  }
  const time = engine(on, tree, [{ id: 'b1', type: 'alper-brain:builder', description: 'Build ticket 001', status: 'running' }])

  await $.turn.start({ text: `Build this ticket: ${DIR}/001-read.md`, turnId: 't1', agentId: 'b1' })
  time.at += 2000
  await $.tool.call({ tool: 'Read', file_path: 'C:/work/billing-api/src/read.ts', agentId: 'b1' })
  // a call within its second at the archive waits, and the builder stays
  time.at += 500
  await $.tool.call({ tool: 'Bash', command: 'git commit -m "Reads rows"', agentId: 'b1' })
  let ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /● Vega · builder T001 · Archive · reading read\.ts/ })).toBeDefined()
  await ui.unmount()

  time.at += 2000
  tree[`${DIR}/001-read.md`] = ticket('Read rows', 'done', 'None', '', '1234567abc')
  await $.turn.complete({ turnId: 't1', agentId: 'b1', reason: 'answer', answer: 'Built it.' } as never)
  await $.tool.call({ tool: 'Bash', command: 'npm test' })

  ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /● Lead · main · Test bench · running npm test/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /● Vega · builder T001 · Gate · done/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /1 commits/ })).toBeDefined()
  await ui.unmount()
})
