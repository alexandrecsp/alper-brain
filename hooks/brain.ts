// Reading the active brain for the pane: its notes, cards and drafts, and the specs in flight with their tracks.
// The layout is skills/brain/references/FORMAT.md's: a brain folder holding notes/, repos/ and .local/specs/, `.brain/` in a repository.
// Every read is best effort: a missing or unreadable file counts as empty.

import type { BrainView, MilestoneView, SpecView, TrackView } from '../types'

/** The part of `$.fs` the reader uses, so tests can hand it a folder of their own. */
export type Files = {
  list: (path: string) => Promise<{ name: string; kind: 'file' | 'dir' | 'other' }[]>
  read: (path: string) => Promise<string>
  exists: (path: string) => Promise<boolean>
}

/** The pane's copy of the layout's paths in a brain's folder, relative to it: layout-copies.test.mjs checks it against layout.mjs. */
export const LAYOUT = {
  specs: '.local/specs',
  repoNotesRoot: 'notes/repos',
  sharedNotes: 'notes/shared',
  drafts: '.local/drafts',
  repos: 'repos',
}

const slash = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '')
const up = (p: string) => p.replace(/\/[^/]*$/, '')

/**
 * The brain a folder sits in: the nearest folder up from it holding a `.brain/` folder with `BRAIN.md`, or holding
 * `BRAIN.md` itself; undefined when none does.
 */
export async function findBrain(fs: Files, dir: string): Promise<string | undefined> {
  let at = slash(dir)
  for (let i = 0; i < 12 && at !== ''; i++) {
    if (await fs.exists(`${at}/.brain/BRAIN.md`).catch(() => false)) return `${at}/.brain`
    if (await fs.exists(`${at}/BRAIN.md`).catch(() => false)) return at
    const next = up(at)
    if (next === at) break
    at = next
  }
  return undefined
}

/**
 * The brain a path points into, by its `.brain/` folder or its `BRAIN.md`; undefined for any other path.
 */
export async function brainOfPath(fs: Files, path: string): Promise<string | undefined> {
  const p = slash(path)
  const m = /^(.*?\/\.brain)(?:\/|$)/.exec(p) ?? /^(.*)\/BRAIN\.md$/.exec(p)
  return m?.[1] === undefined || m[1] === '' ? undefined : findBrain(fs, m[1])
}

/** A `**Name:** value` line's value, without backticks; '' when absent. */
export const field = (md: string, name: string) =>
  (new RegExp(`^\\*\\*${name}:\\*\\*\\s*(.*)$`, 'm').exec(md)?.[1] ?? '').replace(/`/g, '').trim()

const heading = (md: string) => (/^#\s+(.*)$/m.exec(md)?.[1] ?? '').trim()
const isNone = (v: string) => v === '' || /^none\.?$/i.test(v)
const numbered = /^(\d{3})(?:-|$)/

const dirs = async (fs: Files, path: string) =>
  (await fs.list(path).catch(() => [])).filter(e => e.kind === 'dir').map(e => e.name).sort()
const mds = async (fs: Files, path: string) =>
  (await fs.list(path).catch(() => [])).filter(e => e.kind === 'file' && e.name.endsWith('.md')).map(e => e.name)

async function milestoneOf(fs: Files, dir: string, name: string): Promise<MilestoneView> {
  const md = await fs.read(`${dir}/milestone.md`).catch(() => '')
  const tickets = (await mds(fs, dir)).filter(n => numbered.test(n)).sort()
  const states = await Promise.all(tickets.map(async n => field(await fs.read(`${dir}/${n}`).catch(() => ''), 'Status').toLowerCase()))
  const landed = field(md, 'Landed')
  return {
    num: numbered.exec(name)?.[1] ?? name,
    title: heading(md).replace(/^M?\d{3}[\s:·—-]*/, '') || name.replace(numbered, ''),
    phase: field(md, 'Phase').toLowerCase() || 'none',
    squashed: !isNone(field(md, 'Squash')),
    landed: !isNone(landed),
    done: states.filter(s => s.startsWith('done')).length,
    total: states.length,
    blocked: states.some(s => s.startsWith('blocked')),
  }
}

/** A spec's tracks: a folder per repository straight in its folder, or, in the flat layout, its milestones grouped by their **Repo** line. */
async function tracksOf(fs: Files, specDir: string): Promise<TrackView[]> {
  const tracks: TrackView[] = []
  const flat = new Map<string, MilestoneView[]>()
  for (const name of await dirs(fs, specDir)) {
    if (numbered.test(name)) {
      const m = await milestoneOf(fs, `${specDir}/${name}`, name)
      const repo = field(await fs.read(`${specDir}/${name}/milestone.md`).catch(() => ''), 'Repo')
      const slug = isNone(repo) ? '—' : repo
      flat.set(slug, [...(flat.get(slug) ?? []), m])
    } else {
      const ms = await Promise.all((await dirs(fs, `${specDir}/${name}`)).filter(n => numbered.test(n)).map(n => milestoneOf(fs, `${specDir}/${name}/${n}`, n)))
      if (ms.length > 0) tracks.push({ slug: name, milestones: ms })
    }
  }
  for (const [slug, milestones] of flat) tracks.push({ slug, milestones })
  return tracks
}

/** The notes and repositories of a brain: every repository's notes, the shared notes, and the cards. */
async function countNotes(fs: Files, root: string): Promise<{ notes: number; repos: number }> {
  const repoNotes = `${root}/${LAYOUT.repoNotesRoot}`
  let notes = (await mds(fs, `${root}/${LAYOUT.sharedNotes}`)).length
  for (const slug of await dirs(fs, repoNotes)) notes += (await mds(fs, `${repoNotes}/${slug}`)).length
  return { notes, repos: (await mds(fs, `${root}/${LAYOUT.repos}`)).length }
}

/** Everything the pane shows of the brain at `root`. */
export async function readBrain(fs: Files, root: string): Promise<BrainView> {
  const at = slash(root)
  const { notes, repos } = await countNotes(fs, at)
  const specsDir = `${at}/${LAYOUT.specs}`
  const drafts = (await mds(fs, `${at}/${LAYOUT.drafts}`)).length
  const specs: SpecView[] = []
  let inFlight = 0
  let landed = 0
  for (const name of await dirs(fs, specsDir)) {
    if (!numbered.test(name)) continue
    const md = await fs.read(`${specsDir}/${name}/spec.md`).catch(() => '')
    if (md === '') continue
    if (field(md, 'Landed') !== '') {
      landed++
      continue
    }
    if (field(md, 'Abandoned') !== '') continue
    inFlight++
    const tracks = await tracksOf(fs, `${specsDir}/${name}`)
    if (tracks.length > 0) specs.push({ id: name.slice(0, 3), title: heading(md).replace(/^(?:Spec\s*)?\d{3}[\s:·—-]*/i, '') || name.slice(4), tracks })
  }
  const name = at.split('/').pop() ?? at
  // a brain in `.brain/` is named for its host's folder
  return { name: name === '.brain' ? (at.split('/').slice(-2, -1)[0] ?? name) : name, root: at, notes, repos, drafts, inFlight, landed, specs }
}
