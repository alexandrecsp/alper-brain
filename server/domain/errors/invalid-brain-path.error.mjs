// Thrown when a brain is added by something other than an absolute path.
export class InvalidBrainPathError extends Error {
  constructor(path) {
    super(`a brain's path must be absolute: ${JSON.stringify(path)}`)
  }
}
