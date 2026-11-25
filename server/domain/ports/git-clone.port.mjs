// The git clone port: one clone, by the folder `path` that holds it. A driven adapter implements the one call, by the `git` command
// or in memory:
//   open(path) → Promise of the clone's repo object, the calls `GitRead.open` gives and `Clones.build` expects, or rejects with
//                `NotACloneError` when the folder is no clone:
//     refs()         → { head: { branch, sha }, branches: [{ name, sha, remote }], sig }
//                      `head.branch` is null on a detached HEAD, and `head.sha` null on a branch with no commit. `branches` lists
//                      every local and remote-tracking branch (`remote` true for the latter), but no `<remote>/HEAD`. `sig` is a
//                      string that changes whenever HEAD or any branch moves.
//     commit(sha)    → { sha, parents, time, subject, author } (`time` the committer's, in ms; `subject` the message's first line),
//                      or null when the commit is missing, as in a shallow clone
//     walk(tips, { max, since, keep })
//                    → { commits, more }: the newest `max` commits (80 by default) reachable from `tips`, each after every child of
//                      it among them, newest first among those free to go. `since` (ms, 0 by default) leaves out commits older than
//                      it, except those whose sha `keep` (an iterable of shas) holds; `more` is true when older commits were left
//                      out. The same answer `GitRead`'s `walk` gives.
//     mergeBase(a, b) → the sha of the best common ancestor of two commits, or null when they share no history
//     remoteUrl()    → the origin's url, or null without one
export {}
