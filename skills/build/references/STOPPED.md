# When work stops

`build` reads this when a track is blocked, when the user says they built a ticket by hand, or when the user abandons a spec.

## Blocked tracks

The **Drain** reports each blocked track with what stopped it and the user's options, from this table. A track stays blocked until the user acts; running `/build` again unchanged retries the same work.

| What stopped the track | What it wrote | The user's options |
|---|---|---|
| A ticket its builder and fixer could not build | the ticket's **Status** `blocked`, its Notes saying why | Change the ticket (its criteria, or a hint in its Notes), then run `/build` again for a fresh builder. Build it by hand on the milestone's branch, commit, then run `/build <spec-id> — <ticket> done at <SHA>`. Split or drop it with `/write-tickets <spec-id> --amend`. |
| A check that failed after two fixes | the milestone's **Phase** `failed`, before its squash | Fix it by hand on the milestone's branch and commit, then run `/build` again: the check runs again. When the check itself is wrong, change its **Done when** with `/write-tickets <spec-id> --amend`. |
| Escalated findings left to the user | the milestone's **Phase** `ask` | Answer each one at the next `/build`, or tell it to leave them to the arbiter. |
| A landing stopped | as LAND.md's **When it stops** says | Follow LAND.md's line for that stop, then run `/build` again. A fix by hand on `sdd/<spec-folder>/spec` must go into the squash of the milestone it fixes, keeping that squash's message and its `Sdd-Milestone` trailer: a commit left on top of the squash is outside the suite's run, and a squash without its trailer is lost. |
| A repository with uncommitted changes | nothing | Commit or stash them, then run `/build` again. |

### Built by hand

At build's step 1, for each ticket the user says they built by hand at a SHA: check that the commit is on the milestone's branch (`git -C <root> merge-base --is-ancestor <SHA> sdd/<spec-folder>/M<NNN>`), then run `sdd set <ticket> Commit <the full SHA from git -C <root> rev-parse>` and `sdd set <ticket> Status done`. When the commit is not on that branch, tell the user and leave the ticket as it is. Done when every such ticket is `done` with its commit, or the user knows why not.

## Abandon a spec

`/build <spec-id> --abandon <reason>` stops a spec for good; it runs even when the spec is already abandoned, to finish an earlier run. When `spec.md` has a **Landed** line, report it and stop: a landed spec is changed by a new spec. Otherwise check for a running build and claim the repositories by build's **Locks**, then show the user the branches step 2 deletes, with the squashed milestones not yet landed whose only copy goes with them, and go on once they agree:

1. **Mark it.** Run `sdd set <spec.md> Abandoned "<reason>" --after Key`. The spec then stops counting as in flight, by FORMAT.md, and `/build` refuses it. Done when `spec.md` holds the line.
2. **Delete its branches.** In each repository of **Repos**, with its root from `state`'s track `repo.root`, list `git -C <root> branch --list 'sdd/<spec-folder>/*'`. When `HEAD` is on one of them, check out the repository's base by build's **Branches** first; when the tree is not clean, report it and leave that repository's branches. Then delete each branch with `git -C <root> branch -D`. Done when no `sdd/<spec-folder>/` branch is left, or the report names each repository and branch kept, unlinked or dirty.
3. **Report** the milestones that landed, each with its repository and **Landed** SHA: their work stays on the base. Undoing it is the user's call, with `git -C <root> revert <SHA>` per milestone, newest first, or with a new spec. Also name the squashed milestones that did not land and went with their branches. Release the claims by build's **Locks**, also when step 2 stopped. Done when the user has the report and the claims are released.
