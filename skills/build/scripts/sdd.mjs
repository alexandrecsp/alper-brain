#!/usr/bin/env node
// Reads and writes a spec's pipeline files by the brain's FORMAT.md **Specs** and build's SKILL.md, so the rules
// a script can decide (Tracks, Phase, landable, the dependency checks, the cap) are decided the same way every call.
//
//   node sdd.mjs state <spec-id|spec-folder> [--brain <brain>] [--no-git]
//     Prints the spec as JSON: its lines, its dependencies, the cap, and per track its milestones with each one's
//     state (open, unlanded, landed), the step it resumes at, whether it is ready or landable, the frontier a call
//     builds, and, read from git through the brain's repos.json, whether its branch exists and the repository is clean,
//     and, while its base is still to be defined, the release branches RELEASE.md's **Offer** gives.
//   node sdd.mjs brief <ticket-file> [--no-git]
//     Prints, as Markdown, what the ticket's builder needs from around it: its milestone's lines, the Notes and
//     changed files of each earlier ticket of its milestone and each ticket its Depends on names, and each
//     milestone its milestone's Builds after names, with its squash's changed files and its tickets' Notes.
//   node sdd.mjs set <file> <Line> <value> [--after <Line>]
//     Sets a `**Line:** value` line; when the file has none, creates it under the --after line, else fails.
//   node sdd.mjs append <file> <Line> <entry> [--sep '; '] [--after <Line>]
//     Appends an entry to a line, skipping one the line already ends with, as `land` does for **Landings**.
//   node sdd.mjs mark <review.md> <ID> "<Line>: <value>" [<ID> "<Line>: <value>"]...
//     Writes `**Line:** value` under each finding named, replacing that line when the finding already has one:
//     build's Answer, Fixed and Not fixed lines. Then prints the review's `unanswered` and `toFix`.
//   node sdd.mjs review <review.md> --title <t> --fixed <sha> --head <sha> [--summary <file>] <section-file>...
//     review-changes' step 6: writes review.md from the section files its sub-agents wrote
//     (review.<standards|spec|consumers>[.<slug>].md), numbering each axis straight on, under a Summary: the file
//     given, or one drawn from the files' counts and `## Map` rows. Deletes the files it read, then prints the
//     Summary's line and the review's `unanswered` and `toFix`. Refuses a review.md that holds Answer lines.
//   node sdd.mjs squash <milestone-folder|milestone.md> --title <title> [--detail <bullet>]... [--key <key|none>]
//     Build's step 10: squashes the milestone's branch into the spec's as one commit keyed by
//     the commit skill's step 1 (or --key, `none` for no key), with its Sdd-Milestone trailer, and writes it into
//     Phase and Squash. Idempotent.
//   node sdd.mjs verify <ticket|milestone.md> [--commit <sha>]... [--brain-head <sha>] [--branch <b>]
//     BRIEF.md's check after a sub-agent that changes a repository, and for a ticket that it is done with its commit:
//     prints the ticket's Status and Commit, then `ok`, or each problem and exits 1.
//   node sdd.mjs context <ticket|milestone.md> --agent <builder|fixer|arbiter|standards-reviewer|spec-reviewer> [--writes <f>]...
//     Prints the agent's Context block by BRIEF.md, every line filled from the spec, the brain and the repository.
//   node sdd.mjs dispatch <ticket|milestone.md> --agent <…> [--writes <f>]... [--branch <b>]
//     Writes that block to the milestone's .context/ folder, sets a builder's ticket to doing, and prints the brief's
//     opening: the Works in line, the block's file, and the paths the agent works on.
//   node sdd.mjs next <ticket> [--commit <sha>]... [--brain-head <sha>]
//     `verify` for a builder's or fixer's ticket, then `dispatch` of its milestone's next ticket, or that all are done.
//   node sdd.mjs land <spec-id|spec-folder> --track <slug> [--brain <brain>] [--fold]
//     LAND.md's **Land a track**: rebase, follow each squash, full suite, fast-forward the base, record the landing.
//     Exits 1 with `stopped: <why>` when it cannot; --fold first folds a fixer's commits into the track's last squash.
//   node sdd.mjs lock <spec-id|spec-folder> [--brain <brain>] [--take]
//     Build's **Locks**: claims each repository the spec still changes in the brain's .local/locks/<slug>.json. Exits 1 with a
//     `held:` line per repository another spec's build holds, unless --take. `unlock` releases this spec's claims.
//   node sdd.mjs merged <spec-id|spec-folder> --track <slug> [--brain <brain>] [--commit <sha>] [--realign]
//     open-pr's **Follow the merge**: once origin/<base> (as last fetched) holds the track's last landing, or the
//     PR's merge --commit, brings the local base level with it and records spec.md's **Merged** entry. Exits 1 with
//     `stopped: <why>`, and `drops:` lines for the squashes --realign would drop from the local base.
//
// Exits 1 with one line on stderr when it cannot read or write what it was given.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { RecallError, rank } from '../../brain/scripts/recall.mjs'
import { brainOfSpec, findBrain, fwd, oldLayoutOf, pathsOf, specFolderOf } from '../../brain/scripts/layout.mjs'

export const DEFAULT_CAP = 5
/** This plugin's root: sdd.mjs sits in skills/build/scripts/. */
const PLUGIN = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const slash = (p) => p.replace(/\\/g, '/')

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
/** A ticket's **Commit** SHA, without the `(squashed into M<NNN>)` mark a squash adds; null when none. */
const commitOf = (md) => orNull(field(md, 'Commit'))?.split(/\s+/)[0] ?? null
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
const dirs = (p) => (existsSync(p) ? readdirSync(p).filter((n) => !n.startsWith('.') && statSync(join(p, n)).isDirectory()).sort() : [])
const numbered = (n) => /^\d{3}/.test(n)

/** The brain root a folder names: the `.brain/` it holds or is, else the folder itself. */
const rootOf = (folder) => resolve(findBrain(folder) ?? folder)
// The clusters layout is the one sdd.mjs reads. A brain still in the one-folder layout, as the one a build is moving
// off it, keeps working by its own paths until its move: oneFolder, brainOf, oneFolderPaths and readTracks hold that, and go
// with it. docs/STRUCTURE.md records this as the one exception to layout.mjs being the one home of the brain's paths.
const oneFolder = (brain) => oldLayoutOf(rootOf(brain)) === 'one-folder'
/** The brain root above a spec folder: three levels up from `.local/specs/<spec>`, two from a one-folder brain's `specs/<spec>`. */
const brainOf = (specDir) =>
  resolve(basename(dirname(dirname(specDir))) === '.local' ? brainOfSpec(specDir) : dirname(dirname(specDir)))
