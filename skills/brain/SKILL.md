---
name: brain
description: Recall from and record to the second brain, the team's notes on every repository and the hub specs are worked from. Use before working on a repository's code from the brain; when the user asks to set up, link, explore, view, remember, recall or sync the brain; when the user asks what is in flight, or a question that spans several repositories; or when you learn a gotcha, decision or contract a repository itself does not record.
argument-hint: "[setup | link | explore [<repo>] | status | ask <question> | view | recall | remember <fact> | sync] [@<brain>]"
metadata:
  type: process
---

The **second brain** is a git repository holding the team's notes on many repositories, cloned on each teammate's machine and shared by pull and push, with this machine's pipeline work kept beside them in an ignored `.sdd/`. The user works from it: Claude is launched in the brain's folder, with the repositories the work needs open beside it. [FORMAT.md](references/FORMAT.md) gives its layout, the active brain, the repo slug, **registered**, **linked** and **open**, the working repository, the note format and the spec lines. The brain is everything a teammate knows about the repositories, readable without cloning them, so a product owner or a newcomer can ask it too. **Authored** and **explored** notes are defined in FORMAT.md; the user's personal preferences belong in your own memory.

The first argument picks the branch:

| Argument | Follow |
|---|---|
| `setup` | [SETUP.md](references/SETUP.md) |
| `link` | [LINK.md](references/LINK.md) |
| `explore [<repo>]` | [EXPLORE.md](references/EXPLORE.md) |
| `status` | [STATUS.md](references/STATUS.md) |
| `ask <question>` | [ASK.md](references/ASK.md) |
| `view` | [VIEW.md](references/VIEW.md) |
| `recall` | [RECALL.md](references/RECALL.md) |
| `remember <fact>` | **Record** below |
| `sync` | **Sync** below |

With no argument: recall before working in a registered repository, follow ASK.md when the user's question spans several repositories, and record when you have learned something the brain should hold.

Every branch except `setup` and `view` works in the **active brain**, picked by FORMAT.md from the session's working directories, and reads or writes no other brain. Name the active brain in every report whenever more than one is open. When none is open, say so by FORMAT.md and stop. Run every git command in the brain as `git -C <brain>`.

## Record

When you learn something the brain should hold, the user asks you to remember it (`remember <fact>`), or another skill hands you candidates:

1. **Find its home.** Grep the brain's descriptions for an authored note already covering it. When only an explored note covers it, write only the reason or trap that note lacks, as a new authored note linking it. Done when you know whether to update an authored note or write a new one.
2. **Propose.** Show the user the note's path and full text by FORMAT.md, or the diff to the existing note. It goes in `repos/<slug>/`, or in `shared/` when it spans repositories, linked to its related notes. A note on a repository the brain does not register waits for `/brain setup`: say so and leave it out. Several candidates go out as one numbered list, each with its path and text, for the user to pick by number. Done when the user confirms or declines each; revise until they do.
3. **Commit** the notes confirmed from one proposal as one commit, staging each by its path, with a present-tense title. One note takes its own: `Records <name> for <slug>` (`for <slug>, <slug>` for a shared note), `Updates <name>` or `Deletes <name>`. Several take the occasion that brought them, such as `Records what 012-checkout taught` or `Records the gotchas behind the invoice rounding bug`, with one detail bullet per note: its path, and whether it is recorded, updated or deleted. Done when `git -C <brain> status --porcelain -- <each confirmed note's path>` lists nothing, and one commit holds them.

A wrong or stale note goes the same way: propose deleting it, then commit the deletion. Recording never pushes. Record writes authored notes only; what the code does reaches the brain through `explore`.

## Sync

Only when the user asks, since a push publishes the notes to every teammate:

1. **Pull** with `git pull --rebase`. When the brain has no remote, say it is local only, offer to add one (`git remote add origin <url>`), and stop until it has one. When its branch has no upstream yet, skip the pull. A conflict means two people changed one note: merge both versions' facts into one, show the user the merged note, and continue the rebase once they confirm. Done when the rebase completes, or was skipped.
2. **Push.** Show the commits `git log --oneline @{u}..` lists, or `git log --oneline` when there is no upstream yet, then `git push`, or `git push -u origin HEAD` the first time. Done when the push succeeds, or the user has its error.
