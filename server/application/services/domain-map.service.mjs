import { noteOf, placeOf } from '../../../skills/brain/scripts/notes.mjs'

// The names a note's body links: `[[name]]`, `[[name|shown]]` and `[[name#heading]]` each link `name`.
const linksOf = (body) => [...body.matchAll(/\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g)].map((m) => m[1].trim())

// The brain's domain map in the JSON shape of `GET /api/brains/:id/domain`, from its files (path in the brain to text): a note of type
// `term` is one term, and a note of type `decision` is listed on each term its body links. `notes.mjs` is the one parser of both.
export const domainMapOf = (files) => {
  const notes = Object.entries(files)
    .filter(([path]) => path.endsWith('.md') && placeOf(path)?.card === false)
    .map(([path, text]) => noteOf(path, text))
  const decisions = notes.filter((n) => n.type === 'decision').map((n) => ({ name: n.name, links: new Set(linksOf(n.body)) }))
  return {
    terms: notes
      .filter((n) => n.type === 'term')
      .map((n) => ({
        name: n.name,
        description: n.description,
        repos: n.repos,
        aliases: n.aliases,
        avoid: n.avoid,
        pairings: n.pairings.map(({ context, nuance, ...p }) => ({ ...p, ...(context ? { context } : {}), ...(nuance ? { nuance } : {}) })),
        relations: n.relations,
        decisions: decisions.filter((d) => d.links.has(n.name)).map((d) => d.name),
      })),
  }
}
