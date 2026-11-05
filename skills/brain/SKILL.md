---
name: brain
description: Recall from and record to the second brain, the team's notes across every repository, and the hub the whole pipeline works from. Use when an agent file names a second brain; when the user asks to set up, link, view, remember, recall or sync it; when the user asks what is in flight across the repositories, or a question that spans several of them; or when you learn a gotcha, decision or contract the repository itself does not record.
argument-hint: "[setup | link | status | ask <question> | view | recall | remember <fact> | sync] [@<brain>]"
metadata:
  type: process
---

The **second brain** is a git repository holding the team's notes on many repositories, cloned on each teammate's machine and shared by pull and push, with this machine's pipeline work kept beside them in an ignored `.sdd/`. The user works from it: Claude is launched in the brain's folder, with the repositories the work needs open beside it. [FORMAT.md](FORMAT.md) gives its layout, the active brain, the repo slug, **registered**, **linked** and **open**, the working repository, the note format and the spec lines. Notes hold what a repository cannot tell by looking: the reason behind a choice, a trap, a contract between two repositories. What the code, git history or docs already say stays there, and the user's personal preferences belong in your own memory.

The first argument picks the branch:

| Argument | Follow |
|---|---|
| `setup` | [SETUP.md](SETUP.md) |
| `link` | [LINK.md](LINK.md) |
| `status` | [STATUS.md](STATUS.md) |
| `ask <question>` | [ASK.md](ASK.md) |
| `view` | [VIEW.md](VIEW.md) |
| `recall` | [RECALL.md](RECALL.md) |
| `remember <fact>` | **Record** below |
| `sync` | **Sync** below |

With no argument: recall before working in a registered repository, follow ASK.md when the user's question spans several repositories, and record when you have learned something the brain should hold.

Every branch except `setup` works in the **active brain**, picked by FORMAT.md from the session's working directories, and reads or writes no other brain. Name the active brain in every report whenever more than one is open. When none is open, say so by FORMAT.md and stop. Run every git command in the brain as `git -C <brain>`.

## Record

When you learn something the brain should hold, the user asks you to remember it (`remember <fact>`), or another skill hands you candidates:

1. **Find its home.** Grep the brain's descriptions for a note already covering it. Done when you know whether to update that note or write a new one.
2. **Propose.** Show the user the note's path and full text by FORMAT.md, or the diff to the existing note. It goes in `repos/<slug>/`, or in `shared/` when it spans repositories, linked to its related notes. Several candidates go out as one numbered list, each with its path and text, for the user to pick by number. Done when the user confirms or declines each; revise until they do.
3. **Commit** each confirmed note alone, with a present-tense title: `Records <name> for <slug>`, `Updates <name>` or `Deletes <name>`. Done when the brain's `git status --porcelain` lists nothing.

A wrong or stale note goes the same way: propose deleting it, then commit the deletion. Recording never pushes.

## Sync

Only when the user asks, since a push publishes the notes to every teammate:

1. **Pull** with `git pull --rebase`. A conflict means two people changed one note: merge both versions' facts into one, show the user the merged note, and continue the rebase once they confirm. Done when the rebase completes.
2. **Push.** Show the commits `git log --oneline @{u}..` lists, then `git push`. Done when the push succeeds, or the user has its error.
