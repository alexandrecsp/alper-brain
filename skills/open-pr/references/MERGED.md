# Follow the merge

`build` lands on the local base only; a PR then merges on the remote, often as a squash or rebase merge under new SHAs, and the local base must follow it. This records that merge in the spec's **Merged** line, which a dependent spec waits for, by [FORMAT.md](../../brain/references/FORMAT.md)'s **Specs**.

Find `sdd`, the spec, its landings and each landing's head branch as [SKILL.md](../SKILL.md)'s **Process** says. When there is no spec, say that `--merged` records a spec's merge, and stop.

1. **Pick the repositories**: each one in the spec's **Repos** whose card has a remote and no entry in the spec's **Merged** line, or only the one the user named. Leave out a repository whose track has a milestone not landed, and report it as not fully landed. Done when you hold the list, or every repository is merged, local only or not fully landed.

2. **Read the PRs.** For each repository picked, leave out its port landing (head branch `sdd/<spec-folder>/port`), which **Merged** does not record. Run `git -C <root> fetch origin <base>`; when `origin` lacks the base, an **unpushed base** by SKILL.md's step 2, skip the fetch and report that the base was never pushed, so nothing has merged there. For each other landing, run `gh pr view <head-branch> --repo <owner>/<name> --json state,mergeCommit,baseRefName,url`. Done when each landing has its PR's state and base, or `gh` found no PR for it, or the repository is reported unpushed.

3. **Record the merge.** For a repository whose PRs are all `MERGED`, or that has no PR, as when the user pushed the base by hand, run `sdd merged <spec-folder> --track <slug> --brain <the active brain>`, adding `--commit <mergeCommit.oid>` of the repository's last landing that has a PR. Act on what it prints:
   - `merged: <slug>@<SHA>`: done for that repository.
   - `stopped: realign`, with its `drops:` lines: the PR merged these squashes under other SHAs, so the local base drops its own copies and takes `origin/<base>`. Show the user the commits it drops; once they agree, run the same command with `--realign`.
   - `stopped: open`: `origin/<base>` does not hold the work yet. Report the PR's URL; when it is `MERGED` into another branch than `<base>` (its `baseRefName`), report that the earlier PR of the series must merge first; when no PR exists, report that nothing on the remote holds the work.
   - `stopped: unfetched`: run step 2's fetch again, or report that `origin` lacks the base.
   - `stopped: unlanded`: report that the track has milestones not landed, and that `/build` finishes them.
   - `stopped: foreign`: the local base holds commits that are not this spec's. Show the user what it printed and leave the base as it is; they move those commits, then you run it again.
   - `stopped: dirty`: the checked-out base has uncommitted changes. Ask the user to commit or stash them, then run the same command again.

   For a PR that is `OPEN`, report its URL. For a PR that is `CLOSED` and not merged, report that the spec's work never reached the remote in that repository: the user decides whether to reopen it, or to mark the spec abandoned by [IN-FLIGHT.md](../../write-spec/references/IN-FLIGHT.md).

   Done when each repository picked is merged, or you have reported what it waits on.

4. **Report**, one line per repository: merged with its SHA (and that its base moved to origin, when the line says so), local only, not fully landed, or what it waits on. When every repository is merged or local only, name the in-flight specs whose **Depends on** line, in `.local/specs/*/spec.md`, names this spec: this one no longer holds them. Done when the user has the report.
