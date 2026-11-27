# Sync

The `sync` branch of [`brain`](../SKILL.md), and **Consolidate**, which turns drafts into commits.

## Sync

Only when the user asks, since a push publishes the notes to every teammate. A local brain has no remote, by [FORMAT.md](FORMAT.md)'s **Local brain**. An embedded brain's commits land on the host's current branch and reach the team with it, by FORMAT.md's **Embedded brain**. Both skip step 1 and step 3's push, and still list the drafts kept. For an embedded brain, name that branch when **Consolidate** proposes the drafts, and again once they are committed.

1. **Pull** with `git pull --rebase`. When the brain has no remote, say it is local only and offer to add one (`git remote add origin <url>`); when the user declines, skip this step and step 3. When its branch has no upstream yet, skip the pull. A conflict in a note means two people changed one note: merge both versions' facts into one, show the user the merged note, and continue the rebase once they confirm. Done when the rebase completes, or was skipped.
2. **Consolidate** every draft in `.local/drafts/`, by **Consolidate** below. Before it, when the brain is in an old layout, offer [MIGRATE.md](MIGRATE.md)'s **The layout move**, once, since every teammate pulls it; stop when the user declines. Then run RECALL.md's script with `--legacy`: when it lists notes, draft their migration by [MIGRATE.md](MIGRATE.md)'s **Note types**, so Consolidate proposes it with the other drafts. Done when Consolidate's last step is done, or `.local/drafts/` was empty.
3. **Push.** Show the commits `git log --oneline @{u}..` lists, or `git log --oneline` when there is no upstream yet, then `git push`, or `git push -u origin HEAD` the first time. Done when the push succeeds or the user has its error, and the drafts kept for a later sync are listed.

## Consolidate

Turn drafts into commits. `sync` runs it after its pull, on every draft in `.local/drafts/`.

1. **Merge.** Read every draft, and for each, the notes and other drafts its description bears on, since a teammate may have changed the brain meanwhile:
   - fold duplicate drafts into one, and discard a draft whose fact a note now states in full;
   - make an `update` of a `record` whose note now exists, and rebase an `update` or `supersede` onto its note's current text, keeping the draft's new facts, so a teammate's edit survives;
   - turn a draft whose target note is gone into a `record`, or discard it when it was a `delete`;
   - add the `[[links]]` each lacks, and give each draft its `type` and `layer` by FORMAT.md.

   Done when no two drafts or notes hold one fact, each draft matches its note's current text, each links its related notes, and PROSE.md's **Check** prints `prose: ok` and `<the brain skill's folder>/scripts/schema.mjs` prints `schema: ok`.
2. **Propose.** Show the user one numbered list: each draft's `target`, its action, and its full text, or the diff for an `update`, `supersede` or `delete`. The user marks each one by number: commit it (all of them by default), discard it, or keep it as a draft for a later sync. Done when every draft is marked.
3. **Find the keys.** A note describes how its repository behaves, not the spec it was learned in, so its key comes from this sync. Group the marked drafts by their `repos`: a draft naming one slug joins that repository's group, and a draft naming several is its own group, over those slugs. A group whose cards all hold a `null` `commitKeyPattern` gets no key. Ask about every other group in one message, listing each with its drafts by name: a key, or none. A key fully matches its group's card, or one of a several-slug group's cards; ask again for one that does not. Done when each group holds a matching key, or none.
4. **Commit** the marked drafts, one commit per key (the drafts without one share a commit): write each note at its `target` without its `target`, `action` and `supersedes` lines, moving a note whose `update` changes its `repos` line to its new home by `git mv`, so its history follows it, delete the note a `delete` names, and for a `supersede`, mark the decision it names by FORMAT.md's **When a note stops being true**; stage each path, and in an embedded brain commit by FORMAT.md's **One git**, naming those paths. Write the message by the `commit` skill's format, its first line `<key>: <Title>`, or the title alone without a key. One note takes its own title: `Records <name> for <slug>` (`for <slug>, <slug>` for a note naming several), `Updates <name>`, `Supersedes <old> with <name>` or `Deletes <name>`. Several take the occasion that brought them, such as `Records what 012-checkout taught`, or `Consolidates <n> notes` when they came from several occasions, with one detail bullet per note: its path, and whether it is recorded, updated, superseded or deleted. A deletion's reason goes in the commit's body. Then delete the drafts committed or discarded. Done when `git -C <brain> status --porcelain -- <each committed path>` lists nothing, each key's drafts sit in one commit (none when none is marked), and `.local/drafts/` holds only the drafts kept.
