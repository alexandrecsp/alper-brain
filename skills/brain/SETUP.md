# Setup

The `setup` branch of [`brain`](SKILL.md): connect this machine to a brain, laid out by [FORMAT.md](FORMAT.md), and register a repository in it so the pipeline can work on it. It is safe to run again: a rerun keeps what is settled. Run it once per brain on each machine, then once per repository.

1. **Find the brain.** When an open folder holds `BRAIN.md`, show its path and brain name, and ask whether to use it or to set up another brain. Otherwise, or for another brain, ask whether to clone the team's brain (ask for its remote URL) or create a new one, and where the local clone goes, recommending `~/brains/<brain name>`.
   - To clone: `git clone <url> <path>`.
   - To create: `git init <path>`, write `BRAIN.md` from the template below, `.gitignore` holding `.sdd/`, `repos/.gitkeep` and `shared/.gitkeep`, and commit them as `Creates the second brain`. Then offer to add a remote; given its URL, run `git remote add origin <url>`. The first push waits for the user's first sync.

   When the brain's `.gitignore` lacks `.sdd/`, add the line and commit it as `Ignores local pipeline work`. When the brain is not open, every later step works on it by its path. Done when the path holds `BRAIN.md` in a git repository whose `.gitignore` holds `.sdd/`.

2. **Pick the repository.** Take the repository the user named, by path or slug; otherwise the open git repositories other than the brain that it does not register yet, asking which when there are several. With none, skip to step 11. Setup writes into the repository, so it must be open: when it is not, ask the user to run `/add-dir <path>` and stop. Done when you hold the repository's root, or there is none.

3. **Register it.** Work out the repository's slug by FORMAT.md and confirm it with the user. Write `repos/<slug>/REPO.md` by FORMAT.md: its `slug`, its `remote`, and a one-paragraph summary from its README; keep any field a card already there holds. Add the slug to the **Repositories** list in `BRAIN.md`, with a one-line summary. Done when the card exists and `BRAIN.md` lists the slug.

4. **Link it.** Write the root into the brain's `.sdd/links.json`, keeping the other entries. Done when the file reads back with the slug's path.

5. **Move its old pipeline state.** Skip this unless the repository holds `.sdd/` at its root, from before the brain held it. Follow [MIGRATE.md](MIGRATE.md). Done when the user has moved or kept each of its specs.

6. **Settle the commit key.** A commit message can start with a **key**, such as `FUNC-1234` or `INC1234`, and the card's `commitKeyPattern` is the regex every key must fully match, or `null` when this repository's commits carry no key. When the card or the repository's old `.sdd/settings.json` already holds one, show it and ask whether to keep it. Otherwise ask the user for an example key, or whether commits go without one; given an example, propose a regex for it (`FUNC-1234` → `FUNC-\d+`), and confirm. Write it into the card. Done when the card holds a pattern that fully matches the user's example, or `null`.

7. **Settle the layout.** Invoke the `project-structure` skill, working in this repository. When its `docs/STRUCTURE.md` exists, show its archetype and ask whether to keep it. Otherwise detect the archetype of each app, then propose `docs/STRUCTURE.md`: the layout the code already uses, or, in a repository without code, the archetype's layout; iterate until the user confirms it, then write it. Done when the user confirms `docs/STRUCTURE.md`.

8. **Settle the suites.** The `tdd` skill runs two suites: the **unit suite** (the linter, the typechecker, the unit and integration tests) and the **e2e suite** (the tests that drive a running app: a browser, a device or a deployed service). When the card already holds `unit` and `e2e`, or the repository's agent file a **Suites** line, show them and ask whether to keep them. Otherwise read the project's scripts and propose one command for each suite, or `none` when the repository has no e2e tests. When one script runs both suites, propose scripts that split them, and add them when the user agrees. Write both into the card. Done when the user confirms both commands, and running each one from the root starts the tests it names.

9. **Point the agent file.** Ask whether the repository's agent instructions live in `AGENTS.md` or `CLAUDE.md`, recommending the one that exists. When the user picks `AGENTS.md` and no `CLAUDE.md` exists, offer a `CLAUDE.md` holding only `@AGENTS.md`: Claude Code reads `CLAUDE.md`, never `AGENTS.md`. Say that the file is committed, so the brain's remote URL becomes visible to whoever can read this repository. Write the section below, replacing any earlier **Second brain** or **Spec workflow** section, and creating the file when needed:

   ```markdown
   ## Second brain

   This repository is `<slug>` in the `<brain name>` brain (`<remote URL, or "local only">`), which holds its specs, the team's notes on it, its suites and its commit key. Work on it from the brain: launch Claude in the brain's folder, with this repository open beside it. Run `/brain setup` once to clone the brain.

   - `docs/STRUCTURE.md`: the folder layout and file names. Read it before creating, moving or naming a file.
   - `GLOSSARY.md` and `docs/adr/` (or `GLOSSARY-MAP.md`), when present: the domain's terms and the decisions already made. Name code in the glossary's terms, and work within the ADRs.
   - On an `sdd/<spec-folder>/spec` or `sdd/<spec-folder>/M<NNN>` branch, that spec folder in the brain's `.sdd/specs/`, and its milestone numbered `NNN`, hold the work's requirements.
   ```

   Done when the user declines, or the file holds the section once.

10. **Commit the brain.** Commit `repos/<slug>/REPO.md` and `BRAIN.md` as `Registers <slug>`, or `Updates <slug>'s card` on a rerun. Done when the brain's `git status --porcelain` lists nothing.

11. **Hand over.** Report the brain's path and name, the slug, and what you created, changed or deleted in which repository, including the repository's files to commit (`docs/STRUCTURE.md` and the agent file). Say that nothing was pushed, since `/brain sync` shares the notes. When the brain is not open, tell the user to launch Claude in its folder from now on. Then name the next steps: `/brain link` to link the brain's other repositories, `/brain view` to see the brain, and `/brainstorm` a feature, then `/to-spec`. Done when the user has the report.

## BRAIN.md template

```markdown
# Second brain

Our team's notes on our repositories, one fact per file, versioned in git. Notes on one repository live in `repos/<slug>/`, beside its `REPO.md` card, and notes spanning several in `shared/`. They follow [the brain format](https://github.com/alexandrecsp/alper-brain/blob/main/skills/brain/FORMAT.md). Each machine keeps its own pipeline work in `.sdd/`, which git ignores.

To join, install the plugin (`/plugin marketplace add alexandrecsp/alper-brain`, then `/plugin install alper-brain@alper-brain`), clone this repository, launch Claude in it and run `/brain setup`. `/brain view` shows the notes and the specs. Obsidian can also open this folder as a vault.

## Repositories
```
