# Migrate

Bring work from an older layout into the one [FORMAT.md](FORMAT.md) describes. Copy before deleting; each section says how to pick up after a stop.

## A repository's `.sdd/`

Move a repository's old `.sdd/`, from before the brain held the pipeline's work, into the brain. [SETUP.md](SETUP.md) runs this once it has registered the repository as `<slug>`.

1. **List what is there.** Read the repository's `.sdd/`: its `settings.json`, each spec folder under `specs/`, and the files under `research/`, `tours/` and `refactors/`. Show the user the specs, each with its title and whether its `spec.md` has a **Landed** or **Abandoned** line, and ask which to move: all of them by default. Done when the user has picked.

2. **Place each spec.** Keep a spec folder's name when no folder in the brain's `.local/specs/` starts with its number. Otherwise give it the next free number in the brain, keeping its slug, and rename its branches in the repository: `git -C <root> branch -m sdd/<old>/<name> sdd/<new>/<name>` for each branch `git -C <root> branch --list 'sdd/<old>/*'` lists. Done when every picked spec has its folder name in the brain, and no two share a number.

3. **Copy and rewrite.** Copy each picked spec folder to the brain's `.local/specs/<folder>/`, then rewrite its lines by FORMAT.md's **Specs**:
   - `spec.md`: add `**Repos:** <slug>` under its **Key** line; turn a **Base** of `<branch>` into `<slug>@<branch>`; in **Depends on**, rename each spec that step 2 renamed. When it has a **Landed** of `<SHA>`, turn that into `<slug>@<SHA>`, and above it write a **Landings** line holding one entry for all its milestones, in FORMAT.md's form.
   - Its milestones: in the copy, move each milestone folder into `<slug>/`, straight in the spec folder, keeping its name; they are already numbered in order within one repository, so none is renumbered. Give each `milestone.md` a `**Landed:**` line under its **Squash** line, holding the spec's landed SHA when the spec is landed, else `none`.

   Done when every picked spec is in the brain with its lines rewritten and its milestones in their track, and every **Depends on** names a folder that exists.

4. **Copy the reports.** Copy `research/*.md` to the brain's `notes/research/`, `tours/*` and `refactors/*` to `docs/repos/<slug>/`, each name's base followed by `-tour` or `-refactors` and its extension kept, adding a numeric suffix to a name already taken. Done when every file is copied.

5. **Remove the old folder.** Show the user what was copied, then ask whether to delete the repository's `.sdd/`; delete it when they agree, and leave the line in `.git/info/exclude` alone. Done when the user agreed and the folder is gone, or chose to keep it.

## The layout move

Move a brain in an older layout into the clusters layout, by [FORMAT.md](FORMAT.md)'s **Layout**, with `migrate-layout.mjs`. It handles every kind of old layout `scripts/layout.mjs` finds, in one run:

- `one-folder`: a `.brain/` holding the layout from before the clusters, with `notes/authored/`, `notes/exploration/<slug>/`, `repos/<slug>/REPO.md` or a root `specs/`, and this machine's files beside them at its root (`config.json`, `repos/repos.json`, `notes/drafts/`, `explore/`, `locks/`, `handoff/`).
- A standalone brain whose `BRAIN.md` sits at its repository's root, an embedded brain in its host's `brain/` folder, a local brain in its host's `.brain-local/` folder, and a brain without `notes/`, each with this machine's work in an ignored `.brain/` or an older `.sdd/` folder beside it. These take their move into `.brain/` first, which ends in the `one-folder` layout, then the `one-folder` move.

[SYNC.md](SYNC.md) offers it. It is one commit of its own: a run that stopped before the commit picks up at step 5, since the script finds nothing left to move.

