// Another program holds the server's port, or a server that will not step aside does.
export class PortHeldError extends Error {
  constructor(port, reason = 'it is held by another program') {
    super(`the server cannot take port ${port}: ${reason}`)
    this.name = 'PortHeldError'
  }
}
