# Setup

The `setup` branch of [`brain`](../SKILL.md): connect this machine to a brain, laid out by [FORMAT.md](FORMAT.md), and register a repository in it so the pipeline can work on it. It is safe to run again: a rerun keeps what is settled. Run it once per brain on each machine, then once per repository.

1. **Find the brain.** When an open folder holds `.brain/BRAIN.md`, or is a `.brain/` folder holding `BRAIN.md`, show the brain's path and name, and ask whether to use it or to set up another brain. When a folder instead holds an old layout, by [FORMAT.md](FORMAT.md)'s **The open session**, offer the move by [MIGRATE.md](MIGRATE.md)'s **The layout move** and stop until it has run. Otherwise, or for another brain, ask whether to clone the team's brain (ask for its remote URL), create a new one, or, when the primary working directory sits in a git repository, embed one in that repository by FORMAT.md's **Embedded brain**, or keep a local one in it by FORMAT.md's **Local brain**. When the project is that one repository, recommend embedding when the team should share the notes, and local when they stay with this user. To clone or create, ask where the local clone goes, recommending `~/brains/<brain name>`. The brain is the clone's or the host's `.brain/` folder from here on.
   - To clone: `git clone <url> <path>`; a clone that holds an old layout is offered the move by MIGRATE.md, as above.
   - To create: `git init <path>`, write `<path>/.brain/BRAIN.md` from the template below with `kind: standalone`, `<path>/CLAUDE.md` from the one below, `<path>/.brain/.gitignore` from **The `.gitignore`** below, and `<path>/.brain/notes/authored/.gitkeep` and `<path>/.brain/repos/.gitkeep`, and commit them as `Creates the second brain`. Then offer to add a remote; given its URL, run `git remote add origin <url>`. The first push waits for the user's first sync.
   - To embed: the host is what `git -C <primary working directory> rev-parse --show-toplevel` prints, and the brain is `<host>/.brain/`. Write there what creating writes except `CLAUDE.md`, with `kind: embedded` and the template's two paragraphs on joining replaced by **Joining an embedded brain** below, and commit them in the host as `Creates the second brain`, by FORMAT.md's **One git**.
   - To make it local: the host is found the same way, and the brain is `<host>/.brain/`. Add the line `.brain/` to the host's exclude file, the path `git -C <host> rev-parse --git-path info/exclude` prints, unless it holds the line already; then `git init` the brain, write there what creating writes except `CLAUDE.md`, with `kind: local` and the template's two paragraphs on joining replaced by **A local brain** below, and commit them in the brain as `Creates the second brain`. Offer no remote.

   When the brain's `.gitignore` lacks a line of **The `.gitignore`**, add it; when a brain of its own lacks `CLAUDE.md` at its repository's root, write it; when its `BRAIN.md` lacks the `kind` line, add the one its kind gives; commit what any of them changed as one commit, `Prepares the brain for the pipeline`. When the brain is not open, every later step works on it by its path. Done when `.brain/BRAIN.md` holds its `kind` line, `.brain/.gitignore` holds every line below, and `CLAUDE.md` sits at the root of a brain of its own, in a git repository, and, for a local brain, `git -C <host> check-ignore -q .brain` succeeds.

2. **Pick the repositories.** In an embedded or local brain, the host is the one repository: pick it, and when the user names another, say that such a brain covers only its host and that `/brain export` moves it into a repository of its own. For a local brain, steps 7 and 9 write tracked files into the host: ask once whether to run them, recommending yes, and skip both when the user keeps the host untouched. Otherwise, take those the user named, by path or slug; otherwise list the open git repositories other than the brain that it does not register yet, and ask which to register: all of them by default. With none, skip to step 11. Setup writes into each, so each must be open: list those that are not with `/add-dir <path>`, and stop. Run steps 3 to 9 for each picked repository in turn, then step 10 once for them all. Done when you hold every picked root, or there is none.

