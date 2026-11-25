import { resolve } from 'node:path'
import { findBrain } from '../../../skills/brain/scripts/layout.mjs'

// The folder that holds the `BRAIN.md` of the brain at a path: the folder's `.brain/` when that holds it, else the folder itself
// when it holds it. Null when neither does. A folder that is its own brain comes back as given.
export const brainFolderOf = (path) => {
  const found = findBrain(path)
  if (found === null) return null
  return found === resolve(path).split('\\').join('/') ? path : resolve(found)
}
