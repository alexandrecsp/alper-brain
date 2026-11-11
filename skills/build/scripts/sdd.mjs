#!/usr/bin/env node
// Reads and writes a spec's pipeline files by the brain's FORMAT.md **Specs** and build's SKILL.md, so the rules
// a script can decide (Tracks, Phase, landable, the dependency checks, the cap) are decided the same way every call.
//
//   node sdd.mjs state <spec-id|spec-folder> [--brain <brain>] [--no-git]
//     Prints the spec as JSON: its lines, its dependencies, the cap, and per track its milestones with each one's
//     state (open, unlanded, landed), the step it resumes at, whether it is ready or landable, and, read from git
//     through .sdd/links.json, whether its branch exists and the repository is clean.
//   node sdd.mjs brief <ticket-file> [--no-git]
//     Prints, as Markdown, what the ticket's builder needs from around it: its milestone's lines, and the Notes and
//     changed files of each earlier ticket of its milestone and each ticket its Depends on names.
//   node sdd.mjs set <file> <Line> <value> [--after <Line>]
//     Sets a `**Line:** value` line; when the file has none, creates it under the --after line, else fails.
//   node sdd.mjs append <file> <Line> <entry> [--sep '; '] [--after <Line>]
//     Appends an entry to a line, skipping one the line already ends with, as LAND.md's **Record it** does.
//
// Exits 1 with one line on stderr when it cannot read or write what it was given.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
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

/** A **Depends on** or **Lands after** value → [{ track, n }]; track is null for a bare `NNN`. */
export const ids = (v) =>
  isNone(v)
    ? []
    : v.split(',').map((t) => t.trim()).filter(Boolean).map((t) => {
        const m = /^(?:([\w.-]+)\/)?(\d{1,3})\b/.exec(t)
        return m ? { track: m[1] ?? null, n: m[2].padStart(3, '0') } : { bad: t }
      })

