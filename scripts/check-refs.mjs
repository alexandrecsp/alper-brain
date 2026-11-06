#!/usr/bin/env node
// Checks every cross-file section reference in the skills and agents, such as
// "[LAND.md](LAND.md)'s **Land a track**", "FORMAT.md's **Specs**" or
// "`build`'s **Tracks**": the named file must exist and hold that section, as a
// Markdown heading, a bold lead (`1. **Land them.**`, `- **Start.**`) or the bold
// first cell of a table row (`| **Key** |`).
// Run: node scripts/check-refs.mjs   (exits 1 and lists each broken reference)
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname, resolve, relative, basename } from 'node:path'

const root = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..')
const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : path.endsWith('.md') ? [path] : []
  })
const docs = [...walk(join(root, 'skills')), ...walk(join(root, 'agents'))]
const byName = new Map()
for (const path of docs) byName.set(basename(path), [...(byName.get(basename(path)) ?? []), path])

const norm = (s) => s.replace(/[`*]/g, '').replace(/[.:]$/, '').trim().toLowerCase()
const sections = new Map()
const sectionsOf = (path) => {
  if (!sections.has(path)) {
    const text = readFileSync(path, 'utf8')
    const found = new Set()
    for (const [, h] of text.matchAll(/^#{1,6}\s+(.+)$/gm)) found.add(norm(h))
    // bold leads of steps and bullets, and the bold first cell of a table row (a defined line or field)
    for (const [, b] of text.matchAll(/^\s*(?:\d+\.|[-*]|\|)\s+\*\*([^*]+)\*\*/gm)) found.add(norm(b))
    sections.set(path, found)
  }
  return sections.get(path)
}

// A file named bare ("LAND.md") resolves beside the referring file, else to the one file of that name.
const resolveFile = (from, name, link) => {
  if (link) return resolve(dirname(from), link)
  const beside = join(dirname(from), name)
  if (existsSync(beside)) return beside
  const all = byName.get(name) ?? []
  return all.length === 1 ? all[0] : null
}
const skillFile = (name) => {
  const path = join(root, 'skills', name, 'SKILL.md')
  return existsSync(path) ? path : null
}

const ref =
  /(?:\[`?([A-Z][A-Z0-9-]*\.md)`?\]\(([^)]+)\)|\b([A-Z][A-Z0-9-]*\.md)|`([a-z][a-z-]+)`|\b(build|brain|tdd|commit|to-spec|to-tickets|review-changes|brainstorm|domain-modeling|design-patterns|pr))'s \*\*([^*]+)\*\*/g
const broken = []
let checked = 0
for (const path of docs) {
  const lines = readFileSync(path, 'utf8').split('\n')
  lines.forEach((line, i) => {
    for (const m of line.matchAll(ref)) {
      const [, linkName, link, bareName, tickSkill, bareSkill, section] = m
      const target = linkName
        ? resolveFile(path, linkName, link.split('#')[0])
        : bareName
          ? resolveFile(path, bareName)
          : skillFile(tickSkill ?? bareSkill)
      if (!target && tickSkill) continue // a backticked word that is no skill, such as a field name
      checked++
      const where = `${relative(root, path)}:${i + 1}`
      if (!target || !existsSync(target)) broken.push(`${where}  no file for "${m[0]}"`)
      else if (!sectionsOf(target).has(norm(section)))
        broken.push(`${where}  ${relative(root, target)} has no section "${section}"`)
    }
  })
}

if (broken.length) {
  console.log(broken.join('\n'))
  console.log(`\n${broken.length} broken of ${checked} section references`)
  process.exit(1)
}
console.log(`${checked} section references, all resolve`)
