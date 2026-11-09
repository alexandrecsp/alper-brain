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

When you learn something the brain should hold, the user asks you to remember it (`remember <fact>`), or another skill hands you candidates, write each as a **draft** by FORMAT.md's **Drafts**, without stopping the work to ask:

1. **Find its home.** Grep the descriptions of the brain's notes and of `.sdd/drafts/` for one already covering it. A draft already covering it takes the new fact into its own text. When an authored note covers it, the draft is its `update`; when only an explored note does, the draft is a new authored note holding only the reason or trap that note lacks, linking it. A note the fact makes untrue gets its draft by FORMAT.md's **When a note stops being true**. It goes in `repos/<slug>/`, or in `shared/` when it spans repositories, linked to its related notes. A note on a repository the brain does not register waits for `/brain setup`: say so and leave it out. Done when each fact has its draft's `target` and `action`.
2. **Draft it.** Write each draft into `.sdd/drafts/` in plain prose, by [PROSE.md](references/PROSE.md), and check the drafts you wrote by its **Check**. Tell the user in one line per draft its name and description, then once that `/brain sync` consolidates the drafts; `remember` leaves that line out. Done when each fact sits in exactly one draft, the check prints `prose: ok`, and the user has been told.

`remember <fact>` then runs **Consolidate** at once on the drafts it wrote, since the user asked for the note; every other draft waits for `sync`. Record writes authored notes only; what the code does reaches the brain through `explore`.

## Consolidate

Turn drafts into commits. `sync` runs it after its pull on every draft in `.sdd/drafts/`, and `remember` on the drafts it just wrote: these are the **drafts in scope**, and the rest stay as they are.

1. **Merge.** Read the drafts in scope, and for each, the notes and other drafts its description bears on, since a teammate may have changed the brain meanwhile:
   - fold duplicate drafts into one, and discard a draft whose fact a note now states in full;
   - make an `update` of a `record` whose note now exists, and rebase an `update` or `supersede` onto its note's current text, keeping the draft's new facts, so a teammate's edit survives;
   - turn a draft whose target note is gone into a `record`, or discard it when it was a `delete`;
   - add the `[[links]]` each lacks; for each `topic` whose theme a draft belongs to, draft the topic's `update` with its link, and for three or more notes or drafts, among those read here, on one theme that no topic gathers, draft a new `topic`.

   Done when no two drafts or notes hold one fact, each draft in scope matches its note's current text, each links its related notes, and PROSE.md's **Check** prints `prose: ok` for the drafts in scope.
2. **Propose.** Show the user one numbered list: each draft's `target`, its action, and its full text, or the diff for an `update`, `supersede` or `delete`. The user marks each one by number: commit it (all of them by default), discard it, or keep it as a draft for a later sync. Done when every draft in scope is marked.
3. **Commit** the drafts marked for it as one commit: write each note at its `target` without its `target`, `action` and `supersedes` lines, delete the note a `delete` names, and for a `supersede`, mark the decision it names by FORMAT.md's **When a note stops being true**; stage each path. One note takes its own title: `Records <name> for <slug>` (`for <slug>, <slug>` for a shared note), `Updates <name>`, `Supersedes <old> with <name>` or `Deletes <name>`. Several take the occasion that brought them, such as `Records what 012-checkout taught`, or `Consolidates <n> notes` when they came from several occasions, with one detail bullet per note: its path, and whether it is recorded, updated, superseded or deleted. A deletion's reason goes in the commit's body. Then delete the drafts committed or discarded. Done when `git -C <brain> status --porcelain -- <each committed path>` lists nothing, one commit holds the marked drafts (none when none is marked), and `.sdd/drafts/` holds only the drafts kept and those out of scope.

## Sync

Only when the user asks, since a push publishes the notes to every teammate:

1. **Pull** with `git pull --rebase`. When the brain has no remote, say it is local only and offer to add one (`git remote add origin <url>`); when the user declines, skip this step and step 4. When its branch has no upstream yet, skip the pull. A conflict in `timeline.json` resolves by running step 3's command, staging the file and continuing the rebase. A conflict in a note means two people changed one note: merge both versions' facts into one, show the user the merged note, and continue the rebase once they confirm. Done when the rebase completes, or was skipped.
2. **Consolidate** every draft in `.sdd/drafts/`, by **Consolidate**. Done when Consolidate's last step is done, or `.sdd/drafts/` was empty.
3. **Timeline.** Run `node <this skill's folder>/scripts/timeline.mjs <brain>`, which writes `timeline.json` by FORMAT.md's **Timeline**. When `git -C <brain> status --porcelain -- timeline.json` lists the file, commit it alone as `Updates the timeline`. Done when that status lists nothing.
4. **Push.** Show the commits `git log --oneline @{u}..` lists, or `git log --oneline` when there is no upstream yet, then `git push`, or `git push -u origin HEAD` the first time. Done when the push succeeds or the user has its error, and the drafts kept for a later sync are listed.