3. **Register it.** Work out the repository's slug by FORMAT.md and confirm it with the user. When `repos/<slug>/REPO.md` exists and its `remote` names another repository, propose a longer slug from the remote's owner and name (`acme-api`) and confirm it. Write `repos/<slug>/REPO.md` by FORMAT.md: its `slug`, its `remote`, and a one-paragraph summary from its README, checked by [PROSE.md](PROSE.md)'s **Check**; keep any field a card already there holds. Add the slug to the **Repositories** list in `BRAIN.md`, with a one-line summary. Done when the card exists and `BRAIN.md` lists the slug.

4. **Link it.** Write the root into the brain's `repos/repos.json`, keeping the other entries. Done when the file reads back with the slug's path.

5. **Settle the commit key.** A commit message can start with a **key**, such as `FUNC-1234` or `INC1234`, and the card's `commitKeyPattern` is the regex every key must fully match, or `null` when this repository's commits carry no key. When the card or the repository's old `.sdd/settings.json` already holds one, show it and ask whether to keep it. Otherwise ask the user for an example key, or whether commits go without one; given an example, propose a regex for it (`FUNC-1234` → `FUNC-\d+`), and confirm. Write it into the card. Done when the card holds a pattern that fully matches the user's example, or `null`.

6. **Move its old pipeline state.** Skip this unless the repository holds `.sdd/` at its root, from before the brain held it. Follow [MIGRATE.md](MIGRATE.md)'s **A repository's `.sdd/`**. Done when the user has moved or kept each of its specs.

7. **Settle the layout.** Read `code-design`'s [PROJECT-STRUCTURE.md](../../code-design/references/project-structure/PROJECT-STRUCTURE.md) and record this repository's `docs/STRUCTURE.md` by its [RECORDING.md](../../code-design/references/project-structure/RECORDING.md), which offers the layout as-is or the plugin's default, iterating with the user. Done when the user confirms `docs/STRUCTURE.md`.

8. **Settle the suites.** The card names the repository's two suites, as FORMAT.md's `REPO.md` defines them. When the card already holds `unit` and `e2e`, or the repository's agent file a **Suites** line, show them and ask whether to keep them. Otherwise read the project's scripts and propose one command for each suite, or `none` when the repository has no e2e tests. When one script runs both suites, propose scripts that split them, and add them when the user agrees. Write both into the card. Done when the user confirms both commands, and running each one from the root starts the tests it names.

9. **Point the agent file.** The repository's agent file points every session working in it at its layout and its domain, in the repository's own words, and names no brain: the card holds everything the brain needs. The host of an embedded brain is the exception: its agent file also takes the **Brain** line below, since sessions start there. A local brain's host takes no **Brain** line, by FORMAT.md's **No agent file**. Ask whether its agent instructions live in `AGENTS.md` or `CLAUDE.md`, recommending the one that exists. When the user picks `AGENTS.md` and no `CLAUDE.md` exists, offer a `CLAUDE.md` holding only `@AGENTS.md`: Claude Code reads `CLAUDE.md`, never `AGENTS.md`. Delete any **Spec workflow** section; from a **Second brain** section an earlier setup wrote, delete this brain's line and the `sdd/` branch bullet, and its heading and opening paragraph once no brain's line is left. Then add each line below whose file the agent file does not point at yet, under its `# References` heading, creating the heading and the file when needed:

   ```markdown
   # References

   - `docs/STRUCTURE.md`: the folder layout and file names. Read it before creating, moving or naming a file.
   - `GLOSSARY.md` and `docs/adr/` (or `GLOSSARY-MAP.md`), when present: the domain's terms and the decisions already made. Name code in the glossary's terms, and work within the ADRs.
   ```

   The **Brain** line, for the host of an embedded brain only:

   ```markdown
   - `.brain/`: this repository's second brain (see `.brain/BRAIN.md`). Before changing code, invoke the `brain` skill to recall its notes.
   ```

   Done when the user declines, or the file points at both, and names the brain in the **Brain** line alone when it hosts an embedded brain, or nowhere otherwise.

