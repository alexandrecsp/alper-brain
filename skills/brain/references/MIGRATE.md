# Migrate

Bring work from an older layout into the one [FORMAT.md](FORMAT.md) describes. Copy before deleting; each section says how to pick up after a stop.

## A repository's `.sdd/`

Move a repository's old `.sdd/`, from before the brain held the pipeline's work, into the brain's `.sdd/`. [SETUP.md](SETUP.md) runs this once it has registered the repository as `<slug>`.

1. **List what is there.** Read the repository's `.sdd/`: its `settings.json`, each spec folder under `specs/`, and the files under `research/`, `tours/` and `refactors/`. Show the user the specs, each with its title and whether its `spec.md` has a **Landed** or **Abandoned** line, and ask which to move: all of them by default. Done when the user has picked.

2. **Place each spec.** Keep a spec folder's name when no folder in the brain's `.sdd/specs/` starts with its number. Otherwise give it the next free number in the brain, keeping its slug, and rename its branches in the repository: `git -C <root> branch -m sdd/<old>/<name> sdd/<new>/<name>` for each branch `git -C <root> branch --list 'sdd/<old>/*'` lists. Done when every picked spec has its folder name in the brain, and no two share a number.

3. **Copy and rewrite.** Copy each picked spec folder to the brain's `.sdd/specs/<folder>/`, then rewrite its lines by FORMAT.md's **Specs**:
   - `spec.md`: add `**Repos:** <slug>` under its **Key** line; turn a **Base** of `<branch>` into `<slug>@<branch>`; in **Depends on**, rename each spec that step 2 renamed. When it has a **Landed** of `<SHA>`, turn that into `<slug>@<SHA>`, and above it write a **Landings** line holding one entry for all its milestones, in FORMAT.md's form.
   - Its milestones: in the copy, move each milestone folder into `milestones/<slug>/`, keeping its name; they are already numbered in order within one repository, so none is renumbered. Give each `milestone.md` a `**Landed:**` line under its **Squash** line, holding the spec's landed SHA when the spec is landed, else `none`.

   Done when every picked spec is in the brain with its lines rewritten and its milestones in their track, and every **Depends on** names a folder that exists.

4. **Copy the reports.** Copy `research/*.md` to the brain's `.sdd/research/`, `tours/*` to `.sdd/tours/<slug>/` and `refactors/*` to `.sdd/refactors/<slug>/`, adding a numeric suffix to a name already taken. Done when every file is copied.

5. **Remove the old folder.** Show the user what was copied, then ask whether to delete the repository's `.sdd/`; delete it when they agree, and leave the line in `.git/info/exclude` alone. Done when the user agreed and the folder is gone, or chose to keep it.

## Tracks

Move one spec from the flat layout into tracks, by FORMAT.md's **Specs**. A milestone moves at whatever **Phase** it is in, its folder, `review.md` and branch together; no sub-agent runs while this does.

When track folders already sit beside flat ones, an earlier run stopped halfway. When the tracks hold more milestone folders than `milestones/` holds flat ones, step 4 had begun, after every track was complete: go to step 4. Otherwise delete the track folders and start again at step 1; step 3 skips a branch an earlier run already renamed.

1. **Map the numbers.** Each milestone's track is its **Repo** line. Number each track's milestones `001` upwards in their old order, and its tickets `001` upwards in their old order across those milestones. Take each track's root from the brain's `.sdd/links.json`; ask the user, in one message, to run `/brain link` for any repository missing there and `/add-dir <root>` for any not open, and stop until they are. Done when every milestone and ticket has its old number and its new one, and every track's repository is linked and open.

