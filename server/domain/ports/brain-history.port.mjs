// The brain history port: the git history of one brain's notes, by the folder `root` that holds the brain. A driven adapter
// implements these two calls, by the `git` command or in memory. Paths are relative to `root`, spelled with `/`, whatever
// repository holds the brain:
//   log(root)           → Promise of the commits that changed a file under `notes/`, oldest first, merges left out, as
//                          [{ sha, date, author, title, changes: [{ status, path, from? }] }], `date` the author's, in ISO 8601;
//                          `status` is `added`, `modified`, `deleted` or `renamed`, and `from` the old path of a rename. Resolves
//                          with `[]` when the folder is in no git repository or its repository has no commit.
//   textsAt(root, wanted) → Promise of a Map from `<sha>:<path>` to the file's text at that commit, for each `{ sha, path }` of
//                          `wanted`; a file missing at its commit has no entry
export {}
