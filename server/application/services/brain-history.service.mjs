import { layerOf, listOf, parse, placeOf } from '../../../skills/brain/scripts/notes.mjs'

// A note's place in a past commit's layout: the one before the clusters move kept authored notes in notes/authored/ and explored
// ones in notes/exploration/<slug>/. Null for any other path.
const oldPlaceOf = (path) => {
  const p = path.split('/')
  if (p[0] === 'notes' && p[1] === 'authored' && p.length === 3) return { slug: null, card: false }
  if (p[0] === 'notes' && p[1] === 'exploration' && p.length === 4) return { slug: p[2], card: false }
  return null
}
const placeIn = (path) => placeOf(path) ?? oldPlaceOf(path)

// The brain's history in the timeline's JSON shape, which the page's Activity reads: every committed change to a note, oldest commit first.
// It reads the commits and each note's text at its commit through the brain history port, and a note's `type`, `layer` (worked out by `layerOf`, whether or not the commit stores it), `kind` and
// `repos` through `notes.mjs`.
export const historyOf = async (history, root) => {
  // A note's file: an authored or explored note, never a repository's card.
  const isNote = (path) => path.endsWith('.md') && placeIn(path)?.card === false
  const commits = (await history.log(root))
    .map((c) => ({ ...c, changes: c.changes.filter((x) => isNote(x.path)) }))
    .filter((c) => c.changes.length)
  const texts = await history.textsAt(root, commits.flatMap((c) => c.changes.filter((x) => x.status !== 'deleted').map((x) => ({ sha: c.sha, path: x.path }))))
  const meta = (path, text) => {
    const { fm } = parse(text)
    const place = placeIn(path)
    return {
      note: path.split('/').at(-1).replace(/\.md$/, ''),
      type: fm.type || 'other',
      layer: layerOf(fm.type, !!fm.explored, fm.layer) || null,
      kind: fm.explored ? 'explored' : 'authored',
      repos: place?.slug ? [place.slug] : listOf(fm.repos),
      superseded: fm.status === 'superseded',
    }
  }
  // The last state each path was seen in, so a deletion keeps its note's type and a supersede shows as one.
  const last = new Map()
  const changeOf = (sha, { path, status, from }) => {
    if (status === 'deleted') {
      const { superseded, ...m } = last.get(path) ?? meta(path, '')
      last.delete(path)
      return { ...m, path, action: 'deleted' }
    }
    const state = meta(path, texts.get(`${sha}:${path}`))
    const before = last.get(from ?? path)
    if (from) last.delete(from)
    last.set(path, state)
    const { superseded, ...m } = state
    const action = status === 'renamed' ? 'moved' : status === 'modified' ? (superseded && !before?.superseded ? 'superseded' : 'updated') : 'recorded'
    return { ...m, path, action, ...(from ? { from } : {}) }
  }
  return {
    version: 1,
    commits: commits.map((c) => ({
      // Seven characters on every clone, whatever its core.abbrev.
      sha: c.sha.slice(0, 7),
      date: new Date(c.date).toISOString().replace(/\.\d{3}Z$/, 'Z'),
      author: c.author,
      title: c.title,
      changes: c.changes.map((x) => changeOf(c.sha, x)),
    })),
  }
}