10. **Commit the brain.** Commit every picked repository's `repos/<slug>/REPO.md` and `BRAIN.md` as one commit, titled by what changed: `Registers <slug>` for a new card, `Updates <slug>'s card` for a rerun's, joined for several (`Registers api and web`, `Registers api and updates web's card`). Done when `git -C <brain> status --porcelain -- repos/ BRAIN.md` lists nothing, and one commit holds them.

11. **Hand over.** Report the brain's path and name, the slug, and what you created, changed or deleted in which repository, including the repository's files to commit (`docs/STRUCTURE.md` and the agent file). Say that nothing was pushed, since `/brain sync` shares the notes; for an embedded brain, that its commits sit on the host's current branch and ship with it, and that `/brain export` moves it into a repository of its own once the project grows past one repository; for a local brain, that it is never pushed, that deleting its folder or `git clean -x` in the host loses it, and that `/brain export` moves it into a repository of its own to share it. When the brain is not open, tell the user to launch Claude in the repository holding `.brain/` from now on. Then name the next steps: `/brain link` to link the brain's other repositories (none for an embedded brain), `/brain explore <slug>` to write what the repository does for teammates who never open its code, `/brain view` to see the brain, and `/brainstorm` a feature, then `/write-spec`. Done when the user has the report.

## CLAUDE.md

```markdown
This folder is a second brain (see .brain/BRAIN.md). Before reading or changing a repository's code, invoke the `brain` skill to recall its notes, and read the `AGENTS.md` or `CLAUDE.md` at that repository's root: a session started here never loads it.
```

## The `.gitignore`

`.brain/.gitignore`, in every kind, keeps this machine's files out of git, by FORMAT.md's **Layout**:

```
config.json
notes/drafts/
repos/repos.json
repos/*/snapshots/
specs/
explore/
locks/
handoff/
```

## BRAIN.md template

```markdown
---
kind: standalone
---

# Second brain

Our team's notes on our repositories, one fact per file, versioned in git. Notes live in `notes/authored/`, each naming the repositories it bears on in its `repos` line. Each repository's `REPO.md` card sits in `repos/<slug>/`, with what its code does in `notes/exploration/<slug>/`. They follow [the brain format](https://github.com/alexandrecsp/alper-brain/blob/main/skills/brain/references/FORMAT.md). Each machine keeps its own pipeline work, and the notes it has drafted but not yet shared, in this same folder, which its `.gitignore` keeps out of git.

To join, install the plugin (`/plugin marketplace add alexandrecsp/alper-brain`, then `/plugin install alper-brain@alper-brain`), clone this repository, launch Claude in it and run `/brain setup`. `/brain view` shows the notes and the specs. Obsidian can also open the `.brain/` folder as a vault.

You need only this repository, not the code: `/brain explore` keeps notes on what each repository does, and `/brain ask <question>` answers from them, saying how old its answer is.

## Repositories
```

### Joining an embedded brain

```markdown
This brain lives in the `.brain/` folder of the repository it covers, so its notes travel with the code and reach the team through the repository's pull requests. To join, install the plugin (`/plugin marketplace add alexandrecsp/alper-brain`, then `/plugin install alper-brain@alper-brain`), launch Claude in the repository and run `/brain setup`. `/brain view` shows the notes and the specs. Obsidian can also open the `.brain/` folder as a vault. `/brain export` moves the brain into a repository of its own, once it should cover more repositories.
```

### A local brain

```markdown
This brain lives in the `.brain/` folder of the repository it covers, ignored by that repository's git and never pushed, so it stays on this machine. Launch Claude in the repository to work from it. `/brain view` shows the notes and the specs. `/brain export` moves the brain into a repository of its own, to share it with a team or to cover more repositories.
```
