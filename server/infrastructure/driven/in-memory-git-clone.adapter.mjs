import { NotACloneError } from '../../domain/errors/not-a-clone.error.mjs'

// The git clone port held in memory, for the use-case tests: `clones` maps a folder's path to its repo object.
export const inMemoryGitClone = (clones = {}) => ({
  async open(path) {
    if (!Object.hasOwn(clones, path)) throw new NotACloneError(path)
    return clones[path]
  },
})
