import { findBrain } from './find-brain.service.mjs'

// Each listed brain's files held in memory and kept current by the brain files port's watcher. A change that makes the copy differ
// from the brain is told to every subscriber as `{ brain, changed, times }`: `changed` maps each path to its new text, or to
// null when the file is gone, and `times` holds the new time of each changed file that has one.
export const brainCopies = ({ brainList, brainFiles }) => {
  const watched = new Map()
  const subscribers = new Set()

  const update = (id, copy, snapshot) => {
    const changed = {}
    const times = {}
    for (const [path, text] of Object.entries(snapshot.files)) {
      if (copy.files[path] === text && copy.times[path] === snapshot.times[path]) continue
      changed[path] = text
      if (path in snapshot.times) times[path] = snapshot.times[path]
    }
    for (const path of Object.keys(copy.files)) if (!(path in snapshot.files)) changed[path] = null
    copy.files = snapshot.files
    copy.times = snapshot.times
    if (Object.keys(changed).length > 0) subscribers.forEach((tell) => tell({ brain: id, changed, times }))
  }

  const watch = (id, root) => {
    const copy = { root, files: {}, times: {} }
    copy.stop = brainFiles.watch(root, (snapshot) => update(id, copy, snapshot))
    Object.assign(copy, brainFiles.all(root))
    watched.set(id, copy)
  }

  // Watches each brain now listed that is not watched yet, and stops watching each one that is no longer listed.
  const sync = () => {
    const listed = brainList.all()
    for (const [id, copy] of watched) {
      if (listed.some((b) => b.id === id && b.path === copy.root)) continue
      copy.stop()
      watched.delete(id)
    }
    for (const { id, path } of listed) if (!watched.has(id)) watch(id, path)
  }

  return {
    sync,
    // A copy of the brain's files and times.
    of(id) {
      findBrain(brainList, id)
      sync()
      const { files, times } = watched.get(id)
      return { files: { ...files }, times: { ...times } }
    },
    // Calls `tell` with each change from now on; returns the function that ends that.
    subscribe(tell) {
      sync()
      subscribers.add(tell)
      return () => subscribers.delete(tell)
    },
  }
}
