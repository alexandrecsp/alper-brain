// Thrown when a linked folder is no git clone.
export class NotACloneError extends Error {
  constructor(path) {
    super(`${JSON.stringify(path)} is not a git clone`)
    this.name = 'NotACloneError'
  }
}