/** The paths sdd.mjs reads in a one-folder brain, under the keys of pathsOf: layout.mjs holds the clusters paths only. */
const oneFolderPaths = (root) => {
  const at = (...parts) => fwd(join(root, ...parts))
  return { notes: at('notes'), specs: at('specs'), config: at('config.json'), reposJson: at('repos', 'repos.json'), locks: at('locks'), card: (slug) => at('repos', slug, 'REPO.md') }
}
/** Every path of a brain, by layout.mjs: the folder given is the brain's root or the folder holding it. */
const pathsFor = (brain) => (oneFolder(brain) ? oneFolderPaths(rootOf(brain)) : pathsOf(rootOf(brain)))

/** The spec folder a spec id names under the brain's `.local/specs/` (a one-folder brain's `specs/`), by SPEC-ID.md. */
export const resolveSpec = (arg, brain) => {
  const asPath = resolve(arg)
  if (existsSync(join(asPath, 'spec.md'))) return asPath
  const m = /^s?(\d+)/i.exec(basename(arg.replace(/[\\/]+$/, '')))
  if (!m) throw new Error(`Not a spec id or spec folder: ${arg}`)
  const nnn = m[1].padStart(3, '0')
  const root = pathsFor(brain).specs
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
        commit: commitOf(t),
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

/**
 * Every milestone of a spec folder, in tracks: [{ slug, milestones }], with the layout it was read in. The folders
 * straight in the spec folder are its milestones when they start with three digits (flat), else its tracks; a
 * one-folder brain's spec holds them under `milestones/`.
 */
export const readTracks = (specDir) => {
  const root = existsSync(join(specDir, 'milestones')) ? join(specDir, 'milestones') : specDir
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
    merged: field(md, 'Merged') === null ? null : atEntries(field(md, 'Merged')),
    abandoned: field(md, 'Abandoned'),
  }
}

/** The `parallelAgents` setting by FORMAT.md's **Settings**: { cap, problem }. */
export const readCap = (brain) => {
  const path = pathsFor(brain).config
  if (!existsSync(path)) return { cap: DEFAULT_CAP }
  let cfg
  try { cfg = JSON.parse(read(path)) } catch { return { cap: DEFAULT_CAP, problem: `${path} does not parse as JSON` } }
  if (cfg === null || typeof cfg !== 'object' || Array.isArray(cfg)) return { cap: DEFAULT_CAP, problem: `${path} is not a JSON object` }
  const v = cfg.parallelAgents
  if (v === undefined) return { cap: DEFAULT_CAP }
  return Number.isInteger(v) && v > 0 ? { cap: v } : { cap: DEFAULT_CAP, problem: `parallelAgents ${JSON.stringify(v)} is not a positive whole number` }
}

// The clones the brain registers, by slug: its .local/repos.json.
const readRepos = (brain) => {
  const path = pathsFor(brain).reposJson
  if (!existsSync(path)) return {}
  try { return JSON.parse(read(path)) } catch { return {} }
}

// --- release branches -----------------------------------------------------------------------------------------

/** An `rlse/vX.Y.Z` branch's version and the three after it, by RELEASE.md; null for any other branch. */
export const releaseOf = (branch) => {
  const m = /^rlse\/v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(branch ?? '')
  if (!m) return null
  const [major, minor, patch] = m.slice(1).map(Number)
  return {
    version: `${major}.${minor}.${patch}`,
    next: { patch: `${major}.${minor}.${patch + 1}`, minor: `${major}.${minor + 1}.0`, major: `${major + 1}.0.0` },
  }
}

/**
 * The release branches RELEASE.md's **Offer** gives, from git's full ref names: the default branch when it is one,
 * then the highest version among the local and origin's branches, each once, as { branch, version, next }.
 */
