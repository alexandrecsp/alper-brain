// Thrown when a picked folder holds no brain: neither a `BRAIN.md` nor a `.brain/` folder holding one.
export class NotABrainError extends Error {
  constructor(path) {
    super(`no BRAIN.md or .brain/BRAIN.md in ${path}`)
    this.path = path
  }
}
