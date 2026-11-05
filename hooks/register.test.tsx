import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'alper-brain',
  component: 'Pane',
  requestId: 'build-watch',
  props: {
    title: 'Build watch',
    isFocused: false,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

// The engine hands a hook Windows paths with backslashes.
const slash = (path: string) => path.replace(/\\/g, '/')

const DIR = 'C:/repo/.sdd/specs/003-invoice-export/milestones/001-parse-invoices'

const files: Record<string, string> = {
  'C:/repo/.sdd/specs/003-invoice-export/spec.md': '# Spec: Invoice export\n\n**Key:** None\n',
  [`${DIR}/milestone.md`]: '# Milestone 001: Parse invoices\n\n**Repo:** billing-api\n\n**Phase:** none\n\n**Squash:** none\n',
  [`${DIR}/001-read-rows.md`]: '# Ticket 001: Read rows\n\n**Status:** done\n\n**Commit:** a1b2c3d4\n',
  [`${DIR}/002-map-columns.md`]: '# Ticket 002: Map columns\n\n**Status:** doing\n\n**Commit:** none\n',
  [`${DIR}/003-check-totals.md`]: '# Ticket 003: Check totals\n\n**Status:** todo\n\n**Commit:** none\n',
}

const USAGE = {
  model: 'claude-sonnet-5-5',
  input_tokens: 1200,
  output_tokens: 300,
  cache_read_input_tokens: 8000,
  cache_creation_input_tokens: 500,
}

test("a /build ticket's builder shows under its milestone, with its spending", async ($, on) => {
  // Nothing sits beneath the plugin: each hook here stands for the engine.
  const stored: Record<string, unknown> = {}
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('clock.now', () => ({ value: 1_000_000 }))
  on('store.get', (_, e) => ({ value: stored[e.key] }))
  on('store.set', (_, e) => {
    stored[e.key] = e.value
    return { value: undefined }
  })
  on('fs.list', (_, e) => ({
    value: Object.keys(files)
      .filter(path => path.startsWith(`${slash(e.path)}/`))
      .map(path => ({ name: path.slice(slash(e.path).length + 1), kind: 'file' as const, size: 1, mtimeMs: 1, isLink: false })),
  }))
  on('fs.read', (_, e) => {
    const text = files[slash(e.path)]
    if (text === undefined) throw new Error(`no file ${e.path}`)
    return { value: text }
  })
  on('agent.list', () => ({
    value: [
      { id: 'a1', type: 'alper-brain:builder', description: 'Build ticket 002', status: 'running' },
    ],
  }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.step', async function* (_, e) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '',
      toolUses: [{ name: 'Edit', input: { file_path: 'src/map.ts' } }],
      stopReason: 'tool_use' as const,
      usage: USAGE,
    }
  })
  on('tool.call', () => ({ result: {} }))
  on('turn.complete', (_, e) => ({ text: e.answer }))

  await $.turn.start({
    text: `## Context\n- **Works in:** billing-api at C:/work/billing-api (open), changes it\n\nBuild this ticket: ${DIR}/002-map-columns.md, ${DIR}/milestone.md, C:/repo/.sdd/specs/003-invoice-export/spec.md`,
    turnId: 't1',
    agentId: 'a1',
  })
  for await (const _ of $.turn.step({
    turnId: 't1',
    index: 0,
    model: 'claude-sonnet-5-5',
    messageCount: 1,
    agentId: 'a1',
  })) {
  }
  await $.tool.call({ tool: 'Edit', file_path: 'src/map.ts', old_string: 'a', new_string: 'b', agentId: 'a1' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /003 Invoice export/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /M001 Parse invoices/ })).toBeDefined()
    // The milestone's repository heads the build, and the agent's row names the one its brief works in.
    expect(await ui.find({ type: 'Text', text: /^· billing-api$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /builder T002 · billing-api/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /1\/3 tickets/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /001 Read rows/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /a1b2c3d/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /002 Map columns/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /10\.0k tok/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /↳ Edit src\/map\.ts/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /10\.0k tokens · agents 10\.0k · main session 0 · 1 agents/ })).toBeDefined()
    // The ticket progress, the builder's persona and token meter, where
    // the surface draws an Svg; the terminal keeps the text bars.
    const drawings = await ui.findAll({ type: 'Svg' })
    expect(drawings.map(found => found.props)).toMatchObject(
      surface === 'terminal'
        ? []
        : [
            { alt: '1 of 3 tickets done' },
            { alt: 'builder, running' },
            { alt: '10.0k tok of the 10.0k the busiest agent spent' },
          ],
    )
    // The running ticket's activity shows once, on its agent's row.
    expect(await ui.findAll({ type: 'Text', text: /↳ Edit src\/map\.ts/ })).toHaveLength(1)
    expect(await ui.find({ type: 'Text', text: /10\.0k tok █/ })).toEqual(
      surface === 'terminal' ? expect.anything() : undefined,
    )
    await ui.unmount()
  }

  // The spending is saved under the milestone, for the next /build call.
  const saved = stored[`ledger:${DIR}`] as { agentTokens: number; byTicket: Record<string, { tokens: number }> }
  expect(saved.agentTokens).toBe(10_000)
  expect(saved.byTicket['002']?.tokens).toBe(10_000)
})

