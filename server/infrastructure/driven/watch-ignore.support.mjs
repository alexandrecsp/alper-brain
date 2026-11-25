// The paths a brain's watcher leaves alone: those its `.gitignore` ignores, except the `shown` ones (its drafts and specs, which the page shows).
// A path is relative to the brain, spelled with `/`. The matcher reads the common `.gitignore` lines: `#` comments, `!` negation, a
// trailing `/` for a folder, a leading or inner `/` that anchors a pattern, and `*`, `?` and `**`. The last line that matches wins.

// The regular expression for one pattern, matched against a whole path (or a leading part of it) from the brain's folder.
const regexOf = (pattern) => {
  let source = ''
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]
    if (c === '*' && pattern[i + 1] === '*') {
      const slash = pattern[i + 2] === '/'
      source += slash ? '(?:.*/)?' : '.*'
      i += slash ? 2 : 1
    } else if (c === '*') source += '[^/]*'
    else if (c === '?') source += '[^/]'
    else source += c.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${source}$`)
}

const ruleOf = (line) => {
  let pattern = line.replace(/\s+$/, '')
  if (pattern === '' || pattern.startsWith('#')) return null
  const negated = pattern.startsWith('!')
  if (negated) pattern = pattern.slice(1)
  if (pattern.endsWith('/')) pattern = pattern.slice(0, -1)
  const anchored = pattern.includes('/')
  if (pattern.startsWith('/')) pattern = pattern.slice(1)
  const regex = regexOf(pattern)
  // A pattern with no `/` matches the name of a file or folder at any depth; one with a `/` matches from the brain's folder.
  return { negated, matches: anchored ? (path) => regex.test(path) : (path) => regex.test(path.split('/').at(-1)) }
}

// The function that tells whether a path of the brain is ignored, from the text of its `.gitignore` (null when it has none)
// and the paths, relative to the brain, it shows whatever the file says.
export const watchIgnore = (gitignore, shown) => {
  const rules = (gitignore ?? '').split(/\r?\n/).map(ruleOf).filter(Boolean)
  // A path is ignored when it, or a folder above it, is: git does not look inside an ignored folder.
  const ignoredAt = (path) => rules.reduce((ignored, rule) => (rule.matches(path) ? !rule.negated : ignored), false)
  return (path) => {
    if (shown.some((dir) => path === dir || path.startsWith(`${dir}/`))) return false
    const parts = path.split('/')
    return parts.some((_, i) => ignoredAt(parts.slice(0, i + 1).join('/')))
  }
}
