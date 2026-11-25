// The brain files port held in memory, for the use-case tests: `brains` maps a brain's folder to its files (path to text).
// A write tells the watchers of that folder at once.
export const inMemoryBrainFiles = (brains = {}) => {
  const held = new Map(Object.entries(brains).map(([root, files]) => [root, { ...files }]))
  const watchers = new Set()
  const of = (root) => held.get(root) ?? held.set(root, {}).get(root)
  const all = (root) => ({ files: { ...of(root) }, times: {} })
  return {
    all,
    read: (root, path) => of(root)[path] ?? null,
    write: (root, path, text) => {
      of(root)[path] = text
      watchers.forEach((w) => w.root === root && w.onChange(all(root)))
    },
    watch: (root, onChange) => {
      const watcher = { root, onChange }
      watchers.add(watcher)
      return () => watchers.delete(watcher)
    },
  }
}