test('the decide phase shows as the stage the milestone is at, and its arbiter as deciding', async ($, on) => {
  const reviewing: Record<string, string> = {
    ...files,
    [`${DIR}/milestone.md`]: '# Milestone 001: Parse invoices\n\n**Phase:** `decide`\n\n**Squash:** none\n',
    [`${DIR}/review.md`]: '# Review\n',
  }
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('clock.now', () => ({ value: 1_000_000 }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('fs.list', (_, e) => ({
    value: Object.keys(reviewing)
      .filter(path => path.startsWith(`${slash(e.path)}/`))
      .map(path => ({ name: path.slice(slash(e.path).length + 1), kind: 'file' as const, size: 1, mtimeMs: 1, isLink: false })),
  }))
  on('fs.read', (_, e) => ({ value: reviewing[slash(e.path)] ?? '' }))
  on('agent.list', () => ({
    value: [{ id: 'a2', type: 'alper-brain:arbiter', description: 'Decide the escalations', status: 'running' }],
  }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('tool.call', () => ({ result: {} }))

  // The main session reading the milestone is how a build starts or resumes.
  await $.tool.call({ tool: 'Read', file_path: `${DIR}/milestone.md` })
  // The arbiter is handed review.md, as the fixer is.
  await $.turn.start({ text: `Decide the escalations: ${DIR}/review.md`, turnId: 't2', agentId: 'a2' })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /✅ review/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /decide: Decide the escalations/ })).toBeDefined()
  expect(await ui.find({ type: 'Svg', alt: 'arbiter, running' })).toBeDefined()
  await ui.unmount()
})

test('a wave shows each of its milestones, each builder under its own', async ($, on) => {
  const DIR2 = 'C:/repo/.sdd/specs/003-invoice-export/milestones/002-show-totals'
  const wave: Record<string, string> = {
    ...files,
    [`${DIR2}/milestone.md`]: '# Milestone 002: Show totals\n\n**Repo:** web-app\n\n**Phase:** none\n\n**Squash:** none\n',
    [`${DIR2}/004-totals-page.md`]: '# Ticket 004: Totals page\n\n**Status:** doing\n\n**Commit:** none\n',
  }
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('clock.now', () => ({ value: 1_000_000 }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('fs.list', (_, e) => ({
    value: Object.keys(wave)
      .filter(path => path.startsWith(`${slash(e.path)}/`))
      .map(path => ({ name: path.slice(slash(e.path).length + 1), kind: 'file' as const, size: 1, mtimeMs: 1, isLink: false })),
  }))
  on('fs.read', (_, e) => ({ value: wave[slash(e.path)] ?? '' }))
  on('agent.list', () => ({
    value: [
      { id: 'w1', type: 'alper-brain:builder', description: 'Build ticket 002', status: 'running' },
      { id: 'w2', type: 'alper-brain:builder', description: 'Build ticket 004', status: 'running' },
    ],
  }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('tool.call', () => ({ result: {} }))

  // The round's builders start side by side, one per milestone of the wave.
  await $.turn.start({
    text: `## Context\n- **Works in:** billing-api at C:/work/billing-api (open), changes it\n\nBuild this ticket: ${DIR}/002-map-columns.md`,
    turnId: 'tw1',
    agentId: 'w1',
  })
  await $.turn.start({
    text: `## Context\n- **Works in:** web-app at C:/work/web-app (open), changes it\n\nBuild this ticket: ${DIR2}/004-totals-page.md`,
    turnId: 'tw2',
    agentId: 'w2',
  })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /M001 Parse invoices/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /M002 Show totals/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^· web-app$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /002 Map columns/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /004 Totals page/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /builder T002 · billing-api/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /builder T004 · web-app/ })).toBeDefined()
  await ui.unmount()
})

test('the fixer shows as fixing in the fix phase, dressed as its own role', async ($, on) => {
  const fixing: Record<string, string> = {
    ...files,
    [`${DIR}/milestone.md`]: '# Milestone 001: Parse invoices\n\n**Repo:** billing-api\n\n**Phase:** fix\n\n**Squash:** none\n',
    [`${DIR}/review.md`]: '# Review\n',
  }
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('clock.now', () => ({ value: 1_000_000 }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('fs.list', (_, e) => ({
    value: Object.keys(fixing)
      .filter(path => path.startsWith(`${slash(e.path)}/`))
      .map(path => ({ name: path.slice(slash(e.path).length + 1), kind: 'file' as const, size: 1, mtimeMs: 1, isLink: false })),
  }))
  on('fs.read', (_, e) => ({ value: fixing[slash(e.path)] ?? '' }))
  on('agent.list', () => ({
    value: [{ id: 'a3', type: 'alper-brain:fixer', description: 'Fix the review findings', status: 'running' }],
  }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('tool.call', () => ({ result: {} }))

  await $.tool.call({ tool: 'Read', file_path: `${DIR}/milestone.md` })
  await $.turn.start({
    text: `## Context\n- **Works in:** billing-api at C:/work/billing-api (open), changes it\n\nFix the findings in this review: ${DIR}/review.md`,
    turnId: 't3',
    agentId: 'a3',
  })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /fix: Fix the review findings/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /fixer\s+· billing-api/ })).toBeDefined()
  expect(await ui.find({ type: 'Svg', alt: 'fixer, running' })).toBeDefined()
  await ui.unmount()
})
