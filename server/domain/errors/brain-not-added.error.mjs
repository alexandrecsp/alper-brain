// The running server did not take the brain onto its list.
export class BrainNotAddedError extends Error {
  constructor(path, reason) {
    super(`the server did not add the brain at ${path}: ${reason}`)
    this.name = 'BrainNotAddedError'
  }
}
