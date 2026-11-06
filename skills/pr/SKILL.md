---
name: pr
description: Write the pull requests for a spec or a branch, one per repository landing, each with a visual summary, before-and-after evidence and a merge-danger call, cross-linked in merge order, and open or update them on request.
argument-hint: "[spec-id] [repo] [base]"
disable-model-invocation: true
metadata:
  type: process
---

A PR body shows the reviewer the **shape** of the change before they open the diff, the **evidence** that it works, and the **merge danger**. It opens on its first heading, and its prose is the one sentence each visual or claim needs, in the glossary's terms.

The title reads like a commit title: it completes "If applied, this PR…", in the present tense, capitalised, at most 72 characters, prefixed `<key>: ` when the spec has a key.

```markdown
## Summary

<one sentence>

<visual>

## Evidence

- **<behaviour>**
  **Before:** <screenshot, output, or the failing test as pseudocode>
  **After:** <screenshot, or the passing run's output>

**Unverified:** <behaviours with no before and after, or "None">

## Merge Danger

**Door:** <one-way | two-way>: <why, in one line>

**Blast radius:** <each thing that breaks if this is wrong>
```

When the repo has a PR template (`.github/pull_request_template.md`, or a file in `.github/PULL_REQUEST_TEMPLATE/`), fill that template, with these three sections under its description heading.

## Summary

Pick the **smallest view** that makes the change's point clear: usually one, sometimes two. [VISUALS.md](references/VISUALS.md) shows each:

- **Pseudocode**: logic or an algorithm.
- **Call tree**: runtime control flow.
- **Component tree**: UI structure, with the state and module boundaries that matter.
- **File tree**: file responsibilities, or a broad refactor.
- **Mermaid**: interaction or data flow between components.
- **Shaped diff**: one of the views above with `+` and `-` lines, when the surrounding shape already exists.
- **Whole block**: most of it is new, or the reviewer needs the target shape.

When the diff builds a spec, start from the diagrams its files already hold: the milestone's **milestone shape**, or the spec's **module map** when the diff builds all of it, as the Mermaid view, with its marks. Trim it to what the diff touches, and redraw it where the build departed from it, as the tickets' Notes and the diff show. The [DIAGRAMS.md](../to-spec/references/DIAGRAMS.md) entries define both.

Keep only the calls, files, props, states and boundaries the reviewer needs to read the diff. When the landing spans milestones, each milestone's increment gets its own sentence and visual.

## Evidence

Each item pairs a **before** with an **after** for one behaviour the PR claims. A screenshot is S-tier, when the change is visual and the environment can take one. Execution is A-tier: the exact test, as pseudocode, that fails on the base and passes on the head, or the console output that changed. Every Before and After quotes a run you did.

## Merge Danger

The **door** is two-way when reverting the merge undoes it, one-way when it does not: destructive data changes and schema migrations, a removed or changed interface that others consume (another repository a second-brain contract names among them), anything that leaves the system (emails sent, webhooks fired, packages published), and any decision an ADR or a `decision` note records as hard to reverse. A change behind a flag stays two-way only until the first write in the new shape lands. An added shape beside an unchanged old one (an expand or migrate step of a contract change) stays two-way; removing the old shape (its contract step) is one-way until every consumer's migration has merged and deployed. When the repo's agent docs list changes it treats as one-way, their list wins. The agent that wrote the change is grading it, so a close call is one-way, with the reason stated.

The **blast radius** names each thing that breaks if the change is wrong, by the module or user that feels it: consumers of a changed interface (every one its `contract` note lists, in other repositories too), data already stored, layout shift, mobile, performance.

## Process

A PR comes from one **repository** and holds one **landing**: the milestones of that repository's track that one landing by [LAND.md](../build/references/LAND.md) puts on its base, as the **Landings** line of `spec.md` records them. A spec in one repository has one landing. A spec that landed `billing-api`, then `web-app`, then `billing-api` again has three, and opens a **series** of three PRs, by [SERIES.md](references/SERIES.md). Without a spec, the one PR is the working repository's checked-out branch, by [FORMAT.md](../brain/references/FORMAT.md). Steps 3 to 7 run once per landing.

The brain is a git repository too, so a bare `git` or `gh` reads the brain instead: run every git command as `git -C <root> …` and every `gh` command with `--repo <owner>/<name>`, taking the owner and name from the `remote` of the repository's `REPO.md` card. When the card's remote is `local only`, write the body and stop at step 6.

