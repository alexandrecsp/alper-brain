import { isAbsolute, relative, resolve } from 'node:path'
import { PathOutsideBrainError } from '../../domain/errors/path-outside-brain.error.mjs'

// Refuses a file's path unless it names a file inside the brain's folder.
export const insideBrain = (root, path) => {
  if (typeof path !== 'string' || path === '') throw new PathOutsideBrainError(path)
  const from = relative(resolve(root), resolve(root, path))
  if (from === '' || from.startsWith('..') || isAbsolute(from)) throw new PathOutsideBrainError(path)
}
