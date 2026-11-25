// The newest `max` commits reachable from `tips`, each after every child of it among them (commits made in the same second, or a
// rebase's clock, would otherwise put a parent first), newest first among those free to go: the order `GitRead`'s `walk` gives.
// `since` (ms) leaves out commits older than it, except those in `keep`. `more` is true when older commits were left out.
// `commitsOf(shas)` resolves with each sha's commit (`{ sha, parents, time, ... }`), null where it is missing, in one batch.
export const walkCommits = async (commitsOf, tips, { max = 80, since = 0, keep = null } = {}) => {
  const kept = keep ? new Set(keep) : null
  const seen = new Set()
  const queue = []
  const picked = []
  let older = false
  const add = async (shas) => {
    const fresh = []
    for (const sha of shas) {
      if (!sha || seen.has(sha)) continue
      seen.add(sha)
      fresh.push(sha)
    }
    const found = fresh.length ? await commitsOf(fresh) : []
    for (const c of found) {
      if (!c) continue
      if (c.time < since && !(kept && kept.has(c.sha))) older = true
      else queue.push(c)
    }
  }
  await add(tips)
  while (queue.length && picked.length < max) {
    queue.sort((a, b) => b.time - a.time)
    const c = queue.shift()
    picked.push(c)
    await add(c.parents)
  }
  const left = new Map(picked.map((c) => [c.sha, 0]))
  const out = []
  for (const c of picked) for (const p of c.parents) if (left.has(p)) left.set(p, left.get(p) + 1)
  const ready = picked.filter((c) => !left.get(c.sha))
  while (ready.length) {
    ready.sort((a, b) => b.time - a.time || picked.indexOf(a) - picked.indexOf(b))
    const c = ready.shift()
    out.push(c)
    for (const p of c.parents) if (left.has(p) && left.set(p, left.get(p) - 1).get(p) === 0) ready.push(picked.find((x) => x.sha === p))
  }
  return { commits: out, more: queue.length > 0 || older }
}