1. **Find the spec.** Take the spec id or path the user gave, resolved by [SPEC-ID.md](../to-spec/references/SPEC-ID.md). Otherwise take the path segment after `sdd/` in the working repository's checked-out branch (`git -C <root> branch --show-current`), or else the spec whose **Key** matches the commit messages' key. Done when you hold the spec folder, or know there is none.

2. **Cut the landings.** Each entry of the **Landings** line is one landing, in its order. The squashed milestones no entry holds yet form one more landing per track, after every entry, in the order of the spec's **Repos** line; a milestone with no **Squash** joins none, and a series names it as still to build. In a spec in FORMAT.md's flat layout with no **Landings** line, group its squashed milestones, in number order, into runs of the same track instead. For each landing:
   - its root from the brain's `.sdd/links.json`, and its base from its entry in the **Base** line of `spec.md`, else the remote's default branch (`git -C <root> symbolic-ref --short refs/remotes/origin/HEAD`, without `origin/`); run `git -C <root> fetch origin <base>`, and compare against `origin/<base>`, since landing fast-forwards the local base, so it already holds the change;
   - its **head**: the **Landed** SHA of its last milestone, else that milestone's **Squash** SHA;
   - its **head branch**: `sdd/<spec-folder>/pr-M<NNN>`, with `NNN` its first milestone's number in its track;
   - its **base ref**: `origin/<base>` for the repository's first landing, and the previous landing's head for a later one, until that head is on `origin/<base>`.

   When the user named a repository, keep only its landings; a base the user gave overrides the spec's. Without a spec, the one landing's head branch is the checked-out branch and its head that branch's tip, and its base the one the user gave, else the base of its open PR (`gh pr view <head-branch> --repo <owner>/<name> --json baseRefName`), else the remote's default; when the checked-out branch is the base itself, stop with: "The commits sit on `<base>` itself: create a branch for them (`git -C <root> switch -c <name>`) and run `/pr` again." Done when every squashed milestone sits in exactly one landing, and `git -C <root> diff <base ref>...<head>` is non-empty for each.

3. **List the claims.** Read the tickets of the landing's milestones (squashing leaves their **Commit** SHAs off the head, so match by milestone, not by commit), and the [domain docs](../domain-modeling/references/DOMAIN-DOCS.md) of the contexts its diff touches. Done when you can list every behaviour the landing claims: its tickets' acceptance criteria and its milestones' **Delivers**, the spec's user stories when one landing builds all of it, or, without a spec, each behaviour the commit messages name.

4. **Gather evidence.** Run the card's `unit` and `e2e` suites on the head. For each claim, find the test in the diff that proves it; take a screenshot when the change is visual. For the before, run that test against the base ref in a worktree (`git -C <root> worktree add --detach <scratch-dir> <base ref>`, install dependencies as the lockfile says, copy the test in, run it, then `git -C <root> worktree remove <scratch-dir>`), or capture the base's output there. A before counts when it fails on the claim's assertion; one that fails on setup or a missing import is "absent on the base" for a new module, and otherwise moves the claim under **Unverified**. Done when every claim from step 3 has a before and an after, or sits under **Unverified**.

5. **Call the merge danger** by **Merge Danger**, weighing every hunk of the diff. Read the `contract` notes on the spec's **Brain notes** line and every `shared/` `contract` note whose `repos` names this repository. For each interface the diff changes or removes that a note records, list its consumers: one that a milestone of this spec migrates is named with that milestone's landing, by its PR once the series has one; for the rest, run [CONTRACT-CHANGE.md](../to-tickets/references/CONTRACT-CHANGE.md)'s **Consumer check**, and an unchecked one makes the door one-way. Done when every hunk is weighed, every consumer of every changed contract is named with what breaks in it or "none", and the call names each one-way change or states there is none.

6. **Write it.** Fill the title and body, and show them to the user as one raw markdown block; a series adds its **Merge Order** by SERIES.md. Done when every section is filled, Summary holds at most two visuals per increment, and every Evidence item quotes a run from step 4.

7. **Open or update the PR**, when the user asked for one. Push the head to the head branch, never the checked-out branch: `git -C <root> push origin <head>:refs/heads/<head-branch>`. When `gh pr list --repo <owner>/<name> --head <head-branch> --json number,url` finds a PR, update it: `gh pr edit <number> --repo <owner>/<name> --title "<title>" --body-file -`. Otherwise open it: `gh pr create --repo <owner>/<name> --head <head-branch> --base <base> --title "<title>" --body-file -`, with the earlier landing's head branch as the base for a stacked one, by SERIES.md. Done when you have reported each PR's URL, and a series' bodies all list each other; without the ask, done at step 6.