1. **Find the folder.** It is the folder holding the old brain's files for a standalone brain, and the host for an embedded or local one; for a `one-folder` brain, the host or the `.brain/` itself. Commit or discard what `git -C <the old brain's git root> status --porcelain` lists for the brain's own files, and when its `locks/` folder holds a claim, ask whether that build still runs, and stop while it does. Done when you hold the folder and the old brain has nothing uncommitted.

2. **Remove the snapshots.** A git worktree loses its link when its folder moves, so each snapshot is removed through its clone and never moved. For each clone in the old brain's `links.json` (a `one-folder` brain's `repos/repos.json`; the host alone, for an embedded or local brain), remove each path `git -C <root> worktree list` prints under the old pipeline folder's `snapshots/` (a `one-folder` brain's `repos/<slug>/snapshots`) by `git -C <root> worktree remove --force <path>`, as EXPORT.md does. Done when no such path is left in any clone's `git worktree list`.

3. **Show the plan.** Run `node <the brain skill's folder>/scripts/migrate-layout.mjs <folder> --dry-run`, which writes nothing. When it prints `Nothing to move`, the brain is already in the clusters layout: stop. Otherwise show the user the plan it prints, and ask whether to run it; stop when they decline. For an older kind the plan is its move into `.brain/`: the same run goes on into the `one-folder` move, whose plan `--dry-run` shows once the first move has run. Done when the user has agreed.

4. **Run it.** Run `node <the brain skill's folder>/scripts/migrate-layout.mjs <folder>`. It moves tracked files with `git mv`, so their history follows them, and ignored ones with a plain move, until the brain is in the clusters layout, and writes `.brain/.gitignore` as the one line `.local/`. Done when it prints `Moved <n> files.` (twice for an older kind: its own move, then the `one-folder` move) and the same command with `--dry-run` prints `Nothing to move`.

5. **Edit the agent file.** For an embedded brain only, the script printed the line to set: replace the **Brain** line SETUP.md's step 9 wrote into the host's agent file (the one naming `brain/`) with it, keeping the file's other references. Done when the host's agent file names `.brain/` in that line and no `brain/` folder.

6. **Retarget the drafts.** The script rewrote the `target` of each draft in `.local/drafts/` by the draft's `action`: a `record` draft's target is the home of its own `repos` line, `notes/repos/<slug>/<name>.md` for one slug, else `notes/shared/<name>.md`; an `update` or `delete` draft's target is the new path of the note it names. A target in an older layout maps straight to its new path: `shared/<name>.md` and `repos/<slug>/<name>.md` of the oldest layout become that home, the second adding `repos: [<slug>]` under the draft's `layer` line. Fix by hand any draft whose `target` still names `notes/authored/`, `notes/exploration/`, `repos/<slug>/` or `shared/`. Done when each draft's `target` names a path of the clusters layout.

7. **Update BRAIN.md's prose.** The script leaves the prose of `BRAIN.md` as it is. Read it, and rewrite each sentence that names an old path, or says what is ignored, to the folders of FORMAT.md's **Layout**. Done when no sentence of `BRAIN.md` names an old path.

8. **Commit.** In the brain's own git (the repository holding it; the brain's own `.brain/` folder for a local brain), stage every path the plan listed, old and new, and `.gitignore`, as `git -C <git root> add -A -- <path>...`, and for an embedded brain the agent file too. Commit as `Moves the brain into the clusters layout`: an embedded brain's commit lands in the host, naming those paths (`git -C <host> commit -m <message> -- <path>...`), and takes the key the `commit` skill's **Find the key** gives; the others take no key. Done when `git -C <git root> status --porcelain` lists none of those paths, `node <the brain skill's folder>/scripts/schema.mjs <brain>` prints `schema: ok`, and, for a local brain, `git -C <host> check-ignore -q .brain` succeeds.

## Tracks

Move one spec from the flat layout into tracks, by FORMAT.md's **Specs**. A milestone moves at whatever **Phase** it is in, its folder, `review.md` and branch together; no sub-agent runs while this does.

When track folders already sit beside flat ones, an earlier run stopped halfway. When the tracks hold more milestone folders than the spec folder holds flat ones, step 4 had begun, after every track was complete: go to step 4. Otherwise delete the track folders and start again at step 1; step 3 skips a branch an earlier run already renamed.

