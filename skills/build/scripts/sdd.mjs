#!/usr/bin/env node
// Reads and writes a spec's pipeline files by the brain's FORMAT.md **Specs** and build's SKILL.md, so the rules
// a script can decide (Tracks, Phase, landable, the dependency checks, the cap) are decided the same way every call.
//
//   node sdd.mjs state <spec-id|spec-folder> [--brain <brain>] [--no-git]
//     Prints the spec as JSON: its lines, its dependencies, the cap, and per track its milestones with each one's
//     state (open, unlanded, landed), the step it resumes at, whether it is ready or landable, the frontier a call
//     builds, and, read from git through .brain/links.json, whether its branch exists and the repository is clean.
//   node sdd.mjs brief <ticket-file> [--no-git]
//     Prints, as Markdown, what the ticket's builder needs from around it: its milestone's lines, the Notes and
//     changed files of each earlier ticket of its milestone and each ticket its Depends on names, and each
//     milestone its milestone's Builds after names, with its squash's changed files and its tickets' Notes.
//   node sdd.mjs set <file> <Line> <value> [--after <Line>]
//     Sets a `**Line:** value` line; when the file has none, creates it under the --after line, else fails.
//   node sdd.mjs append <file> <Line> <entry> [--sep '; '] [--after <Line>]
//     Appends an entry to a line, skipping one the line already ends with, as LAND.md's **Record it** does.
//   node sdd.mjs mark <review.md> <ID> "<Line>: <value>" [<ID> "<Line>: <value>"]...
//     Writes `**Line:** value` under each finding named, replacing that line when the finding already has one:
//     build's Answer, Fixed and Not fixed lines.
//   node sdd.mjs review <review.md> --title <t> --fixed <sha> --head <sha> --summary <file> <section-file>...
//     review-changes' step 6: writes review.md from the Summary file and the section files its sub-agents wrote
//     (review.<standards|spec|consumers>[.<slug>].md), numbering each axis straight on, then deletes them. Refuses
//     a review.md that holds Answer lines.
//   node sdd.mjs squash <milestone-folder|milestone.md> --title <title> [--detail <bullet>]... [--key <key|none>]
//     Build's step 10: squashes the milestone's branch into the spec's as one commit keyed by
//     the commit skill's step 1 (or --key, `none` for no key), with its Sdd-Milestone trailer, and writes it into
//     Phase and Squash. Idempotent.
//   node sdd.mjs verify <ticket|milestone.md> [--commit <sha>]... [--brain-head <sha>]
//     BRIEF.md's check after a sub-agent that changes a repository, and for a ticket that it is done with its commit:
//     prints the ticket's Status and Commit, then `ok`, or each problem and exits 1.
//
// Exits 1 with one line on stderr when it cannot read or write what it was given.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const DEFAULT_CAP = 5

// --- reading the Markdown lines -------------------------------------------------------------------------------

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const lineRe = (name) => new RegExp(`^\\*\\*${escape(name)}:\\*\\*[ \\t]*(.*)$`, 'm')

