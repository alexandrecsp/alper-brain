# Setup

The `setup` branch of [`brain`](../SKILL.md): connect this machine to a brain, laid out by [FORMAT.md](FORMAT.md), and register a repository in it so the pipeline can work on it. It is safe to run again: a rerun keeps what is settled. Run it once per brain on each machine, then once per repository.

1. **Find the brain.** When an open folder holds `BRAIN.md`, show its path and brain name, and ask whether to use it or to set up another brain. Otherwise, or for another brain, ask whether to clone the team's brain (ask for its remote URL) or create a new one, and where the local clone goes, recommending `~/brains/<brain name>`.
   - To clone: `git clone <url> <path>`.
   - To create: `git init <path>`, write `BRAIN.md` from the template below, the `CLAUDE.md` below, `.gitignore` holding `.sdd/`, `repos/.gitkeep` and `shared/.gitkeep`, and commit them as `Creates the second brain`. Then offer to add a remote; given its URL, run `git remote add origin <url>`. The first push waits for the user's first sync.

   When the brain's `.gitignore` lacks `.sdd/`, add the line; when the brain lacks `CLAUDE.md`, write it; commit what either changed as one commit, `Prepares the brain for the pipeline`. When the brain is not open, every later step works on it by its path. Done when the path holds `BRAIN.md` and `CLAUDE.md` in a git repository whose `.gitignore` holds `.sdd/`.

2. **Pick the repositories.** Take those the user named, by path or slug; otherwise list the open git repositories other than the brain that it does not register yet, and ask which to register: all of them by default. With none, skip to step 11. Setup writes into each, so each must be open: list those that are not with `/add-dir <path>`, and stop. Run steps 3 to 9 for each picked repository in turn, then step 10 once for them all. Done when you hold every picked root, or there is none.

3. **Register it.** Work out the repository's slug by FORMAT.md and confirm it with the user. When `repos/<slug>/REPO.md` exists and its `remote` names another repository, propose a longer slug from the remote's owner and name (`acme-api`) and confirm it. Write `repos/<slug>/REPO.md` by FORMAT.md: its `slug`, its `remote`, and a one-paragraph summary from its README, checked by [PROSE.md](PROSE.md)'s **Check**; keep any field a card already there holds. Add the slug to the **Repositories** list in `BRAIN.md`, with a one-line summary. Done when the card exists and `BRAIN.md` lists the slug.

4. **Link it.** Write the root into the brain's `.sdd/links.json`, keeping the other entries. Done when the file reads back with the slug's path.

5. **Settle the commit key.** A commit message can start with a **key**, such as `FUNC-1234` or `INC1234`, and the card's `commitKeyPattern` is the regex every key must fully match, or `null` when this repository's commits carry no key. When the card or the repository's old `.sdd/settings.json` already holds one, show it and ask whether to keep it. Otherwise ask the user for an example key, or whether commits go without one; given an example, propose a regex for it (`FUNC-1234` → `FUNC-\d+`), and confirm. Write it into the card. Done when the card holds a pattern that fully matches the user's example, or `null`.

6. **Move its old pipeline state.** Skip this unless the repository holds `.sdd/` at its root, from before the brain held it. Follow [MIGRATE.md](MIGRATE.md)'s **A repository's `.sdd/`**. Done when the user has moved or kept each of its specs.

7. **Settle the layout.** Invoke the `project-structure` skill and record this repository's `docs/STRUCTURE.md` by its RECORDING.md, iterating with the user. Done when the user confirms `docs/STRUCTURE.md`.

8. **Settle the suites.** The card names the repository's two suites, as FORMAT.md's `REPO.md` defines them. When the card already holds `unit` and `e2e`, or the repository's agent file a **Suites** line, show them and ask whether to keep them. Otherwise read the project's scripts and propose one command for each suite, or `none` when the repository has no e2e tests. When one script runs both suites, propose scripts that split them, and add them when the user agrees. Write both into the card. Done when the user confirms both commands, and running each one from the root starts the tests it names.

