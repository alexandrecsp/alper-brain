# Migrate

Move a repository's old `.sdd/`, from before the brain held the pipeline's work, into the brain's `.sdd/`, laid out by [FORMAT.md](FORMAT.md). [SETUP.md](SETUP.md) runs this once it has registered the repository as `<slug>`. Copy first and delete last, so a stop halfway loses nothing.

1. **List what is there.** Read the repository's `.sdd/`: its `settings.json`, each spec folder under `specs/`, and the files under `research/`, `tours/` and `refactors/`. Show the user the specs, each with its title and whether its `spec.md` has a **Landed** or **Abandoned** line, and ask which to move: all of them by default. Done when the user has picked.

2. **Place each spec.** Keep a spec folder's name when no folder in the brain's `.sdd/specs/` starts with its number. Otherwise give it the next free number in the brain, keeping its slug, and rename its branches in the repository: `git -C <root> branch -m sdd/<old>/<name> sdd/<new>/<name>` for each branch `git -C <root> branch --list 'sdd/<old>/*'` lists. Done when every picked spec has its folder name in the brain, and no two share a number.

3. **Copy and rewrite.** Copy each picked spec folder to the brain's `.sdd/specs/<folder>/`, then rewrite its lines by FORMAT.md's **Specs**:
   - `spec.md`: add `**Repos:** <slug>` under its **Key** line; turn a **Base** of `<branch>` into `<slug>@<branch>`, and a **Landed** of `<SHA>` into `<slug>@<SHA>`; in **Depends on**, rename each spec that step 2 renamed.
   - Each `milestone.md`: add `**Repo:** <slug>` under its title. When the spec is landed, add `**Landed:** <SHA>` under its **Squash** line, with the spec's landed SHA.

   Done when every picked spec is in the brain with its lines rewritten, and every **Depends on** names a folder that exists.

4. **Copy the reports.** Copy `research/*.md` to the brain's `.sdd/research/`, `tours/*` to `.sdd/tours/<slug>/` and `refactors/*` to `.sdd/refactors/<slug>/`, adding a numeric suffix to a name already taken. Done when every file is copied.

5. **Remove the old folder.** Show the user what was copied, then ask whether to delete the repository's `.sdd/`; delete it when they agree, and leave the line in `.git/info/exclude` alone. `settings.json`'s `commitKeyPattern` carries into SETUP.md's commit key step. Done when the user agreed and the folder is gone, or chose to keep it.
