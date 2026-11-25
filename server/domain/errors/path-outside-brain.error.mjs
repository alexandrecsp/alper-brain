// Thrown when a file's path leaves the brain's folder.
export class PathOutsideBrainError extends Error {
  constructor(path) {
    super(`a file's path must stay inside the brain's folder: ${JSON.stringify(path)}`)
    this.name = 'PathOutsideBrainError'
  }
}
