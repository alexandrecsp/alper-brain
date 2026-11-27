---
name: brain
description: Recall from and record to the second brain, the team's notes on every repository. Use before working on a repository's code; when the user asks to set up, link, explore, tour, view, remember, recall, sync or export the brain, what is in flight, or a question that spans several repositories; or when you learn a term, gotcha, decision or contract a repository does not record.
argument-hint: "[setup | link | explore [<repo>] | tour [<repo>] | status | ask <question> | view | recall | remember <fact> | sync | export] [@<brain>]"
metadata:
  type: process
---

The **second brain** is a `.brain/` folder in a git repository, holding the team's notes on many repositories, shared by pull and push, with this machine's pipeline work kept in the same folder and ignored by its own `.gitignore`. The user launches Claude in the repository holding it, with the repositories the work needs open beside it; a project of one repository keeps an **embedded** or **local** brain in its own `.brain/` instead. [FORMAT.md](references/FORMAT.md) gives its layout, the active brain, the repo slug, **registered**, **linked** and **open**, the working repository, the note format, **authored** and **explored** notes and the spec lines. The brain is everything a teammate knows about the repositories, readable without cloning them, so a product owner or a newcomer can ask it too. The user's personal preferences belong in your own memory.

The first argument picks the branch:

| Argument | Follow |
|---|---|
| `setup` | [SETUP.md](references/SETUP.md) |
| `link` | [LINK.md](references/LINK.md) |
| `explore [<repo>]` | [EXPLORE.md](references/EXPLORE.md) |
| `tour [<repo>]` | [TOUR.md](references/TOUR.md) |
| `status` | [STATUS.md](references/STATUS.md) |
| `ask <question>` | [ASK.md](references/ASK.md) |
| `view` | [VIEW.md](references/VIEW.md) |
| `recall` | [RECALL.md](references/RECALL.md) |
| `remember <fact>` | [RECORD.md](references/RECORD.md) |
| `sync` | [SYNC.md](references/SYNC.md) |
| `export` | [EXPORT.md](references/EXPORT.md) |

With no argument: recall before working in a registered repository, follow ASK.md when the user's question spans several repositories, and record by RECORD.md when you have learned something the brain should hold.

Every branch except `setup` and `view` works in the **active brain**, picked by FORMAT.md from the session's working directories, and reads or writes no other brain. Name the active brain in every report whenever more than one is open. When none is open, say so by FORMAT.md and stop. Run every git command in the brain as `git -C <brain>`.
