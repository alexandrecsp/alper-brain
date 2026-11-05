# Land the spec

A repository's milestones **land** when its spec branch reaches its base, as one commit per milestone, with no merge commit. A spec in one repository lands once, after its last milestone. A spec across several lands a repository each time the build moves on to a milestone in another one, so each repository's base takes the milestones in the order [CONTRACT-CHANGE.md](../to-tickets/CONTRACT-CHANGE.md) cut them, and every base keeps working with the others.

## Land a repository

The repository is the one whose squashed milestones have no **Landed** line; work in it by [FORMAT.md](../brain/FORMAT.md)'s working repository rules, and find its base branch by the build's **Branches**.

1. **Check it has not landed.** When `git -C <root> merge-base --is-ancestor sdd/<spec-folder>/spec <base>` succeeds, its milestones are already on the base: skip to step 3. Done when you know they have not landed.

2. **Land it.** Ask the user before changing the base, naming the repository and the milestones that land. When the root is not open, ask the user to run `/add-dir <root>`, and stop. When `git -C <root> status --porcelain` is not empty, report it and stop. Run `git -C <root> rebase <base> sdd/<spec-folder>/spec`; on a conflict, run `git -C <root> rebase --abort`, report the conflicting files and stop. Run the repository's full suite on the rebased branch, from its root. When it fails, the base's new commits broke the spec: dispatch a fixer with the failure and the root, committing by the `commit` skill with the spec folder and the repository, then run the suite again; after two failed fixes, report the failure and stop, leaving the base untouched. Then check out the base and run `git -C <root> merge --ff-only sdd/<spec-folder>/spec`. Done when the base holds the spec's commits, or the user declined.

3. **Record the landing.** Write `**Landed:** <SHA>` into each of the repository's squashed milestones without one, under its **Squash** line, with the SHA of `git -C <root> rev-parse sdd/<spec-folder>/spec`. Skip this when the user declined in step 2: the build stops there, since later milestones build on this one being on the base. Done when each such milestone holds its **Landed** line, or the user declined.

## When no milestone is open

1. **Land the rest.** For each repository with a squashed milestone that has no **Landed** line, in milestone order, follow **Land a repository**. Done when every milestone has a **Landed** line, or the user declined.

2. **Record the spec's landing.** Write `**Landed:** <slug>@<SHA>, …` into `spec.md`, under its **Base** line, with one entry per repository in **Repos**: the **Landed** SHA of its last milestone. Specs that depend on this one wait for that line. Skip this when a milestone has no **Landed** line, or the line is already there. Done when `spec.md` holds the **Landed** line, or a milestone has not landed.

3. **Clean up and hand over.** In each repository, offer to delete the spec's branches (`git -C <root> branch -D` on each of `git -C <root> branch --list 'sdd/<spec-folder>/*'`); delete them when the user agrees. Report every milestone, from its files: its repository, the tickets built with their **Commit** lines, what its `review.md` fixed, and its **Squash** and **Landed** commits. Then report one **Decided for you** section listing each escalated finding across the milestones' `review.md` files with its milestone and Answer, the commits now on each base, and that the spec is built. Done when the user has the report.

4. **Keep what was learned.** The tickets' Notes and the review answers live in the brain's `.sdd/`, on this machine only, so whatever they hold that a later change needs is lost with it. Gather the gotchas from the tickets' Notes, and the escalated Answers whose reasons a later change would need, and drop whatever the code, the spec or an ADR already states. Invoke the `brain` skill to record the rest as one list of candidates, each in the notes of the repository it bears on. Done when the user has picked from the list, or nothing was left to offer.