export const releasesToOffer = (refs, defaultBranch) => {
  const found = refs
    .map((ref) => ref.replace(/^refs\/(?:heads|remotes\/origin)\//, ''))
    .filter(releaseOf)
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
  const picked = new Set([defaultBranch, found.at(-1)].filter(releaseOf))
  return [...picked].map((branch) => ({ branch, ...releaseOf(branch) }))
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
  const specBranch = branches.includes(`sdd/${specFolder}/spec`)
  const releases = base || specBranch ? [] : releasesToOffer(
    (git(root, ['for-each-ref', '--format=%(refname)', 'refs/heads/rlse/', 'refs/remotes/origin/rlse/']) ?? '').split('\n').filter(Boolean),
    baseBranch,
  )
  return {
    root,
    git: true,
    head: git(root, ['symbolic-ref', '--short', '-q', 'HEAD']),
    clean: (git(root, ['status', '--porcelain']) ?? 'x') === '',
    base: baseBranch,
    baseFrom,
    releases,
    specBranch,
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
export const specState = (specDir, { brain: given = brainOf(specDir), useGit = true } = {}) => {
  const brain = rootOf(given)
  const spec = readSpecLines(specDir)
  const { layout, tracks } = readTracks(specDir)
  const specFolder = basename(specDir)
  for (const t of tracks) t.specFolder = specFolder
  const clones = readRepos(brain)
  const slugs = [...new Set([...spec.repos, ...tracks.map((t) => t.slug)])]
  const repos = new Map(slugs.map((s) => [s, useGit ? repoState(clones[s], specFolder, spec.base[s]) : { root: clones[s] ?? null, git: false }]))

  const dependencies = spec.dependsOn.map((id) => {
    let dir
    try { dir = resolveSpec(id, brain) } catch { return { id, found: false } }
    const dep = readSpecLines(dir)
    const d = { id, folder: basename(dir), found: true, abandoned: dep.abandoned, landed: dep.landed, merged: dep.merged }
    if (dep.landed && useGit) {
      // A repository with a remote counts the dependency once its PR merged, by its Merged entry; a local-only one
      // once it landed.
      d.onBase = Object.fromEntries(Object.entries(dep.landed).map(([slug, landedSha]) => {
        const root = clones[slug]
        const base = dep.base[slug]
        const sha = localOnly(brain, slug) ? landedSha : dep.merged?.[slug]
        return [slug, !root ? 'unlinked' : !base ? 'no base' : !sha ? 'not merged' : isAncestor(root, sha, base)]
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
    unlinked: slugs.filter((s) => !clones[s]),
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
  const specDir = specFolderOf(msDir)
  if (!specDir || !existsSync(join(specDir, 'spec.md'))) throw new Error(`No spec.md above ${ticketPath}`)
  const brain = brainOf(specDir)
  const { layout, tracks } = readTracks(specDir)
  const clones = readRepos(brain)
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
    const root = clones[k.track]
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
    const root = clones[id.track]
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
const MARKS = ['escalate', 'violation', 'judgement']

/** A findings file's `## Map` rows, `- \`<path>\`: <IDs>; worst <mark>[; calls \`<path>\`, …]`, and its text without them. */
export const mapRows = (text) => {
  const m = /^##\s+Map\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/m.exec(text)
  if (!m) return { rows: [], text }
  const rows = m[1].split('\n').map((l) => /^\s*[-*]\s+`([^`]+)`:\s*((?:[A-Z]{2}\d+)(?:\s*,\s*[A-Z]{2}\d+)*)\s*;\s*worst\s+(escalate|violation|judgement)\s*(?:;\s*calls\s+(.*))?$/i.exec(l))
    .filter(Boolean)
    .map(([, path, idList, worst, calls]) => ({ path, ids: idList.split(',').map((s) => s.trim()), worst: worst.toLowerCase(), calls: [...(calls ?? '').matchAll(/`([^`]+)`/g)].map((c) => c[1]) }))
  return { rows, text: text.slice(0, m.index) + text.slice(m.index + m[0].length) }
}

/** One axis's Summary sentence: its findings, how many are flagged escalate, and its worst one. */
const axisLine = (name, text) => {
  const fs = findings(text)
  if (!fs.length) return `${name}: no findings.`
  const esc = fs.filter((f) => /\bescalate\b/i.test(f.text))
  const worst = esc[0] ?? fs.find((f) => /hard violation|built wrong|\bmissing\b|\bpartial\b|\bbreaks\b/i.test(f.text)) ?? fs[0]
  const what = worst.text.split('\n')[0].replace(/^\s*(?:[-*]\s+|#{1,4}\s+)?(?:\*\*)?[A-Z]{2}\d+(?:\*\*)?\s*/, '').replace(/\*\*/g, '').trim()
  return `${name}: ${fs.length} finding${fs.length > 1 ? 's' : ''}, ${esc.length} escalate; worst ${worst.id}, ${what.length > 140 ? `${what.slice(0, 137)}...` : what}`
}

/** DIAGRAMS.md's finding map from the map rows: each module with its IDs, marked by its worst finding. */
export const findingMap = (rows) => {
  if (!rows.length) return ''
  const nodes = new Map()
  const node = (path) => {
    if (!nodes.has(path)) nodes.set(path, { id: `m${nodes.size + 1}`, path, ids: [], worst: null })
    return nodes.get(path)
  }
  for (const r of rows) {
    const n = node(r.path)
    n.ids.push(...r.ids.filter((id) => !n.ids.includes(id)))
    if (n.worst === null || MARKS.indexOf(r.worst) < MARKS.indexOf(n.worst)) n.worst = r.worst
  }
  const edges = new Set(rows.flatMap((r) => r.calls.map((c) => `${node(r.path).id} --> ${node(c).id}`)))
  const label = (n) => `${n.id}["${n.path.replace(/"/g, "'")}${n.ids.length ? `<br>${n.ids.join(', ')}` : ''}"]${n.worst ? `:::${n.worst}` : ''}`
  return ['```mermaid', 'flowchart TD', ...[...nodes.values()].map((n) => `    ${label(n)}`), ...[...edges].map((e) => `    ${e}`),
    '    classDef violation stroke:#ef4444,fill:#ef444426', '    classDef judgement stroke:#f59e0b,fill:#f59e0b26', '    classDef escalate stroke:#8b5cf6,fill:#8b5cf626', '```'].join('\n')
}

/**
 * review-changes' step 6 from the files its sub-agents wrote: `review.<axis>[.<slug>].md`, each numbering its own
 * findings from 1. Numbers each axis straight on across its files, in the order given, under `## <Axis>` (and a
 * `### <slug>` per file when an axis has several), below the header and the Summary. The Summary is the file given,
 * or, without one, a line per axis and the finding map drawn from each file's `## Map` rows, which leave its text.
 * Returns { text, counts, renumbered }: the findings per axis, and each ID a later file's offset changed.
 */
export const assembleReview = ({ title, fixed, head, summary, sections }) => {
  const counts = {}
  const renumbered = []
  const body = []
  const lines = []
  const rows = []
  for (const [axis, name, prefix] of AXES) {
    const files = sections.filter((s) => s.axis === axis)
    if (!files.length) { if (axis !== 'consumers') lines.push(`${name}: not run.`); continue }
    body.push(`## ${name}`, '')
    let offset = 0
    let all = ''
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
      const map = mapRows(text)
      rows.push(...map.rows)
      text = map.text.trim()
      all += `${text}\n`
      if (files.length > 1) body.push(`### ${s.slug ?? axis}`, '')
      body.push(text, '')
      offset += own.length
    }
    counts[name] = offset
    lines.push(axisLine(name, all))
  }
  const sum = summary?.trim() || ['## Summary', '', lines.join(' '), '', findingMap(rows)].join('\n').trim()
  const out = [`# Review: ${title}`, '', `**Fixed point:** ${fixed}`, '', `**Head:** ${head}`, '', sum, '', ...body]
  return { text: out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n', counts, renumbered }
}

// --- closing a milestone ----------------------------------------------------------------------------------------

/** The milestone a ticket or milestone path names: { specDir, specFolder, brain, track, m, root, branch }. */
const locate = (path) => {
  const p = resolve(path)
  const msDir = /\.md$/i.test(p) ? resolve(p, '..') : p
  const specDir = specFolderOf(msDir)
  if (!specDir || !existsSync(join(specDir, 'spec.md'))) throw new Error(`No spec.md above ${path}`)
  const brain = brainOf(specDir)
  const t = readTracks(specDir).tracks.find((x) => x.milestones.some((m) => resolve(m.dir) === msDir))
  if (!t) throw new Error(`${path} is not in a milestone of ${basename(specDir)}`)
  const m = t.milestones.find((x) => resolve(x.dir) === msDir)
  const root = readRepos(brain)[t.slug]
  if (!root) throw new Error(`${t.slug} is not in ${pathsFor(brain).reposJson}`)
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
 * After a squash is recorded: marks each ticket's **Commit** line `(squashed into M<NNN>)`, since its commit leaves every
 * branch, then deletes the milestone's branch. Safe to run again. Returns what it could not do, as warnings.
 */
const retire = (m, root, branch) => {
  const warnings = []
  for (const k of m.tickets) {
    const p = join(m.dir, k.file)
    const t = read(p)
    const v = orNull(field(t, 'Commit'))
    if (!v || /\(squashed into /.test(v)) continue
    try { writeFileSync(p, setLine(t, 'Commit', `${v} (squashed into M${m.n})`)) }
    catch (e) { warnings.push(`not written: ${p} (${e.code ?? e.message}): write **Commit:** ${v} (squashed into M${m.n}) into it`) }
  }
  if (spawnSync('git', ['-C', root, 'rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]).status === 0) {
    if (git(root, ['rev-parse', '--abbrev-ref', 'HEAD']) === branch) warnings.push(`${branch} is checked out in ${root}, so it was kept: delete it once another branch is`)
    else {
      const r = spawnSync('git', ['-C', root, 'branch', '-D', branch], { encoding: 'utf8' })
      if (r.status !== 0) warnings.push(`${branch} was kept: ${(r.stderr || r.stdout).trim()}`)
    }
  }
  return warnings
}

/**
 * Build's step 10 in one call: squashes the milestone's branch into the spec's branch as one keyed commit with its
 * Sdd-Milestone trailer, writes `squash` into its **Phase** and the commit into **Squash**, then retires the
 * milestone's branch and marks its tickets' commits. Returns the SHA and the warnings.
 */
export const squash = (path, { title, details = [], key: given }) => {
  const { specDir, specFolder, brain, track, m, root, branch } = locate(path)
  const msPath = join(m.dir, 'milestone.md')
  if (m.squash) return { sha: m.squash, already: true, warnings: retire(m, root, branch) }
  if (!title) throw new Error('No --title for the squash commit')
  const spec = readSpecLines(specDir)
  const cardPath = pathsFor(brain).card(track)
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
  return { sha, already: false, warnings: retire(m, root, branch) }
}

/**
 * BRIEF.md's **After a sub-agent that changes a repository reports**, in one call, for the milestone a ticket or
 * milestone path names: the repository is on its branch and clean, each commit (and a ticket's **Commit**) is on
 * that branch, and the brain has no change and, given one, is still at `brainHead`.
 */
export const verify = (path, { commits = [], brainHead, branch: onBranch } = {}) => {
  const { root, branch: msBranch, brain } = locate(path)
  const branch = onBranch ?? msBranch
  const problems = []
  const ticket = /\d{3}-[^/\\]+\.md$/.test(path) && !/milestone\.md$/.test(path) ? read(resolve(path)) : null
  const shas = [...commits, ...(ticket && commitOf(ticket) ? [commitOf(ticket)] : [])]
  const head = git(root, ['rev-parse', '--abbrev-ref', 'HEAD'])
  if (head !== branch) problems.push(`${root} is on ${head}, not ${branch}`)
  for (const sha of new Set(shas)) {
    if (spawnSync('git', ['-C', root, 'cat-file', '-e', `${sha}^{commit}`]).status !== 0) problems.push(`commit ${sha} is not in ${root}`)
    else if (!isAncestor(root, sha, 'HEAD')) problems.push(`commit ${sha} is not on ${head}`)
  }
  const dirty = git(root, ['status', '--porcelain'])
  if (dirty) problems.push(`${root} has uncommitted changes: ${dirty.split('\n').slice(0, 5).join(', ')}`)
  if (git(brain, ['rev-parse', '--git-dir']) !== null) {
    // The brain ignores every pipeline file, so any change git shows in its folder is a shared file's.
    const changed = git(brain, ['status', '--porcelain', '--', '.'])
    if (changed) problems.push(`the brain has changes: ${changed.split('\n').slice(0, 5).join(', ')}`)
    const bh = git(brain, ['rev-parse', 'HEAD'])
    if (brainHead && bh !== brainHead) problems.push(`the brain moved from ${brainHead} to ${bh}`)
  }
  const status = ticket ? field(ticket, 'Status') : null
  const commit = ticket ? commitOf(ticket) : null
  if (ticket && (status !== 'done' || !commit)) problems.push(`the ticket is ${status ?? 'without a Status'} with Commit ${commit ?? 'none'}, not done with its commit`)
  return { problems, status, commit }
}

// --- briefing a sub-agent ---------------------------------------------------------------------------------------

export const AGENTS = ['builder', 'fixer', 'arbiter', 'standards-reviewer', 'spec-reviewer']

/** The brain's shared and draft `contract` notes (a one-folder brain's, all its notes) whose `repos` line names the slug: [{ path, repos }]. */
const contractNotes = (brain, slug) => {
  const out = []
  const walk = (dir) => {
    for (const n of existsSync(dir) ? readdirSync(dir) : []) {
      const p = join(dir, n)
      if (statSync(p).isDirectory()) walk(p)
      else if (n.endsWith('.md')) {
        const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(read(p))?.[1] ?? ''
        const repos = (/^repos:\s*\[(.*)\]\s*$/m.exec(fm)?.[1] ?? '').split(',').map((s) => s.trim()).filter(Boolean)
        if (/^type:\s*contract\s*$/m.test(fm) && repos.includes(slug)) out.push({ path: slash(p), repos })
      }
    }
  }
  const at = pathsFor(brain)
  for (const dir of oneFolder(brain) ? [at.notes] : [at.sharedNotes, at.drafts]) walk(dir)
  return out.sort((a, b) => a.path.localeCompare(b.path))
}

/** BRIEF.md's Context block, as its fenced template: the lines above `Rules:` and the rules from there. */
const briefTemplate = () => {
  const md = read(join(PLUGIN, 'skills', 'brain', 'references', 'BRIEF.md'))
  const block = /^## The Context block[\s\S]*?^```\r?\n([\s\S]*?)^```/m.exec(md)?.[1]
  if (!block) throw new Error('No Context block template in BRIEF.md')
  return block.replace(/\r/g, '').trimEnd()
}

/** The terms and decisions recall ranks, on the repository, for a ticket's title and body (its diagrams left out), as absolute paths. */
const domainNotesFor = (brain, slug, ticketPath) => {
  const query = read(ticketPath).replace(/^```[\s\S]*?^```/gm, '')
  try {
    return rank(brain, { repos: [slug], types: ['term', 'decision'], queries: [query] }).shown.map(({ n }) => slash(join(brain, n.path)))
  } catch (e) {
    if (e instanceof RecallError) return []
    throw e
  }
}

/**
 * The Context block by BRIEF.md for one of build's sub-agents on a ticket or milestone, every line filled from the
 * spec, the brain and the repository: what each agent reads and may write, by build's steps 5 to 9.
 */
export const contextBlock = (path, agent, { writes = [], branch: onBranch } = {}) => {
  if (!AGENTS.includes(agent)) throw new Error(`No Context block for ${agent}: one of ${AGENTS.join(', ')}`)
  const { specDir, brain, track, m, root, branch } = locate(path)
  const ticketPath = /\d{3}-[^/\\]+\.md$/.test(path) && !/milestone\.md$/i.test(path) ? slash(resolve(path)) : null
  const changes = agent === 'builder' || agent === 'fixer'
  if (agent === 'builder' && !ticketPath) throw new Error('A builder works on a ticket: give its path')
  const clones = readRepos(brain)
  const spec = readSpecLines(specDir)
  const at = (s) => `${s} at ${slash(clones[s] ?? '(not linked)')} (linked)`

  const contracts = agent === 'arbiter' || agent === 'standards-reviewer' ? contractNotes(brain, track) : []
  const also = new Set(changes
    ? [...m.buildsAfter, ...m.landsAfter].filter((id) => !id.bad && id.track && id.track !== track).map((id) => id.track)
    : agent === 'arbiter' ? contracts.flatMap((c) => c.repos).filter((s) => s !== track) : [])
  const card = pathsFor(brain).card(track)
  // Every agent takes the domain's terms and decisions from the brain's notes, so none is pointed at the repository's own.
  const docs = [
    ...['docs/STRUCTURE.md', ...(agent === 'standards-reviewer' ? ['CLAUDE.md', 'AGENTS.md'] : [])].map((f) => join(root, f)).filter((p) => existsSync(p)),
    ...(changes ? ['skills/code-design/references/project-structure/PROJECT-STRUCTURE.md', 'skills/code-design/references/module-design/MODULE-DESIGN.md'].map((f) => join(PLUGIN, f)) : []),
    ...(agent === 'fixer' ? [join(PLUGIN, 'agents', 'builder.md')] : []),
    ...(agent === 'standards-reviewer' ? [join(PLUGIN, 'skills', 'review-changes', 'references', 'SMELLS.md')] : []),
    ...(changes ? [join(PLUGIN, 'skills', 'build', 'scripts', 'sdd.mjs')] : []),
  ].map(slash)
  const brainNotes = isNone(spec.brainNotes) ? [] : spec.brainNotes.split(',').map((s) => s.trim()).filter(Boolean)
  const notes = [...new Set([...brainNotes, ...contracts.map((c) => c.path), ...(changes && ticketPath ? domainNotesFor(brain, track, ticketPath) : [])])]
  const msPath = slash(join(m.dir, 'milestone.md'))
  const own = ticketPath && changes ? `, the ticket file at ${ticketPath}` : ''
  const write = changes ? `files under ${slash(root)}${own}` : writes.length ? writes.map((w) => `the file at ${slash(resolve(w))}`).join(', ') : 'nothing'

  const values = {
    Brain: slash(brain),
    'Works in': `${track} at ${slash(root)} (${changes ? 'open' : 'linked'}), ${changes ? 'changes it' : 'reads it'}`,
    'Also reads': also.size ? [...also].map(at).join('; ') : 'none',
    Card: slash(card),
    Docs: docs.length ? docs.join(', ') : 'none',
    Notes: notes.length ? notes.join(', ') : 'none',
    Spec: ticketPath && (changes || agent === 'spec-reviewer') ? ticketPath : msPath,
    Branch: onBranch ?? branch,
    Writes: write,
  }
  return briefTemplate().replace(/^- \*\*([^:*]+):\*\* .*$/gm, (line, name) => (name in values ? `- **${name}:** ${values[name]}` : line))
}

/** Writes a file, or returns false when a read-only sandbox refuses the write. */
const tryWrite = (file, text) => {
  try {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, text)
    return true
  } catch (e) {
    // A read-only sandbox refuses a mkdir with ENOENT, even under a folder that exists.
    if (['EROFS', 'EACCES', 'EPERM', 'ENOENT'].includes(e.code)) return false
    throw e
  }
}

/**
 * A dispatch in one call: writes the agent's Context block to `<milestone>/.context/<agent>[-<ticket>].md`, sets a
 * ticket's builder's ticket to `doing`, and returns the brief's opening, the **Works in** line
 * and the file holding the rest, followed by the paths the agent works on. When a sandbox refuses a write, the brief
 * holds the whole block instead, and stderr names the **Status** line the caller writes with Edit.
 */
export const dispatch = (path, agent, { writes = [], branch } = {}) => {
  const block = contextBlock(path, agent, { writes, branch })
  const { m } = locate(path)
  const ticket = /\d{3}-[^/\\]+\.md$/.test(path) && !/milestone\.md$/i.test(path) ? resolve(path) : null
  const file = join(m.dir, '.context', `${agent}${ticket ? `-${basename(ticket).slice(0, 3)}` : ''}.md`)
  const filed = tryWrite(file, `${block}\n`)
  if (agent === 'builder' && ticket && !tryWrite(ticket, setLine(read(ticket), 'Status', 'doing'))) {
    console.error(`not written: set **Status:** doing in ${slash(ticket)} with Edit`)
  }
  const worksIn = /^- \*\*Works in:\*\* .*$/m.exec(block)[0]
  return [
    ...(filed
      ? ['## Context', worksIn, `- The rest of this Context block, its rules included, is in ${slash(file)}: read it before anything else.`]
      : [block]),
    '',
    ...(ticket ? [`**Ticket:** ${slash(ticket)}`] : []),
    `**Milestone:** ${slash(join(m.dir, 'milestone.md'))}`,
    `**Spec:** ${slash(join(specFolderOf(m.dir), 'spec.md'))}`,
  ].join('\n')
}

/**
 * Build's step 3 on a builder's or fixer's report for a ticket, in one call: `verify`, then, when it holds, the
 * dispatch of the milestone's next ticket not done, or the word that its tickets are all done.
 */
export const next = (ticketPath, { commits = [], brainHead } = {}) => {
  const v = verify(ticketPath, { commits, brainHead })
  if (v.problems.length) return { ...v, next: null, done: false }
  const { m } = locate(ticketPath)
  const k = readMilestone(m.dir, null).tickets.find((t) => t.status !== 'done')
  if (!k) return { ...v, next: null, done: true }
  const p = join(m.dir, k.file)
  return { ...v, next: slash(p), brief: dispatch(p, 'builder'), done: false }
}

// --- landing a track --------------------------------------------------------------------------------------------

/** A field of a repository's card frontmatter, or null. */
const cardField = (brain, slug, key) => {
  const card = pathsFor(brain).card(slug)
  const fm = existsSync(card) ? (/^---\r?\n([\s\S]*?)\r?\n---/.exec(read(card))?.[1] ?? '') : ''
  return new RegExp(`^${key}:\\s*(.*)$`, 'm').exec(fm)?.[1].trim() ?? null
}

/** Whether a repository has no remote: its card's `remote` is `local only`, or it has no card. */
const localOnly = (brain, slug) => {
  const r = cardField(brain, slug, 'remote')
  return !r || isNone(r) || /^local only$/i.test(r)
}

/** A repository's full suite by its card, `unit` then `e2e` unless `none`, run from its root. */
const fullSuite = (brain, slug) =>
  ['unit', 'e2e'].map((k) => cardField(brain, slug, k)).filter((c) => c && !isNone(c) && c !== 'null')

const runSuite = (root, commands) => {
  for (const c of commands) {
    const r = spawnSync(c, { cwd: root, shell: true, encoding: 'utf8' })
    if (r.status !== 0) return { ok: false, command: c, tail: `${r.stdout ?? ''}${r.stderr ?? ''}`.trimEnd().split('\n').slice(-40).join('\n') }
  }
  return { ok: true }
}

/**
 * LAND.md's **Land a track** in one call, for one track of a spec: records the landable milestones already on its
 * base, rebases its spec branch onto the base, follows each squash through the rebase into its **Squash** line, runs
 * the full suite at the last landable squash, fast-forwards the base to it, and records **Landings**, each **Landed**
 * and **Phase**, and the spec's **Landed** line once every milestone has landed. With `fold`, first folds the commits
 * a fixer made on the spec branch above the track's last squash into that squash. Returns { landed, stopped }: the
 * milestones it landed, and why it stopped, with `at` (`conflict`, `tip`, `below`, `dirty`, `dropped`) and the
 * suite's failing command and output.
 */
export const land = (specDir, slug, { fold = false } = {}) => {
  const brain = brainOf(specDir)
  const specFolder = basename(specDir)
  const specBranch = `sdd/${specFolder}/spec`
  const st = specState(specDir, { brain })
  const t = st.tracks.find((x) => x.slug === slug)
  if (!t) throw new Error(`No track ${slug} in ${specFolder}`)
  const { root, base } = t.repo
  if (!t.repo.git) throw new Error(`${slug} is not linked to a git clone`)
  if (!base) throw new Error(`${slug} has no base branch: add it to spec.md's Base line`)
  const msOf = (n) => readTracks(specDir).tracks.find((x) => x.slug === slug).milestones.find((x) => x.n === n)
  const msFile = (n) => join(msOf(n).dir, 'milestone.md')
  const setMs = (n, name, value) => writeFileSync(msFile(n), setLine(read(msFile(n)), name, value, 'Lands after'))
  const specPath = join(specDir, 'spec.md')
  const landed = []

  const record = (ns) => {
    if (!ns.length) return
    const entry = `${slug} ${ns.length > 1 ? `${ns[0]}-${ns.at(-1)}` : ns[0]}`
    writeFileSync(specPath, appendLine(read(specPath), 'Landings', entry, '; ', 'Base'))
    for (const n of ns) { setMs(n, 'Landed', msOf(n).squash); setMs(n, 'Phase', 'landed') }
    landed.push(...ns)
  }
  const finish = (stopped) => {
    const all = readTracks(specDir).tracks.flatMap((x) => x.milestones.map((mm) => ({ slug: x.slug, mm })))
    if (!stopped && all.length && all.every((a) => a.mm.landed) && field(read(specPath), 'Landed') === null) {
      const last = (s) => all.filter((a) => a.slug === s).at(-1)?.mm.landed
      const entries = readSpecLines(specDir).repos.filter((s) => last(s)).map((s) => `${s}@${last(s)}`)
      writeFileSync(specPath, setLine(read(specPath), 'Landed', entries.join(', '), 'Base'))
    }
    return { landed, stopped: stopped ?? null }
  }

  const landable = t.milestones.filter((x) => x.landable)
  record(landable.filter((x) => x.onBase).map((x) => x.n))
  let rest = landable.filter((x) => !x.onBase).map((x) => x.n)
  if (!rest.length) return finish()
  if (git(root, ['status', '--porcelain']) !== '') return finish({ at: 'dirty', why: `${root} has uncommitted changes` })

  const unlanded = t.milestones.filter((x) => x.state === 'unlanded' && !x.onBase)
  if (fold) {
    const lastSq = unlanded.at(-1)
    run(root, ['checkout', '-q', specBranch])
    if (run(root, ['rev-parse', 'HEAD']) !== run(root, ['rev-parse', lastSq.squash])) {
      run(root, ['reset', '--soft', lastSq.squash])
      run(root, ['commit', '-q', '--amend', '--no-edit'])
      setMs(lastSq.n, 'Squash', run(root, ['rev-parse', 'HEAD']))
    }
  }

  const subjects = new Map(unlanded.map((x) => [x.n, git(root, ['log', '-1', '--format=%s', msOf(x.n).squash])]))
  if (spawnSync('git', ['-C', root, 'rebase', '-q', base, specBranch], { encoding: 'utf8' }).status !== 0) {
    const files = git(root, ['diff', '--name-only', '--diff-filter=U']) ?? ''
    spawnSync('git', ['-C', root, 'rebase', '--abort'])
    return finish({ at: 'conflict', why: `rebasing ${specBranch} onto ${base} conflicts in: ${files.split('\n').filter(Boolean).join(', ') || 'unknown files'}. Once the user rebases it by hand, the same /build lands it` })
  }
  const log = (git(root, ['log', '--format=%H%x09%(trailers:key=Sdd-Milestone,valueonly,separator=%x2C)%x09%s', `${base}..${specBranch}`]) ?? '').split('\n').filter(Boolean).map((l) => l.split('\t'))
  for (const x of unlanded) {
    const hit = log.find(([, trailer]) => trailer === `${specFolder}/${slug}/M${x.n}`) ?? log.find(([, trailer, s]) => !trailer && s === subjects.get(x.n))
    if (!hit) return finish({ at: 'dropped', why: `milestone ${x.n}'s squash is not on ${specBranch} after the rebase: the base may already hold it` })
    setMs(x.n, 'Squash', hit[0])
  }

  const head = msOf(rest.at(-1)).squash
  const tip = run(root, ['rev-parse', specBranch])
  run(root, ['checkout', '-q', '--detach', head])
  const suite = runSuite(root, fullSuite(brain, slug))
  if (!suite.ok) {
    run(root, ['checkout', '-q', specBranch])
    if (head !== tip) setMs(rest.at(-1), 'Phase', 'failed')
    return finish({ at: head === tip ? 'tip' : 'below', command: suite.command, tail: suite.tail, head })
  }
  run(root, ['checkout', '-q', base])
  run(root, ['merge', '-q', '--ff-only', head])
  run(root, ['checkout', '-q', specBranch])
  record(rest)
  return finish()
}

const lockFile = (brain, slug) => join(pathsFor(brain).locks, `${slug}.json`)
const readLock = (brain, slug) => {
  try { return JSON.parse(read(lockFile(brain, slug))) } catch { return null }
}

/**
 * Build's claim on the repositories it changes, by its **Locks**: each repository of a track with a milestone not
 * landed. A claim another spec holds stops the claim, unless `take`. Returns { locked, held, unwritten }: the slugs
 * claimed, the claims of other specs as { slug, spec, since }, and the slugs a read-only sandbox kept it from writing.
 */
export const lock = (specDir, { take = false } = {}) => {
  const brain = brainOf(specDir)
  const spec = basename(specDir)
  const slugs = readTracks(specDir).tracks.filter((t) => t.milestones.some((m) => !m.landed)).map((t) => t.slug)
  const held = slugs.map((slug) => ({ slug, ...readLock(brain, slug) })).filter((l) => l.spec && l.spec !== spec)
  if (held.length && !take) return { locked: [], held, unwritten: [] }
  const since = new Date().toISOString()
  const unwritten = slugs.filter((slug) => {
    const mine = readLock(brain, slug)?.spec === spec
    return !tryWrite(lockFile(brain, slug), `${JSON.stringify({ spec, since: mine ? readLock(brain, slug).since : since })}\n`)
  })
  return { locked: slugs.filter((s) => !unwritten.includes(s)), held: [], unwritten }
}

/** Releases the claims this spec holds; returns their slugs. */
export const unlock = (specDir) => {
  const brain = brainOf(specDir)
  const spec = basename(specDir)
  const dir = pathsFor(brain).locks
  const mine = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).filter((slug) => readLock(brain, slug)?.spec === spec) : []
  return mine.filter((slug) => {
    try { rmSync(lockFile(brain, slug), { force: true }); return true } catch { return false }
  })
}

/**
 * open-pr's **Follow the merge** in one call, for one track of a landed spec: finds the commit on `origin/<base>`, as
 * last fetched, that holds the track's last landing (its **Landed** SHA when the remote kept it, as a fast-forward or
 * a merge commit does, else the `commit` its PR merged as, after a squash or rebase merge), brings the local base level
 * with `origin/<base>`, and writes `<slug>@<SHA>` into spec.md's **Merged** line. The local base drops only this
 * track's own squashes, which the remote holds under other SHAs, and only with `realign`. Returns { merged, moved,
 * drops, stopped }, `stopped.at` one of `unlanded`, `unfetched`, `open`, `foreign`, `realign` or `dirty`.
 */
export const merged = (specDir, slug, { commit, realign = false } = {}) => {
  const specFolder = basename(specDir)
  const st = specState(specDir)
  const t = st.tracks.find((x) => x.slug === slug)
  if (!t) throw new Error(`No track ${slug} in ${specFolder}`)
  const { root, base } = t.repo
  if (!t.repo.git) throw new Error(`${slug} is not linked to a git clone`)
  if (!base) throw new Error(`${slug} has no base branch in spec.md's Base line`)
  const stop = (at, why, more = {}) => ({ merged: null, moved: false, drops: [], stopped: { at, why }, ...more })
  const last = t.milestones.at(-1)
  if (!last || t.milestones.some((m) => !m.landed)) return stop('unlanded', `${slug} has milestones that have not landed: run /build first`)
  const remote = `refs/remotes/origin/${base}`
  if (git(root, ['rev-parse', '--verify', '-q', remote]) === null) return stop('unfetched', `origin/${base} is not fetched in ${root}`)
  const known = readSpecLines(specDir).merged?.[slug]
  const sha = [last.landed, commit, known].filter(Boolean).map((c) => git(root, ['rev-parse', '-q', '--verify', `${c}^{commit}`]))
    .find((c) => c && isAncestor(root, c, remote)) ?? null
  if (!sha) return stop('open', `origin/${base} does not hold ${slug}'s last landing yet: its PR has not merged`)

  const ahead = (git(root, ['log', '--format=%H%x09%(trailers:key=Sdd-Milestone,valueonly,separator=%x2C)%x09%s', `${remote}..refs/heads/${base}`]) ?? '')
    .split('\n').filter(Boolean).map((l) => l.split('\t'))
  const foreign = ahead.filter(([, trailer]) => !trailer.startsWith(`${specFolder}/${slug}/`))
  if (foreign.length) return stop('foreign', `${base} holds commits origin/${base} lacks that are not this track's: ${foreign.map(([h, , s]) => `${h.slice(0, 7)} ${s}`).join('; ')}`)
  const drops = ahead.map(([h, , s]) => `${h.slice(0, 7)} ${s}`)
  if (drops.length && !realign) return stop('realign', `${base} keeps this track's squashes, which origin/${base} holds under other SHAs`, { drops })

  const checkedOut = git(root, ['symbolic-ref', '--short', '-q', 'HEAD']) === base
  const tip = git(root, ['rev-parse', `refs/heads/${base}`])
  const target = git(root, ['rev-parse', remote])
  if (tip !== target) {
    if (checkedOut && git(root, ['status', '--porcelain']) !== '') return stop('dirty', `${root} has uncommitted changes on ${base}`, { drops })
    if (checkedOut) run(root, ['reset', '-q', '--hard', target])
    else run(root, ['branch', '-f', base, target])
  }
  const specPath = join(specDir, 'spec.md')
  const entries = { ...(readSpecLines(specDir).merged ?? {}), [slug]: sha }
  const order = [...readSpecLines(specDir).repos, ...Object.keys(entries)].filter((s, i, all) => s in entries && all.indexOf(s) === i)
  writeFileSync(specPath, setLine(read(specPath), 'Merged', order.map((s) => `${s}@${entries[s]}`).join(', '), 'Landed'))
  return { merged: sha, moved: tip !== target, drops, stopped: null }
}

// --- the command line -----------------------------------------------------------------------------------------

const main = (argv) => {
  const [cmd, ...rest] = argv
  const opts = {}
  const pos = []
  const many = { detail: [], commit: [], writes: [] }
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--no-git') opts.noGit = true
    else if (['--fold', '--full', '--realign', '--take'].includes(rest[i])) opts[rest[i].slice(2)] = true
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
    console.log(`unanswered: ${unanswered(md).join(', ') || 'none'}`)
    console.log(`toFix: ${toFix(md).join(', ') || 'none'}`)
    return
  }
  if (cmd === 'review' && pos.length >= 2 && opts.title && opts.fixed && opts.head) {
    const [target, ...files] = pos
    if (existsSync(target) && /\*\*Answer:\*\*/.test(read(target))) throw new Error(`${target} holds Answer lines: keep this report in chat`)
    const sections = files.map((f) => {
      const m = /^review\.(standards|spec|consumers)(?:\.([\w.-]+))?\.md$/.exec(basename(f))
      if (!m) throw new Error(`${f} is not named review.<standards|spec|consumers>[.<slug>].md`)
      return { axis: m[1], slug: m[2] ?? null, text: read(f) }
    })
    const r = assembleReview({ title: opts.title, fixed: opts.fixed, head: opts.head, summary: opts.summary ? read(opts.summary) : null, sections })
    writeFileSync(target, r.text)
    for (const f of [...files, ...(opts.summary ? [opts.summary] : [])]) if (resolve(f) !== resolve(target)) rmSync(f)
    console.log(`${target}: ${Object.entries(r.counts).map(([a, n]) => `${a} ${n}`).join(', ')}`)
    for (const line of r.renumbered) console.log(`renumbered ${line}`)
    if (!opts.summary) console.log(/^## Summary\n\n(.*)$/m.exec(r.text)?.[1] ?? '')
    console.log(`unanswered: ${unanswered(r.text).join(', ') || 'none'}`)
    console.log(`toFix: ${toFix(r.text).join(', ') || 'none'}`)
    return
  }
  if (cmd === 'context' && pos.length === 1 && opts.agent) {
    console.log(contextBlock(pos[0], opts.agent, { writes: many.writes, branch: opts.branch }))
    return
  }
  if (cmd === 'dispatch' && pos.length === 1 && opts.agent) {
    console.log(dispatch(pos[0], opts.agent, { writes: many.writes, branch: opts.branch }))
    return
  }
  if (cmd === 'next' && pos.length === 1) {
    const r = next(pos[0], { commits: many.commit, brainHead: opts['brain-head'] })
    if (r.status) console.log(`ticket: Status ${r.status}, Commit ${r.commit ?? 'none'}`)
    for (const p of r.problems) console.log(`problem: ${p}`)
    if (r.problems.length) process.exit(1)
    console.log('ok')
    console.log(r.done ? 'milestone: every ticket done' : `next: ${r.next}\n\n${r.brief}`)
    return
  }
  if (cmd === 'land' && pos.length === 1 && opts.track) {
    const brain = resolve(opts.brain ?? '.')
    const r = land(resolveSpec(pos[0], brain), opts.track, { fold: opts.fold })
    console.log(r.landed.length ? `landed: ${opts.track} ${r.landed.join(', ')}` : `landed: nothing in ${opts.track}`)
    if (r.stopped) {
      console.log(`stopped: ${r.stopped.at}${r.stopped.why ? `: ${r.stopped.why}` : ''}`)
      if (r.stopped.command) console.log(`failing: ${r.stopped.command} at ${r.stopped.head}\n${r.stopped.tail}`)
      process.exit(1)
    }
    return
  }
  if (cmd === 'lock' && pos.length === 1) {
    const r = lock(resolveSpec(pos[0], resolve(opts.brain ?? '.')), { take: opts.take })
    for (const h of r.held) console.log(`held: ${h.slug} by ${h.spec} since ${h.since}`)
    if (r.held.length) process.exit(1)
    if (r.unwritten.length) console.log(`not written: ${r.unwritten.join(', ')}, a read-only sandbox; go on`)
    console.log(`locked: ${r.locked.join(', ') || 'nothing'}`)
    return
  }
  if (cmd === 'unlock' && pos.length === 1) {
    console.log(`unlocked: ${unlock(resolveSpec(pos[0], resolve(opts.brain ?? '.'))).join(', ') || 'nothing'}`)
    return
  }
  if (cmd === 'merged' && pos.length === 1 && opts.track) {
    const brain = resolve(opts.brain ?? '.')
    const r = merged(resolveSpec(pos[0], brain), opts.track, { commit: many.commit[0], realign: opts.realign })
    for (const d of r.drops) console.log(`drops: ${d}`)
    if (r.stopped) {
      console.log(`stopped: ${r.stopped.at}: ${r.stopped.why}`)
      process.exit(1)
    }
    console.log(`merged: ${opts.track}@${r.merged}${r.moved ? ', base moved to origin' : ''}`)
    return
  }
  if (cmd === 'squash' && pos.length === 1) {
    const { sha, already, warnings } = squash(pos[0], { title: opts.title, details: many.detail, key: opts.key })
    console.log(already ? `already squashed: ${sha}` : `squashed: ${sha}`)
    for (const w of warnings) console.log(w.startsWith('not written:') ? w : `warning: ${w}`)
    return
  }
  if (cmd === 'verify' && pos.length === 1) {
    const r = verify(pos[0], { commits: many.commit, brainHead: opts['brain-head'], branch: opts.branch })
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
    '       node sdd.mjs review <review.md> --title <t> --fixed <sha> --head <sha> [--summary <file>] <review.<axis>[.<slug>].md>...\n' +
    '       node sdd.mjs squash <milestone-folder|milestone.md> --title <title> [--detail <bullet>]... [--key <key|none>]\n' +
    '       node sdd.mjs verify <ticket|milestone.md> [--commit <sha>]... [--brain-head <sha>] [--branch <b>]\n' +
    `       node sdd.mjs context|dispatch <ticket|milestone.md> --agent <${AGENTS.join('|')}> [--writes <file>]... [--branch <b>]\n` +
    '       node sdd.mjs next <ticket> [--commit <sha>]... [--brain-head <sha>]\n' +
    '       node sdd.mjs land <spec-id|spec-folder> --track <slug> [--brain <brain>] [--fold]\n' +
    '       node sdd.mjs merged <spec-id|spec-folder> --track <slug> [--brain <brain>] [--commit <sha>] [--realign]\n' +
    '       node sdd.mjs lock|unlock <spec-id|spec-folder> [--brain <brain>] [--take]')
  process.exit(2)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)) } catch (e) { console.error(e.message); process.exit(1) }
}