/** A `**Name:** value` line's value without backticks; null when absent. */
export const field = (md, name) => {
  const m = lineRe(name).exec(md)
  return m ? m[1].replace(/`/g, '').trim() : null
}

const isNone = (v) => v === null || v === '' || /^none$/i.test(v)
const orNull = (v) => (isNone(v) ? null : v)
const heading = (md) => (/^#\s+(.*)$/m.exec(md)?.[1] ?? '').trim()

/** `a@x, b@y` → { a: 'x', b: 'y' }. */
export const atEntries = (v) =>
  isNone(v) ? {} : Object.fromEntries(v.split(',').map((e) => e.trim()).filter(Boolean).map((e) => e.split('@').map((s) => s.trim())))

/** A **Depends on**, **Builds after** or **Lands after** value → [{ track, n }]; track is null for a bare `NNN`. */
export const ids = (v) =>
  isNone(v)
    ? []
    : v.split(',').map((t) => t.trim()).filter(Boolean).map((t) => {
        const m = /^(?:([\w.-]+)\/)?(\d{1,3})\b/.exec(t)
        return m ? { track: m[1] ?? null, n: m[2].padStart(3, '0') } : { bad: t }
      })

const findingStart = /^(?=\s*(?:[-*]\s+|#{1,4}\s+)?(?:\*\*)?(?:ST|SP|CN)\d+\b)/m
/** A review.md's findings, each from its ID to the next ID or heading: [{ id, text, start }]. */
const findings = (reviewMd) => {
  let start = 0
  return reviewMd.split(findingStart).map((f) => {
    const at = start
    start += f.length
    const id = /^\s*(?:[-*]\s+|#{1,4}\s+)?(?:\*\*)?((?:ST|SP|CN)\d+)\b/.exec(f)?.[1]
    if (!id) return null
    const end = f.indexOf(id) + id.length
    const cut = /^#{1,4}\s/m.exec(f.slice(end))
    return { id, text: cut ? f.slice(0, end + cut.index) : f, start: at }
  }).filter(Boolean)
}

/** The findings in a review.md flagged escalate with no **Answer** line, by their IDs. */
export const unanswered = (reviewMd) =>
  findings(reviewMd).filter((f) => /\bescalate\b/i.test(f.text) && !/\*\*Answer:\*\*/.test(f.text)).map((f) => f.id)

/**
 * The findings build's fixer takes, by their IDs: each with no **Fixed** or **Not fixed** line yet, that is not
 * marked **keep**, and, when flagged escalate, whose **Answer** fixes it rather than skips it.
 */
export const toFix = (reviewMd) =>
  findings(reviewMd)
    .filter(({ text }) => !/\*\*(?:Fixed|Not fixed):\*\*/i.test(text))
    .filter(({ text }) => /\bescalate\b/i.test(text)
      ? /\*\*Answer:\*\*/.test(text) && !/\*\*Answer:\*\*\s*skip/i.test(text)
      : !/\*\*keep\*\*/i.test(text))
    .map((f) => f.id)

/** Writes `**<line>:** <value>` under finding `id` of a review.md, replacing that line when the finding has one. */
export const markFinding = (reviewMd, id, line, value) => {
  const f = findings(reviewMd).find((x) => x.id === id)
  if (!f) throw new Error(`No finding ${id} in the review`)
  const { start } = f
  const body = f.text.replace(/\s+$/, '')
  const re = new RegExp(`^([ \\t]*)\\*\\*${escape(line)}:\\*\\*.*$`, 'm')
  const indent = /^\s*[-*]\s/.test(body) ? '  ' : ''
  const next = re.test(body) ? body.replace(re, (_, ind) => `${ind}**${line}:** ${value}`) : `${body}\n\n${indent}**${line}:** ${value}`
  return reviewMd.slice(0, start) + next + reviewMd.slice(start + body.length)
}

/** The step of build's Phase table a call resumes an open milestone at. */
export const resumeStep = (phase, ticketsDone) => {
  switch (phase) {
    case 'review': return 6
    case 'decide': case 'ask': return 7
    case 'fix': return 8
    case 'check': case 'waits': case 'failed': return 9
    case 'squash': return 10
    default: return ticketsDone ? 6 : 4
  }
}

// --- reading a spec folder ------------------------------------------------------------------------------------

const read = (p) => readFileSync(p, 'utf8')
const dirs = (p) => (existsSync(p) ? readdirSync(p).filter((n) => statSync(join(p, n)).isDirectory()).sort() : [])
const numbered = (n) => /^\d{3}/.test(n)

/** The spec folder a spec id names under <brain>/.brain/specs, by SPEC-ID.md. */
export const resolveSpec = (arg, brain) => {
  const asPath = resolve(arg)
  if (existsSync(join(asPath, 'spec.md'))) return asPath
  const m = /^s?(\d+)/i.exec(basename(arg.replace(/[\\/]+$/, '')))
  if (!m) throw new Error(`Not a spec id or spec folder: ${arg}`)
  const nnn = m[1].padStart(3, '0')
  const root = join(brain, '.brain', 'specs')
  const found = dirs(root).filter((n) => n.startsWith(nnn))
  if (found.length !== 1) throw new Error(`${found.length ? 'Several spec folders' : 'No spec folder'} for ${arg} under ${root}${found.length ? `: ${found.join(', ')}` : ''}`)
  return join(root, found[0])
}

const readMilestone = (dir, track) => {
  const md = read(join(dir, 'milestone.md'))
  const reviewPath = join(dir, 'review.md')
  const review = existsSync(reviewPath) ? read(reviewPath) : null
  const tickets = readdirSync(dir)
    .filter((n) => /^\d{3}-.*\.md$/.test(n))
    .sort()
    .map((file) => {
      const t = read(join(dir, file))
      return {
        n: file.slice(0, 3),
        file,
        title: heading(t).replace(/^Ticket\s+\d+:\s*/, ''),
        status: field(t, 'Status') ?? 'todo',
        dependsOn: ids(field(t, 'Depends on')),
        commit: orNull(field(t, 'Commit')),
      }
    })
  return {
    n: basename(dir).slice(0, 3),
    folder: basename(dir),
    dir,
    track: track ?? orNull(field(md, 'Repo')),
    title: heading(md).replace(/^Milestone\s+\d+:\s*/, ''),
    phase: field(md, 'Phase') ?? 'none',
    squash: orNull(field(md, 'Squash')),
    landed: orNull(field(md, 'Landed')),
    buildsAfter: ids(field(md, 'Builds after')),
    landsAfter: ids(field(md, 'Lands after')),
    tickets,
    review: review === null ? null : { head: orNull(field(review, 'Head')), unanswered: unanswered(review), toFix: toFix(review) },
  }
}

/** Every milestone of a spec folder, in tracks: [{ slug, milestones }], with the layout it was read in. */
export const readTracks = (specDir) => {
  const root = join(specDir, 'milestones')
  const flat = dirs(root).filter(numbered)
  if (flat.length) {
    const ms = flat.map((n) => readMilestone(join(root, n), null))
    const slugs = [...new Set(ms.map((m) => m.track ?? '?'))]
    return { layout: 'flat', tracks: slugs.map((slug) => ({ slug, milestones: ms.filter((m) => (m.track ?? '?') === slug) })) }
  }
  const tracks = dirs(root).filter((n) => !numbered(n)).map((slug) => ({
    slug,
    milestones: dirs(join(root, slug)).filter(numbered).map((n) => readMilestone(join(root, slug, n), slug)),
  }))
  return { layout: 'tracks', tracks }
}

const readSpecLines = (specDir) => {
  const md = read(join(specDir, 'spec.md'))
  const repos = (field(md, 'Repos') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const landings = field(md, 'Landings')
  return {
    title: heading(md),
    repos,
    key: field(md, 'Key'),
    base: atEntries(field(md, 'Base')),
    dependsOn: isNone(field(md, 'Depends on')) ? [] : field(md, 'Depends on').split(',').map((s) => s.trim()).filter(Boolean),
    brainNotes: field(md, 'Brain notes'),
    landings: landings ? landings.split(';').map((s) => s.trim()).filter(Boolean) : [],
    landed: field(md, 'Landed') === null ? null : atEntries(field(md, 'Landed')),
    abandoned: field(md, 'Abandoned'),
  }
}

/** The `parallelAgents` setting by FORMAT.md's **Settings**: { cap, problem }. */
export const readCap = (brain) => {
  const path = join(brain, '.brain', 'config.json')
  if (!existsSync(path)) return { cap: DEFAULT_CAP }
  let cfg
  try { cfg = JSON.parse(read(path)) } catch { return { cap: DEFAULT_CAP, problem: `${path} does not parse as JSON` } }
  if (cfg === null || typeof cfg !== 'object' || Array.isArray(cfg)) return { cap: DEFAULT_CAP, problem: `${path} is not a JSON object` }
  const v = cfg.parallelAgents
  if (v === undefined) return { cap: DEFAULT_CAP }
  return Number.isInteger(v) && v > 0 ? { cap: v } : { cap: DEFAULT_CAP, problem: `parallelAgents ${JSON.stringify(v)} is not a positive whole number` }
}

const readLinks = (brain) => {
  const path = join(brain, '.brain', 'links.json')
  if (!existsSync(path)) return {}
  try { return JSON.parse(read(path)) } catch { return {} }
}

// --- git --------------------------------------------------------------------------------------------------------

const git = (root, args) => {
  const r = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' })
  return r.status === 0 ? r.stdout.trim() : null
}

const repoState = (root, specFolder, base) => {
  if (!root || git(root, ['rev-parse', '--git-dir']) === null) return { root: root ?? null, git: false }
  const branches = (git(root, ['branch', '--list', '--format=%(refname:short)', `sdd/${specFolder}/*`]) ?? '')
    .split('\n').filter(Boolean)
  let baseBranch = base ?? null
  let baseFrom = base ? 'spec' : null
  if (!baseBranch) {
    const d = git(root, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'])
    if (d) { baseBranch = d.replace(/^origin\//, ''); baseFrom = 'remote' }
  }
  return {
    root,
    git: true,
    head: git(root, ['symbolic-ref', '--short', '-q', 'HEAD']),
    clean: (git(root, ['status', '--porcelain']) ?? 'x') === '',
    base: baseBranch,
    baseFrom,
    specBranch: branches.includes(`sdd/${specFolder}/spec`),
    branches,
  }
}

const isAncestor = (root, sha, base) =>
  spawnSync('git', ['-C', root, 'merge-base', '--is-ancestor', sha, base]).status === 0

// --- the rules ----------------------------------------------------------------------------------------------------

/**
 * Derives each milestone's state, resume step, readiness and landability, and each track's next milestone, by
 * build's **Tracks** and **Phase** and LAND.md's opening paragraph. Pure: `repo(slug)` gives a track's git state.
 */
export const derive = ({ tracks, layout, repos, repo = () => ({ git: false }) }) => {
  const order = [...repos, ...tracks.map((t) => t.slug).filter((s) => !repos.includes(s)).sort()]
  const bySlug = new Map(tracks.map((t) => [t.slug, t]))
  const problems = []

  // Ticket lookup: a bare NNN names a ticket of its own track (of the whole spec in the flat layout).
  const allTickets = tracks.flatMap((t) => t.milestones.flatMap((m) => m.tickets.map((k) => ({ ...k, track: t.slug, milestone: m }))))
  const findTicket = (fromTrack, id) =>
    layout === 'flat' && id.track === null
      ? allTickets.filter((k) => k.n === id.n)
      : allTickets.filter((k) => k.track === (id.track ?? fromTrack) && k.n === id.n)
  const findMilestone = (id) => bySlug.get(id.track)?.milestones.find((m) => m.n === id.n)
  const msId = (track, m) => `${track}/${m.n}`

  for (const t of tracks) {
    for (const m of t.milestones) {
      m.state = m.squash === null ? 'open' : m.landed === null ? 'unlanded' : 'landed'
      m.ticketsDone = m.tickets.length > 0 && m.tickets.every((k) => k.status === 'done')
      m.nextTicket = m.tickets.find((k) => k.status !== 'done')?.n ?? null
      m.resume = m.state === 'open' ? resumeStep(m.phase, m.ticketsDone) : m.state === 'unlanded' ? 'land' : null
    }
  }

  // Ready: every earlier milestone of its track squashed, and every milestone its Builds after names. A ticket's
  // Depends on naming another track's ticket predates Builds after: it holds its milestone the same way, and
  // `migrate` lists the Builds after it stands for, by MIGRATE.md's **Builds after**.
  const migrate = []
  for (const t of tracks) {
    t.milestones.forEach((m, i) => {
      m.after = []
      for (const id of m.buildsAfter) {
        if (id.bad) { problems.push(`${msId(t.slug, m)}: Builds after has an unreadable entry "${id.bad}"`); continue }
        if (id.track === null || id.track === t.slug) { problems.push(`${msId(t.slug, m)}: Builds after ${id.track ? `${id.track}/` : ''}${id.n} names its own track, which builds in number order`); continue }
        const dep = findMilestone(id)
        if (!dep) { problems.push(`${msId(t.slug, m)}: Builds after ${id.track}/${id.n} names no milestone`); continue }
        m.after.push({ track: id.track, m: dep })
      }
      const lifted = new Set()
      for (const k of m.tickets) {
        for (const id of k.dependsOn) {
          if (id.bad) { problems.push(`${msId(t.slug, m)}: ticket ${k.n} has an unreadable Depends on entry "${id.bad}"`); continue }
          const found = findTicket(t.slug, id)
          if (found.length !== 1) {
            problems.push(`${t.slug}/${m.n} ticket ${k.n}: Depends on ${id.track ? `${id.track}/` : ''}${id.n} names ${found.length ? 'several tickets' : 'no ticket'}`)
            continue
          }
          const dep = found[0]
          if (dep.track === t.slug) continue
          lifted.add(msId(dep.track, dep.milestone))
          if (!m.after.some((a) => a.m === dep.milestone)) m.after.push({ track: dep.track, m: dep.milestone })
        }
      }
      if (lifted.size && layout === 'tracks') migrate.push({ milestone: msId(t.slug, m), buildsAfter: [...new Set([...m.buildsAfter.filter((id) => !id.bad).map((id) => `${id.track}/${id.n}`), ...[...lifted].sort()])] })
      if (m.state !== 'open') return
      const waits = t.milestones.slice(0, i).filter((e) => e.squash === null).map((e) => msId(t.slug, e))
      for (const a of m.after) if (a.m.squash === null) waits.push(msId(a.track, a.m))
      m.waitsOn = [...new Set(waits)]
      m.ready = m.waitsOn.length === 0
    })
  }

  // A cycle through Builds after and each track's number order leaves every milestone on it waiting forever.
  const trackOf = new Map(tracks.flatMap((t) => t.milestones.map((m) => [m, t.slug])))
  const color = new Map()
  const visit = (m, path) => {
    color.set(m, 'grey')
    const t = bySlug.get(trackOf.get(m))
    const prev = t.milestones[t.milestones.indexOf(m) - 1]
    for (const next of [...(prev ? [prev] : []), ...m.after.map((a) => a.m)]) {
      if (color.get(next) === 'grey') {
        const loop = [...path.slice(path.indexOf(next)), m, next].map((x) => msId(trackOf.get(x), x))
        problems.push(`Builds after makes a cycle, so none of it can start: ${[...new Set(loop)].join(' → ')}`)
      } else if (!color.has(next)) visit(next, [...path, m])
    }
    color.set(m, 'black')
  }
  for (const m of trackOf.keys()) if (!color.has(m)) visit(m, [])

  // Landable: squashed, every earlier milestone of its track landed or landable, every Lands after and Builds after landed.
  for (const t of tracks) {
    let chain = true
    for (const m of t.milestones) {
      if (m.state === 'landed') continue
      if (m.state === 'open') { chain = false; continue }
      const after = m.landsAfter.filter((id) => !id.bad).map((id) => ({ id, ms: findMilestone(id) }))
      for (const a of after) if (!a.ms) problems.push(`${msId(t.slug, m)}: Lands after ${a.id.track}/${a.id.n} names no milestone`)
      for (const a of m.after) if (!after.some((b) => b.ms === a.m)) after.push({ id: { track: a.track, n: a.m.n }, ms: a.m })
      m.landsAfterOpen = after.filter((a) => !a.ms || a.ms.landed === null).map((a) => `${a.id.track}/${a.id.n}`)
      m.landable = chain && m.landsAfterOpen.length === 0
      chain = m.landable
    }
  }

  // Tracks, with what a call does next in each.
  const out = order.filter((s) => bySlug.has(s)).map((slug) => {
    const t = bySlug.get(slug)
    const g = repo(slug)
    const next = t.milestones.find((m) => m.state === 'open') ?? null
    const branch = (m) => `M${m.n}`
    const has = (m) => (g.git ? g.branches.some((b) => b.endsWith(`/${branch(m)}`)) : null)
    const track = {
      slug,
      repo: g,
      next: next ? next.n : null,
      landable: t.milestones.filter((m) => m.landable).map((m) => m.n),
      milestones: t.milestones.map((m) => ({
        n: m.n,
        folder: m.folder,
        title: m.title,
        state: m.state,
        phase: m.phase,
        resume: m.resume,
        ...(m.state === 'open' ? { ready: m.ready, waitsOn: m.waitsOn, ticketsDone: m.ticketsDone, nextTicket: m.nextTicket } : {}),
        ...(m.state === 'unlanded' ? { landable: m.landable, landsAfterOpen: m.landsAfterOpen } : {}),
        ...(m.state === 'unlanded' && g.git && g.base ? { onBase: isAncestor(g.root, m.squash, g.base) } : {}),
        squash: m.squash,
        landed: m.landed,
        buildsAfter: m.buildsAfter.filter((id) => !id.bad && id.track).map((id) => `${id.track}/${id.n}`),
        landsAfter: m.landsAfter.filter((id) => !id.bad).map((id) => `${id.track}/${id.n}`),
        branch: has(m),
        reviewCurrent: m.review?.head && g.git && has(m) ? git(g.root, ['rev-parse', `sdd/${t.specFolder}/${branch(m)}`]) === m.review.head : null,
        unanswered: m.review?.unanswered ?? [],
        toFix: m.review?.toFix ?? [],
        tickets: m.tickets.map((k) => ({ n: k.n, file: k.file, status: k.status, dependsOn: k.dependsOn.filter((d) => !d.bad).map((d) => (d.track ? `${d.track}/${d.n}` : d.n)), commit: k.commit })),
      })),
    }
    return track
  })

  const queue = out.filter((t) => t.next && (() => { const m = t.milestones.find((x) => x.n === t.next); return m.ticketsDone || m.phase !== 'none' })())
    .map((t) => ({ track: t.slug, milestone: t.next, resume: t.milestones.find((x) => x.n === t.next).resume }))
  const dispatchable = out.filter((t) => t.next && (() => { const m = t.milestones.find((x) => x.n === t.next); return m.ready && m.phase === 'none' && !m.ticketsDone })())
    .map((t) => ({ track: t.slug, milestone: t.next, ticket: t.milestones.find((x) => x.n === t.next).nextTicket }))
  // The frontier: each track's next milestone, once it is ready or an earlier call started it.
  const frontier = out.filter((t) => t.next && (() => {
    const m = t.milestones.find((x) => x.n === t.next)
    return m.ready || m.phase !== 'none' || m.tickets.some((k) => k.status !== 'todo')
  })()).map((t) => ({ track: t.slug, milestone: t.next }))
  const all = out.flatMap((t) => t.milestones)

  return {
    tracks: out,
    closingQueue: queue,
    dispatchable,
    frontier,
    noneOpen: all.every((m) => m.state !== 'open'),
    allLanded: all.length > 0 && all.every((m) => m.state === 'landed'),
    allTodo: all.flatMap((m) => m.tickets).every((k) => k.status === 'todo'),
    migrate,
    problems: [...new Set(problems)],
  }
}

/** The whole state of one spec, as `state` prints it. */
export const specState = (specDir, { brain = resolve(specDir, '..', '..', '..'), useGit = true } = {}) => {
  const spec = readSpecLines(specDir)
  const { layout, tracks } = readTracks(specDir)
  const specFolder = basename(specDir)
  for (const t of tracks) t.specFolder = specFolder
  const links = readLinks(brain)
  const slugs = [...new Set([...spec.repos, ...tracks.map((t) => t.slug)])]
  const repos = new Map(slugs.map((s) => [s, useGit ? repoState(links[s], specFolder, spec.base[s]) : { root: links[s] ?? null, git: false }]))

  const dependencies = spec.dependsOn.map((id) => {
    let dir
    try { dir = resolveSpec(id, brain) } catch { return { id, found: false } }
    const dep = readSpecLines(dir)
    const d = { id, folder: basename(dir), found: true, abandoned: dep.abandoned, landed: dep.landed }
    if (dep.landed && useGit) {
      d.onBase = Object.fromEntries(Object.entries(dep.landed).map(([slug, sha]) => {
        const root = links[slug]
        const base = dep.base[slug]
        return [slug, !root ? 'unlinked' : !base ? 'no base' : isAncestor(root, sha, base)]
      }))
    }
    return d
  })

  const { cap, problem } = readCap(brain)
  const derived = derive({ tracks, layout, repos: spec.repos, repo: (s) => repos.get(s) ?? { git: false } })
  return {
    spec: specFolder,
    dir: specDir,
    brain,
    brainHead: useGit ? git(brain, ['rev-parse', 'HEAD']) : null,
    layout,
    ...spec,
    cap,
    ...(problem ? { capProblem: problem } : {}),
    unlinked: slugs.filter((s) => !links[s]),
    dependencies,
    ...derived,
  }
}

// --- a builder's digest ---------------------------------------------------------------------------------------

const section = (md, name) => {
  const m = new RegExp(`^##\\s+${escape(name)}\\s*$([\\s\\S]*?)(?=^##\\s|(?![\\s\\S]))`, 'm').exec(md)
  return m ? m[1].trim() : ''
}

const notesOf = (ticketMd) => section(ticketMd, 'Notes').replace(/^Left empty;.*$/m, '').trim()

/** The files a commit changed, as a fenced `git show --stat`, or a line saying the commit is not in the repository. */
const changed = (what, sha, root) => {
  const r = spawnSync('git', ['-C', root, 'show', '--stat=200', '--format=', sha], { encoding: 'utf8' })
  const files = r.status === 0 ? r.stdout.replace(/^\n+|\s+$/g, '') : null
  return files ? `Files its ${what} changed:\n\n\`\`\`\n${files}\n\`\`\`` : `Its ${what} ${sha} is not in ${root}.`
}

/**
 * What a ticket's builder needs from around it, as Markdown: its milestone's Delivers, Done when, Builds after and
 * Lands after; for each earlier ticket of its milestone and each ticket its Depends on names, its status, commit,
 * Notes and the files that commit changed; and for each milestone its Builds after names, its Delivers, squash, the
 * files that squash changed and its tickets' Notes. The ticket itself, spec.md and the diffs stay on disk.
 */
export const ticketDigest = (ticketPath, { useGit = true } = {}) => {
  const path = resolve(ticketPath)
  const msDir = resolve(path, '..')
  const specDir = [resolve(msDir, '..', '..'), resolve(msDir, '..', '..', '..')].find((d) => existsSync(join(d, 'spec.md')))
  if (!specDir) throw new Error(`No spec.md above ${ticketPath}`)
  const brain = resolve(specDir, '..', '..', '..')
  const { layout, tracks } = readTracks(specDir)
  const links = readLinks(brain)
  const all = tracks.flatMap((t) => t.milestones.flatMap((m) => m.tickets.map((k) => ({ ...k, track: t.slug, milestone: m }))))
  const self = all.find((k) => resolve(k.milestone.dir, k.file) === path)
  if (!self) throw new Error(`${ticketPath} is not a ticket of ${basename(specDir)}`)
  const m = self.milestone
  const md = read(join(m.dir, 'milestone.md'))

  const picked = new Map()
  const add = (k) => { if (k && k !== self) picked.set(`${k.track}/${k.n}`, k) }
  for (const k of m.tickets) if (k.n < self.n) add(all.find((a) => a.milestone === m && a.n === k.n))
  for (const id of self.dependsOn) {
    if (id.bad) continue
    add(all.find((a) => (layout === 'flat' && id.track === null ? true : a.track === (id.track ?? self.track)) && a.n === id.n))
  }

  const out = [
    `# Around ticket ${self.track}/${self.n}: ${self.title}`,
    '',
    `Spec \`${basename(specDir)}\`. Read the ticket itself in full; read spec.md, and a commit's diff (\`git -C <root> show <commit> -- <path>\`), only for what this leaves open.`,
    '',
    `## Milestone ${m.n}: ${m.title}`,
    '',
    ...['Delivers', 'Done when', 'Builds after', 'Lands after'].map((f) => `**${f}:** ${lineRe(f).exec(md)?.[1].trim() ?? 'none'}`),
    '',
    '## Tickets it builds on',
    '',
  ]
  if (!picked.size) out.push('None: it is the first ticket of its milestone and depends on none.')
  for (const k of [...picked.values()].sort((a, b) => (a.track + a.n).localeCompare(b.track + b.n))) {
    const text = read(join(k.milestone.dir, k.file))
    const root = links[k.track]
    out.push(`### ${k.track}/${k.n}: ${k.title}`, '', `**Status:** ${k.status} · **Commit:** ${k.commit ?? 'none'}${root ? ` · **Root:** ${root}` : ''}`, '')
    out.push('Notes:', '', notesOf(text) || 'none', '')
    if (useGit && k.commit && root) out.push(changed('commit', k.commit, root), '')
  }

  // The milestones of other tracks its milestone builds after: squashed, so their code is final on their spec branch.
  const after = ids(field(md, 'Builds after')).filter((id) => !id.bad && id.track && id.track !== self.track)
  if (after.length) out.push('## Milestones it builds after', '')
  for (const id of after) {
    const dep = tracks.find((t) => t.slug === id.track)?.milestones.find((x) => x.n === id.n)
    if (!dep) { out.push(`### ${id.track}/${id.n}`, '', 'Names no milestone of this spec.', ''); continue }
    const root = links[id.track]
    out.push(`### ${id.track}/${dep.n}: ${dep.title}`, '', `**Delivers:** ${field(read(join(dep.dir, 'milestone.md')), 'Delivers') ?? 'none'}`, `**Squash:** ${dep.squash ?? 'none'}${root ? ` · **Root:** ${root}` : ''}`, '')
    if (useGit && dep.squash && root) out.push(changed('squash', dep.squash, root), '')
    for (const k of dep.tickets) {
      const notes = notesOf(read(join(dep.dir, k.file)))
      if (notes && !/^none\.?$/i.test(notes)) out.push(`Notes of ${id.track}/${k.n} ${k.title}:`, '', notes, '')
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

// --- writing lines --------------------------------------------------------------------------------------------

/** Sets a `**name:** value` line in md; when absent, inserts it under the `after` line. Returns the new text. */
export const setLine = (md, name, value, after) => {
  const re = lineRe(name)
  if (re.test(md)) return md.replace(re, () => `**${name}:** ${value}`)
  if (!after) throw new Error(`No **${name}:** line, and no --after line to create it under`)
  const a = lineRe(after).exec(md)
  if (!a) throw new Error(`No **${name}:** line, and no **${after}:** line to create it under`)
  const end = a.index + a[0].length
  return `${md.slice(0, end)}\n\n**${name}:** ${value}${md.slice(end)}`
}

/** Appends an entry to a line, unless the line already ends with it. */
export const appendLine = (md, name, entry, sep = '; ', after) => {
  const v = field(md, name)
  if (v === null || isNone(v)) return setLine(md, name, entry, after)
  if (v.split(sep.trim()).map((s) => s.trim()).at(-1) === entry.trim()) return md
  return setLine(md, name, `${v}${sep}${entry}`)
}

// --- assembling a review --------------------------------------------------------------------------------------

const AXES = [['standards', 'Standards', 'ST'], ['spec', 'Spec', 'SP'], ['consumers', 'Consumers', 'CN']]

/**
 * review-changes' step 6 from the files its sub-agents wrote: `review.<axis>[.<slug>].md`, each numbering its own
 * findings from 1. Numbers each axis straight on across its files, in the order given, under `## <Axis>` (and a
 * `### <slug>` per file when an axis has several), below the header and the Summary file. Returns { text, counts,
 * renumbered }: the findings per axis, and each ID a later file's offset changed.
 */
export const assembleReview = ({ title, fixed, head, summary, sections }) => {
  const counts = {}
  const renumbered = []
  const out = [`# Review: ${title}`, '', `**Fixed point:** ${fixed}`, '', `**Head:** ${head}`, '', summary.trim(), '']
  for (const [axis, name, prefix] of AXES) {
    const files = sections.filter((s) => s.axis === axis)
    if (!files.length) continue
    out.push(`## ${name}`, '')
    let offset = 0
    for (const s of files) {
      const own = [...new Set(findings(s.text).map((f) => f.id).filter((id) => id.startsWith(prefix)))]
      let text = s.text.trim()
      if (offset) {
        text = text.replace(new RegExp(`\\b${prefix}(\\d+)\\b`, 'g'), (id, n) => {
          if (!own.includes(id)) return id
          const to = `${prefix}${Number(n) + offset}`
          renumbered.push(`${s.slug ?? axis}: ${id} → ${to}`)
          return to
        })
      }
      if (files.length > 1) out.push(`### ${s.slug ?? axis}`, '')
      out.push(text, '')
      offset += own.length
    }
    counts[name] = offset
  }
  return { text: out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n', counts, renumbered }
}

// --- closing a milestone ----------------------------------------------------------------------------------------

/** The milestone a ticket or milestone path names: { specDir, specFolder, brain, track, m, root, branch }. */
const locate = (path) => {
  const p = resolve(path)
  const msDir = /\.md$/i.test(p) ? resolve(p, '..') : p
  const specDir = [resolve(msDir, '..', '..'), resolve(msDir, '..', '..', '..')].find((d) => existsSync(join(d, 'spec.md')))
  if (!specDir) throw new Error(`No spec.md above ${path}`)
  const brain = resolve(specDir, '..', '..', '..')
  const t = readTracks(specDir).tracks.find((x) => x.milestones.some((m) => resolve(m.dir) === msDir))
  if (!t) throw new Error(`${path} is not in a milestone of ${basename(specDir)}`)
  const m = t.milestones.find((x) => resolve(x.dir) === msDir)
  const root = readLinks(brain)[t.slug]
  if (!root) throw new Error(`${t.slug} is not in ${join(brain, '.brain', 'links.json')}`)
  const specFolder = basename(specDir)
  return { specDir, specFolder, brain, track: t.slug, m, root, branch: `sdd/${specFolder}/M${m.n}` }
}

/** The commit key for a repository, by the commit skill's step 1 from spec.md's **Key** line and its card. */
export const commitKey = (keyLine, slug, card) => {
  let key = keyLine
  if (!isNone(key) && /^[\w.-]+:\s/.test(key)) {
    const entry = key.split(',').map((e) => e.trim()).find((e) => e.startsWith(`${slug}:`))
    key = entry ? entry.slice(slug.length + 1).trim() : null
  }
  if (isNone(key)) return null
  const p = card === null ? undefined : /^commitKeyPattern:\s*(.*)$/m.exec(card)?.[1].trim()
  if (p === 'null') return null
  if (p) {
    const pattern = p.startsWith('"') ? JSON.parse(p) : p.replace(/^'|'$/g, '')
    if (!new RegExp(`^(?:${pattern})$`).test(key)) throw new Error(`Key ${key} does not fully match ${slug}'s commitKeyPattern ${pattern}`)
  }
  return key
}

const run = (root, args, input) => {
  const r = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', input })
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${(r.stderr || r.stdout).trim().split('\n').slice(-3).join(' / ')}`)
  return r.stdout.trim()
}

/**
 * Build's step 10 in one call: squashes the milestone's branch into the spec's branch as one keyed commit with its
 * Sdd-Milestone trailer, then writes `squash` into its **Phase** and the commit into **Squash**. Returns the SHA.
 */
export const squash = (path, { title, details = [], key: given }) => {
  const { specDir, specFolder, brain, track, m, root, branch } = locate(path)
  const msPath = join(m.dir, 'milestone.md')
  if (m.squash) return { sha: m.squash, already: true }
  if (!title) throw new Error('No --title for the squash commit')
  const spec = readSpecLines(specDir)
  const cardPath = join(brain, 'repos', track, 'REPO.md')
  const key = commitKey(given ?? spec.key, track, existsSync(cardPath) ? read(cardPath) : null)
  const subject = key ? `${key}: ${title}` : title
  if (subject.length > 72) throw new Error(`The subject is ${subject.length} characters; the commit skill allows 72: ${subject}`)
  if (run(root, ['status', '--porcelain']) !== '') throw new Error(`${root} has uncommitted changes`)
  const specBranch = `sdd/${specFolder}/spec`
  run(root, ['checkout', '-q', specBranch])
  let sha
  if (run(root, ['diff', specBranch, branch]) === '') sha = run(root, ['rev-parse', 'HEAD'])
  else {
    run(root, ['merge', '--squash', branch])
    const body = details.length ? `\n\n${details.map((d) => `- ${d}`).join('\n')}` : ''
    run(root, ['commit', '-q', '-F', '-'], `${subject}${body}\n\nSdd-Milestone: ${specFolder}/${track}/M${m.n}\n`)
    sha = run(root, ['rev-parse', 'HEAD'])
  }
  // The lines go last, so a file this process cannot write still leaves the squash committed and its SHA reported.
  try {
    writeFileSync(msPath, setLine(setLine(read(msPath), 'Phase', 'squash', 'Lands after'), 'Squash', sha))
  } catch (e) {
    throw new Error(`squashed: ${sha}, but ${msPath} could not be written (${e.code ?? e.message}): write **Phase:** squash and **Squash:** ${sha} into it`)
  }
  return { sha, already: false }
}

/**
 * BRIEF.md's **After a sub-agent that changes a repository reports**, in one call, for the milestone a ticket or
 * milestone path names: the repository is on its branch and clean, each commit (and a ticket's **Commit**) is on
 * that branch, and the brain has no change outside `.brain/` and, given one, is still at `brainHead`.
 */
export const verify = (path, { commits = [], brainHead } = {}) => {
  const { root, branch, brain } = locate(path)
  const problems = []
  const ticket = /\d{3}-[^/\\]+\.md$/.test(path) && !/milestone\.md$/.test(path) ? read(resolve(path)) : null
  const shas = [...commits, ...(ticket && orNull(field(ticket, 'Commit')) ? [field(ticket, 'Commit')] : [])]
  const head = git(root, ['rev-parse', '--abbrev-ref', 'HEAD'])
  if (head !== branch) problems.push(`${root} is on ${head}, not ${branch}`)
  for (const sha of new Set(shas)) {
    if (spawnSync('git', ['-C', root, 'cat-file', '-e', `${sha}^{commit}`]).status !== 0) problems.push(`commit ${sha} is not in ${root}`)
    else if (!isAncestor(root, sha, 'HEAD')) problems.push(`commit ${sha} is not on ${head}`)
  }
  const dirty = git(root, ['status', '--porcelain'])
  if (dirty) problems.push(`${root} has uncommitted changes: ${dirty.split('\n').slice(0, 5).join(', ')}`)
  if (git(brain, ['rev-parse', '--git-dir']) !== null) {
    const changed = git(brain, ['status', '--porcelain', '--', '.', ':!.brain'])
    if (changed) problems.push(`the brain has changes outside .brain/: ${changed.split('\n').slice(0, 5).join(', ')}`)
    const bh = git(brain, ['rev-parse', 'HEAD'])
    if (brainHead && bh !== brainHead) problems.push(`the brain moved from ${brainHead} to ${bh}`)
  }
  const status = ticket ? field(ticket, 'Status') : null
  const commit = ticket ? orNull(field(ticket, 'Commit')) : null
  if (ticket && (status !== 'done' || !commit)) problems.push(`the ticket is ${status ?? 'without a Status'} with Commit ${commit ?? 'none'}, not done with its commit`)
  return { problems, status, commit }
}

// --- the command line -----------------------------------------------------------------------------------------

const main = (argv) => {
  const [cmd, ...rest] = argv
  const opts = {}
  const pos = []
  const many = { detail: [], commit: [] }
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--no-git') opts.noGit = true
    else if (rest[i].slice(2) in many) many[rest[i].slice(2)].push(rest[++i])
    else if (rest[i].startsWith('--')) opts[rest[i].slice(2)] = rest[++i]
    else pos.push(rest[i])
  }
  if (cmd === 'mark' && pos.length >= 3 && pos.length % 2 === 1) {
    const [file, ...pairs] = pos
    let md = read(file)
    for (let i = 0; i < pairs.length; i += 2) {
      const m = /^([^:]+):\s*([\s\S]*)$/.exec(pairs[i + 1])
      if (!m) throw new Error(`"${pairs[i + 1]}" is not "<Line>: <value>"`)
      md = markFinding(md, pairs[i], m[1].trim(), m[2].trim())
    }
    writeFileSync(file, md)
    console.log(`${file}: marked ${pairs.filter((_, i) => i % 2 === 0).join(', ')}`)
    return
  }
  if (cmd === 'review' && pos.length >= 2 && opts.title && opts.fixed && opts.head && opts.summary) {
    const [target, ...files] = pos
    if (existsSync(target) && /\*\*Answer:\*\*/.test(read(target))) throw new Error(`${target} holds Answer lines: keep this report in chat`)
    const sections = files.map((f) => {
      const m = /^review\.(standards|spec|consumers)(?:\.([\w.-]+))?\.md$/.exec(basename(f))
      if (!m) throw new Error(`${f} is not named review.<standards|spec|consumers>[.<slug>].md`)
      return { axis: m[1], slug: m[2] ?? null, text: read(f) }
    })
    const r = assembleReview({ title: opts.title, fixed: opts.fixed, head: opts.head, summary: read(opts.summary), sections })
    writeFileSync(target, r.text)
    for (const f of [...files, opts.summary]) if (resolve(f) !== resolve(target)) rmSync(f)
    console.log(`${target}: ${Object.entries(r.counts).map(([a, n]) => `${a} ${n}`).join(', ')}`)
    for (const line of r.renumbered) console.log(`renumbered ${line}`)
    return
  }
  if (cmd === 'squash' && pos.length === 1) {
    const { sha, already } = squash(pos[0], { title: opts.title, details: many.detail, key: opts.key })
    console.log(already ? `already squashed: ${sha}` : `squashed: ${sha}`)
    return
  }
  if (cmd === 'verify' && pos.length === 1) {
    const r = verify(pos[0], { commits: many.commit, brainHead: opts['brain-head'] })
    if (r.status) console.log(`ticket: Status ${r.status}, Commit ${r.commit ?? 'none'}`)
    for (const p of r.problems) console.log(`problem: ${p}`)
    if (r.problems.length) process.exit(1)
    console.log('ok')
    return
  }
  if (cmd === 'state' && pos.length === 1) {
    const brain = resolve(opts.brain ?? '.')
    const dir = resolveSpec(pos[0], brain)
    const s = specState(dir, { useGit: !opts.noGit, ...(opts.brain ? { brain } : {}) })
    console.log(JSON.stringify(s, (k, v) => (v === null || (Array.isArray(v) && !v.length) ? undefined : v), 1))
    return
  }
  if (cmd === 'brief' && pos.length === 1) {
    process.stdout.write(ticketDigest(pos[0], { useGit: !opts.noGit }))
    return
  }
  if ((cmd === 'set' || cmd === 'append') && pos.length === 3) {
    const [file, name, value] = pos
    const md = read(file)
    const next = cmd === 'set' ? setLine(md, name, value, opts.after) : appendLine(md, name, value, opts.sep ?? '; ', opts.after)
    if (next === md) return console.log(`unchanged: ${file} **${name}:**`)
    writeFileSync(file, next)
    console.log(`${file}: **${name}:** ${field(next, name)}`)
    return
  }
  console.error('Usage: node sdd.mjs state <spec-id|spec-folder> [--brain <brain>] [--no-git]\n' +
    '       node sdd.mjs brief <ticket-file> [--no-git]\n' +
    '       node sdd.mjs set <file> <Line> <value> [--after <Line>]\n' +
    "       node sdd.mjs append <file> <Line> <entry> [--sep '; '] [--after <Line>]\n" +
    '       node sdd.mjs mark <review.md> <ID> "<Line>: <value>" [<ID> "<Line>: <value>"]...\n' +
    '       node sdd.mjs review <review.md> --title <t> --fixed <sha> --head <sha> --summary <file> <review.<axis>[.<slug>].md>...\n' +
    '       node sdd.mjs squash <milestone-folder|milestone.md> --title <title> [--detail <bullet>]... [--key <key|none>]\n' +
    '       node sdd.mjs verify <ticket|milestone.md> [--commit <sha>]... [--brain-head <sha>]')
  process.exit(2)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)) } catch (e) { console.error(e.message); process.exit(1) }
}
