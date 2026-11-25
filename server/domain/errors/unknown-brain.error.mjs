// Thrown when an id names no listed brain.
export class UnknownBrainError extends Error {
  constructor(id) {
    super(`no brain is listed under the id ${JSON.stringify(id)}`)
    this.name = 'UnknownBrainError'
  }
}