9. **Point the agent file.** Ask whether the repository's agent instructions live in `AGENTS.md` or `CLAUDE.md`, recommending the one that exists. When the user picks `AGENTS.md` and no `CLAUDE.md` exists, offer a `CLAUDE.md` holding only `@AGENTS.md`: Claude Code reads `CLAUDE.md`, never `AGENTS.md`. Say that the file is committed, so the brain's remote URL becomes visible to whoever can read this repository. Write the section below, replacing any earlier **Spec workflow** section and this brain's line of any **Second brain** section, keeping other brains' lines, and creating the file when needed:

   ```markdown
   ## Second brain

   This repository is registered in the brains below, each holding its specs, the team's notes on it, its suites and its commit key. Work on it from a brain: launch Claude in the brain's folder, with this repository open beside it. Run `/brain setup` once to clone the brain.

   - `<slug>` in the `<brain name>` brain (`<remote URL, or "local only">`)

   - `docs/STRUCTURE.md`: the folder layout and file names. Read it before creating, moving or naming a file.
   - `GLOSSARY.md` and `docs/adr/` (or `GLOSSARY-MAP.md`), when present: the domain's terms and the decisions already made. Name code in the glossary's terms, and work within the ADRs.
   - On an `sdd/<spec-folder>/spec` or `sdd/<spec-folder>/M<NNN>` branch, that spec folder in the brain's `.sdd/specs/`, and its milestone numbered `NNN` in this repository's track (`milestones/<its slug above>/`), hold the work's requirements.
   ```

   Done when the user declines, or the file holds the section once.

10. **Commit the brain.** Commit every picked repository's `repos/<slug>/REPO.md` and `BRAIN.md` as one commit, titled by what changed: `Registers <slug>` for a new card, `Updates <slug>'s card` for a rerun's, joined for several (`Registers api and web`, `Registers api and updates web's card`). Done when `git -C <brain> status --porcelain -- repos/ BRAIN.md` lists nothing, and one commit holds them.

11. **Hand over.** Report the brain's path and name, the slug, and what you created, changed or deleted in which repository, including the repository's files to commit (`docs/STRUCTURE.md` and the agent file). Say that nothing was pushed, since `/brain sync` shares the notes. When the brain is not open, tell the user to launch Claude in its folder from now on. Then name the next steps: `/brain link` to link the brain's other repositories, `/brain explore <slug>` to write what the repository does for teammates who never open its code, `/brain view` to see the brain, and `/brainstorm` a feature, then `/write-spec`. Done when the user has the report.

## CLAUDE.md

```markdown
This folder is a second brain (see BRAIN.md). Before reading or changing a repository's code, invoke the `brain` skill to recall its notes, and read the `AGENTS.md` or `CLAUDE.md` at that repository's root: a session started here never loads it.
```

## BRAIN.md template

```markdown
# Second brain

Our team's notes on our repositories, one fact per file, versioned in git. Notes on one repository live in `repos/<slug>/`, beside its `REPO.md` card, with what its code does in `repos/<slug>/explored/`, and notes spanning several in `shared/`. `timeline.json` records every change to them. They follow [the brain format](https://github.com/alexandrecsp/alper-brain/blob/main/skills/brain/references/FORMAT.md). Each machine keeps its own pipeline work, and the notes it has drafted but not yet shared, in `.sdd/`, which git ignores.

To join, install the plugin (`/plugin marketplace add alexandrecsp/alper-brain`, then `/plugin install alper-brain@alper-brain`), clone this repository, launch Claude in it and run `/brain setup`. `/brain view` shows the notes and the specs. Obsidian can also open this folder as a vault.

You need only this repository, not the code: `/brain explore` keeps notes on what each repository does, and `/brain ask <question>` answers from them, saying how old its answer is.

## Repositories
```
