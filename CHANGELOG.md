# Changelog

Each release lists what changed for a user of the plugin. **Migrates by itself** means the next command on an old brain or spec moves it to the new form; you do nothing.

## 2.1.0

### New

- **Release branches.** `/build` offers the default branch or the most recent `rlse/vX.Y.Z` as a spec's base, and from a release branch the next version, which it raises in the version files.
- **The workshop.** The build pane is now a live star chart of the session: the core, a star per station, and each agent as light. Open it with `/workshop`.
- **Follow the merge.** `/open-pr <spec-id> --merged` records that a spec's PRs merged: it brings each local base level with `origin` (after a squash or rebase merge too, once you agree) and writes the spec's **Merged** line. `/brain status` lists landed specs still waiting for their merge.
- **Repository claims.** A `/build` claims each repository it changes in `.brain/locks/`. A build of another spec in the same repository stops and asks you whether the first one still runs. `/brain status` shows each claim.
- **Amend a spec.** `/write-tickets <spec-id> --amend` changes a spec that is already ticketed or building. It keeps the work already built and re-cuts only the open tickets and milestones.
- **Options for blocked work.** When a track stops, `/build` lists what you can do. For example, you can build a blocked ticket by hand and tell `/build <spec-id> — <ticket> done at <SHA>`.
- **Abandon a spec.** `/build <spec-id> --abandon <reason>` marks the spec, deletes its branches and lists the work that already landed.
- **Answer PR comments.** `/open-pr <spec-id> --comments` gathers the review comments on a spec's open PRs. You mark each one fix, reply or skip. A fixer commits the fixes on the PR's branch, and once you agree, the PR gets the push and one reply.
- **Port a release fix.** When a spec lands on a release branch, `/build` offers to port its milestones to the default branch on `sdd/<spec>/port`, and `/open-pr` opens that PR too.
- **Free checks.** `node scripts/check.mjs` runs every check that needs no model; `.github/workflows/checks.yml` runs it on every push.

### Changed

- **Notes live in one `notes/` folder**, each authored note scoped by its `repos` line. Migrates by itself, at your next `/brain sync`, once you agree.
- **The brain's local folder is `.brain/`**, not `.sdd/`. Migrates by itself.
- **Milestones wait on other tracks through a Builds after line**, not a ticket's Depends on. Migrates by itself, at the next `/build` on the spec.
- **A spec waits for its dependencies to merge**, not only to land, in every repository that has a remote. A dependency that landed before 2.1.0 needs `/open-pr <its id> --merged` once.
- **Builders run on Sonnet**, not Haiku.
- `/brain explore` gives each monorepo package its own area, and a rerun reads only the changed files.
- The brain page answers escalations, abandons specs and drafts notes.
- Evals grade what the agent does, not what git saves, so a read-only sandbox no longer lowers their scores. New cases cover abandoning a spec, a ticket built by hand, and amending a spec. The brain's scripts have tests.

### Fixed

- `sdd dispatch` works in a read-only sandbox: the brief holds the whole Context block.

## 2.0.0

- Every command is named for its action: `/to-spec` is `/write-spec`, `/to-tickets` is `/write-tickets`, `/pr` is `/open-pr`, `/improve-and-refactor` is `/refactor`, and `/brainstorm-with-docs` is `/brainstorm --docs`.
- The skills other skills run, and the reference skills, leave the slash menu.