/** The findings in a review.md flagged escalate with no **Answer** line, by their IDs. */
export const unanswered = (reviewMd) =>
  reviewMd
    .split(/^(?=\s*(?:[-*]\s+|#{1,4}\s+)?(?:\*\*)?(?:ST|SP|CN)\d+\b)/m)
    .slice(1)
    .filter((f) => /\bescalate\b/i.test(f) && !/\*\*Answer:\*\*/.test(f))
    .map((f) => /(?:ST|SP|CN)\d+/.exec(f)[0])

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

/** The spec folder a spec id names under <brain>/.sdd/specs, by SPEC-ID.md. */
export const resolveSpec = (arg, brain) => {
  const asPath = resolve(arg)
  if (existsSync(join(asPath, 'spec.md'))) return asPath
  const m = /^s?(\d+)/i.exec(basename(arg.replace(/[\\/]+$/, '')))
  if (!m) throw new Error(`Not a spec id or spec folder: ${arg}`)
  const nnn = m[1].padStart(3, '0')
  const root = join(brain, '.sdd', 'specs')
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
    landsAfter: ids(field(md, 'Lands after')),
    tickets,
    review: review === null ? null : { head: orNull(field(review, 'Head')), unanswered: unanswered(review) },
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
  const path = join(brain, '.sdd', 'config.json')
  if (!existsSync(path)) return { cap: DEFAULT_CAP }
  let cfg
  try { cfg = JSON.parse(read(path)) } catch { return { cap: DEFAULT_CAP, problem: `${path} does not parse as JSON` } }
  if (cfg === null || typeof cfg !== 'object' || Array.isArray(cfg)) return { cap: DEFAULT_CAP, problem: `${path} is not a JSON object` }
  const v = cfg.parallelAgents
  if (v === undefined) return { cap: DEFAULT_CAP }
  return Number.isInteger(v) && v > 0 ? { cap: v } : { cap: DEFAULT_CAP, problem: `parallelAgents ${JSON.stringify(v)} is not a positive whole number` }
}

const readLinks = (brain) => {
  const path = join(brain, '.sdd', 'links.json')
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

  // Ready: every earlier milestone of its track squashed, and every milestone of another track its tickets reach.
  for (const t of tracks) {
    t.milestones.forEach((m, i) => {
      if (m.state !== 'open') return
      const waits = t.milestones.slice(0, i).filter((e) => e.squash === null).map((e) => msId(t.slug, e))
      const seen = new Set()
      const stack = m.tickets.map((k) => ({ track: t.slug, k }))
      while (stack.length) {
        const { track, k } = stack.pop()
        for (const id of k.dependsOn) {
          if (id.bad) { problems.push(`${msId(track, m)}: ticket ${k.n} has an unreadable Depends on entry "${id.bad}"`); continue }
          const found = findTicket(track, id)
          if (found.length !== 1) {
            problems.push(`${t.slug}/${m.n} ticket ${k.n}: Depends on ${id.track ? `${id.track}/` : ''}${id.n} names ${found.length ? 'several tickets' : 'no ticket'}`)
            continue
          }
          const dep = found[0]
          const key = `${dep.track}/${dep.n}`
          if (seen.has(key)) continue
          seen.add(key)
          if (dep.track !== t.slug && dep.milestone.squash === null) waits.push(msId(dep.track, dep.milestone))
          stack.push({ track: dep.track, k: dep })
        }
      }
      m.waitsOn = [...new Set(waits)]
      m.ready = m.waitsOn.length === 0
    })
  }

  // Landable: squashed, every earlier milestone of its track landed or landable, every Lands after landed.
  for (const t of tracks) {
    let chain = true
    for (const m of t.milestones) {
      if (m.state === 'landed') continue
      if (m.state === 'open') { chain = false; continue }
      const after = m.landsAfter.filter((id) => !id.bad).map((id) => ({ id, ms: findMilestone(id) }))
      for (const a of after) if (!a.ms) problems.push(`${msId(t.slug, m)}: Lands after ${a.id.track}/${a.id.n} names no milestone`)
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
      idle: next === null ? true : g.git ? !has(next) : null,
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
        landsAfter: m.landsAfter.filter((id) => !id.bad).map((id) => `${id.track}/${id.n}`),
        branch: has(m),
        reviewCurrent: m.review?.head && g.git && has(m) ? git(g.root, ['rev-parse', `sdd/${t.specFolder}/${branch(m)}`]) === m.review.head : null,
        unanswered: m.review?.unanswered ?? [],
        tickets: m.tickets.map((k) => ({ n: k.n, file: k.file, status: k.status, dependsOn: k.dependsOn.filter((d) => !d.bad).map((d) => (d.track ? `${d.track}/${d.n}` : d.n)), commit: k.commit })),
      })),
    }
    return track
  })

  const queue = out.filter((t) => t.next && (() => { const m = t.milestones.find((x) => x.n === t.next); return m.ticketsDone || m.phase !== 'none' })())
    .map((t) => ({ track: t.slug, milestone: t.next, resume: t.milestones.find((x) => x.n === t.next).resume }))
  const dispatchable = out.filter((t) => t.next && (() => { const m = t.milestones.find((x) => x.n === t.next); return m.ready && m.phase === 'none' && !m.ticketsDone })())
    .map((t) => ({ track: t.slug, milestone: t.next, ticket: t.milestones.find((x) => x.n === t.next).nextTicket }))
  const all = out.flatMap((t) => t.milestones)

  return {
    tracks: out,
    closingQueue: queue,
    dispatchable,
    noneOpen: all.every((m) => m.state !== 'open'),
    allLanded: all.length > 0 && all.every((m) => m.state === 'landed'),
    allTodo: all.flatMap((m) => m.tickets).every((k) => k.status === 'todo'),
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

/**
 * What a ticket's builder needs from around it, as Markdown: its milestone's Delivers, Done when and Lands after,
 * and for each earlier ticket of its milestone and each ticket its Depends on names, its status, commit, Notes and
 * the files that commit changed. The ticket itself, spec.md and the diffs stay on disk, read on demand.
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
    ...['Delivers', 'Done when', 'Lands after'].map((f) => `**${f}:** ${lineRe(f).exec(md)?.[1].trim() ?? 'none'}`),
    '',
    '## Tickets it builds on',
    '',
  ]
  if (!picked.size) out.push('None: it is the first ticket of its milestone and depends on none.')
  for (const k of [...picked.values()].sort((a, b) => (a.track + a.n).localeCompare(b.track + b.n))) {
    const text = read(join(k.milestone.dir, k.file))
    const root = links[k.track]
    out.push(`### ${k.track}/${k.n}: ${k.title}`, '', `**Status:** ${k.status} · **Commit:** ${k.commit ?? 'none'}${root ? ` · **Root:** ${root}` : ''}`, '')
    out.push('Notes:', '', section(text, 'Notes').replace(/^Left empty;.*$/m, '').trim() || 'none', '')
    if (useGit && k.commit && root) {
      const r = spawnSync('git', ['-C', root, 'show', '--stat=200', '--format=', k.commit], { encoding: 'utf8' })
      const files = r.status === 0 ? r.stdout.replace(/^\n+|\s+$/g, '') : null
      out.push(files ? `Files its commit changed:\n\n\`\`\`\n${files}\n\`\`\`` : `Its commit ${k.commit} is not in ${root}.`, '')
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

// --- the command line -----------------------------------------------------------------------------------------

const main = (argv) => {
  const [cmd, ...rest] = argv
  const opts = {}
  const pos = []
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--no-git') opts.noGit = true
    else if (rest[i].startsWith('--')) opts[rest[i].slice(2)] = rest[++i]
    else pos.push(rest[i])
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
    "       node sdd.mjs append <file> <Line> <entry> [--sep '; '] [--after <Line>]")
  process.exit(2)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)) } catch (e) { console.error(e.message); process.exit(1) }
}
