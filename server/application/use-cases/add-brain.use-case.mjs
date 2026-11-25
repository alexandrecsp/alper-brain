import { basename, isAbsolute, resolve } from 'node:path'
import { InvalidBrainPathError } from '../../domain/errors/invalid-brain-path.error.mjs'
import { brainEntry } from '../services/brain-entry.service.mjs'

// Adds the brain at a path, or at the `.brain/` folder of the path, and returns its entry; a brain already listed returns its entry.
// A brain in a `.brain` folder is named by `nameOf`, the brain-name rule; any other by its folder's name. Another brain with that
// name makes it take a number suffix.
export const addBrain = ({ brainList, brainFolderOf, nameOf, newId }) => (path) => {
  if (typeof path !== 'string' || !isAbsolute(path)) throw new InvalidBrainPathError(path)
  const asked = resolve(path)
  const absolute = brainFolderOf(asked) ?? asked
  const entryOf = brainEntry(brainFolderOf)
  const listed = brainList.all()
  const same = listed.find((b) => b.path === absolute)
  if (same) return entryOf(same)
  const taken = new Set(listed.map((b) => b.name))
  const folder = basename(absolute) === '.brain' ? nameOf(absolute) : basename(absolute)
  let name = folder
  for (let n = 2; taken.has(name); n++) name = `${folder} ${n}`
  const brain = { id: newId(), name, path: absolute }
  brainList.add(brain)
  return entryOf(brain)
}