1. **Map the numbers.** Each milestone's track is its **Repo** line. Number each track's milestones `001` upwards in their old order, and its tickets `001` upwards in their old order across those milestones. Take each track's root from the brain's `.local/repos.json`; ask the user, in one message, to run `/brain link` for any repository missing there and `/add-dir <root>` for any not open, and stop until they are. Done when every milestone and ticket has its old number and its new one, and every track's repository is linked and open.

2. **Write the tracks.** For each milestone, create `<slug>/<new NNN>-<milestone-slug>/` straight in the spec folder and copy into it:
   - its `milestone.md`, with its title renumbered (`# Milestone <new NNN>: …`) and its **Repo** line removed;
   - each ticket, as `<new NNN>-<ticket-slug>.md`, with its title and **Milestone** line renumbered and its **Depends on** rewritten in new numbers: `NNN` for a ticket in its own track, `<slug>/NNN` for one in another;
   - its `review.md` and any other file, unchanged.

   When `spec.md` has no **Landings** line and some milestone's **Landed** names a commit, write one under its **Base** line: take the milestones whose **Landed** names a commit, in their old order, and group them into runs of the same track; each run is one entry, in FORMAT.md's form, with the new numbers. Done when every milestone has its copy in its track, every **Depends on** names a ticket that exists in its own track or the track it names, and the **Landings** line, when one was due, names every landed milestone once. `build` then moves the waits on other tracks onto the milestones, by **Builds after** below.

3. **Rename the branches.** In each track's repository, take the milestones whose number changed in increasing order of the old number, so each new name is free at its turn: when `sdd/<spec-folder>/M<old>` exists and `sdd/<spec-folder>/M<new>` does not, run `git -C <root> branch -m sdd/<spec-folder>/M<old> sdd/<spec-folder>/M<new>`; when `M<new>` exists, an earlier run already renamed it, so leave both. Leave the `sdd/<spec-folder>/pr-M*` branches as they are: a PR opened from one keeps its branch's name. Done when every changed milestone that had a branch has one under its new name.

4. **Remove the flat folders.** Delete each flat milestone folder straight in the spec folder. Report the spec's tracks, each milestone with its old and new number, and each `pr-M` branch whose number now names a different milestone, so the user closes or renames it before `/open-pr`. Done when the spec folder holds only track folders beside `spec.md`.

## Builds after

Move a spec's waits on other tracks from its tickets onto its milestones, by FORMAT.md's **Specs**. `sdd state`'s `migrate` lists each milestone holding a ticket whose **Depends on** names another track's ticket, with the **Builds after** it stands for; the build waits the same before and after, so this runs at any **Phase**.

For each entry, write its `buildsAfter` ids into the milestone's **Builds after** line, creating it under **Done when**, above any **Lands after**, then remove every entry that names another track's ticket from its tickets' **Depends on**, leaving "None" where nothing stays. Done when `sdd state` prints no `migrate`.

## Note types

Bring each note RECALL.md's script lists with `--legacy` to FORMAT.md's types and **Layers**. [SYNC.md](SYNC.md) runs this before it consolidates, as drafts, so the user confirms the migration with the other drafts. A listed note that already has its draft in `.local/drafts/` keeps it. An old term note and an old mirror are not migrated here: [ABSORB.md](ABSORB.md)'s **Absorb an old note** turns each into `term` and `decision` drafts.

1. **Draft each note's change.** Write one draft per listed note, by FORMAT.md's **Drafts**:
   - A `gotcha` becomes a `how-to`: an `update` that changes its `type` and keeps its text.
   - A `topic` is deleted: a `delete` whose reason is that links now gather a theme. When its paragraph holds a fact no member states, first fold that fact into the member it bears on, as that member's `update`.
   - A note whose `layer` line repeats its type (the reason "layer line repeats its type") drops it: an `update` that removes the line and keeps the rest of the text, since FORMAT.md's **Layers** works the layer out from the type. A `decision` and a `how-to` keep their line; one listed as "layer missing" takes it, an `update` that adds the `business` or `application` that FORMAT.md's **Layers** gives its reader.

   One note's changes share one draft. Done when each listed note has exactly one draft, and each `update` holds a `type` FORMAT.md names, adds no `layer` line to a type other than a `decision` and a `how-to`, and drops only a `layer` line that repeats its type.