2. **Write the tracks.** For each milestone, create `milestones/<slug>/<new NNN>-<milestone-slug>/` and copy into it:
   - its `milestone.md`, with its title renumbered (`# Milestone <new NNN>: …`) and its **Repo** line removed;
   - each ticket, as `<new NNN>-<ticket-slug>.md`, with its title and **Milestone** line renumbered and its **Depends on** rewritten in new numbers: `NNN` for a ticket in its own track, `<slug>/NNN` for one in another;
   - its `review.md` and any other file, unchanged.

   When `spec.md` has no **Landings** line and some milestone's **Landed** names a commit, write one under its **Base** line: take the milestones whose **Landed** names a commit, in their old order, and group them into runs of the same track; each run is one entry, in FORMAT.md's form, with the new numbers. Done when every milestone has its copy in its track, every **Depends on** names a ticket that exists in its own track or the track it names, and the **Landings** line, when one was due, names every landed milestone once. `build` then moves the waits on other tracks onto the milestones, by **Builds after** below.

3. **Rename the branches.** In each track's repository, take the milestones whose number changed in increasing order of the old number, so each new name is free at its turn: when `sdd/<spec-folder>/M<old>` exists and `sdd/<spec-folder>/M<new>` does not, run `git -C <root> branch -m sdd/<spec-folder>/M<old> sdd/<spec-folder>/M<new>`; when `M<new>` exists, an earlier run already renamed it, so leave both. Leave the `sdd/<spec-folder>/pr-M*` branches as they are: a PR opened from one keeps its branch's name. Done when every changed milestone that had a branch has one under its new name.

4. **Remove the flat folders.** Delete each milestone folder straight under `milestones/`. Report the spec's tracks, each milestone with its old and new number, and each `pr-M` branch whose number now names a different milestone, so the user closes or renames it before `/open-pr`. Done when `milestones/` holds only track folders.

## Builds after

Move a spec's waits on other tracks from its tickets onto its milestones, by FORMAT.md's **Specs**. `sdd state`'s `migrate` lists each milestone holding a ticket whose **Depends on** names another track's ticket, with the **Builds after** it stands for; the build waits the same before and after, so this runs at any **Phase**.

For each entry, write its `buildsAfter` ids into the milestone's **Builds after** line, creating it under **Done when**, above any **Lands after**, then remove every entry that names another track's ticket from its tickets' **Depends on**, leaving "None" where nothing stays. Done when `sdd state` prints no `migrate`.

## Explored notes

Move a repository's explored notes from beside its authored ones into `repos/<slug>/explored/`, by FORMAT.md's **Layout**. [EXPLORE.md](EXPLORE.md)'s **Commit** runs this for each repository it explores, inside its own commit; a run that stopped halfway picks up by running it again, since a moved note is no longer outside.

1. **Find them.** List each note straight under `repos/<slug>/`, other than `REPO.md`, whose frontmatter has an `explored` line. Done when every such note is listed.
2. **Move them.** Create `repos/<slug>/explored/` when it is missing, then run `git -C <brain> mv repos/<slug>/<name>.md repos/<slug>/explored/<name>.md` for each. Links resolve by name, so no note changes. Done when no note straight under `repos/<slug>/` has an `explored` line.

## Note types

Bring each note RECALL.md's script lists with `--legacy` to FORMAT.md's types and **Layers**. **Sync** in [SKILL.md](../SKILL.md) runs this before it consolidates, as drafts, so the user confirms the migration with the other drafts. A listed note that already has its draft in `.sdd/drafts/` keeps it.

1. **Draft each note's change.** Write one draft per listed note, by FORMAT.md's **Drafts**:
   - A `gotcha` becomes a `how-to`: an `update` that changes its `type` and keeps its text.
   - A `topic` is deleted: a `delete` whose reason is that links now gather a theme. When its paragraph holds a fact no member states, first fold that fact into the member it bears on, as that member's `update`.
   - A note with no `layer` takes one: an `update` that adds it, by FORMAT.md's **Layers**. Every explored note takes `business`, and a `contract` takes `application`.

   One note's changes share one draft. Done when each listed note has exactly one draft, and each `update` holds a `type` and a `layer` FORMAT.md names.
