// Thrown when a brain's `.local/repos.json` links no folder for a repository's slug.
export class UnlinkedRepoError extends Error {
  constructor(slug) {
    super(`no clone is linked for the repository ${JSON.stringify(slug)}`)
    this.name = 'UnlinkedRepoError'
  }
}
