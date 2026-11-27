# Changelog

Each release lists what changed for a user of the plugin. **Migrates by itself** means the next command on an old brain or spec moves it to the new form; you do nothing.

## Unreleased

### Changed

- **A brain is three shared clusters and one local folder.** `repos/` holds one card per repository, `repos/<slug>.md`. `notes/` holds `notes/repos/<slug>/` for one repository, `notes/shared/` for notes across repositories, and `notes/research/`. `docs/` holds tours, refactor reports, pages and prototypes: `docs/repos/<slug>/<YYYY-MM-DD-HHmm>-<kind>.html`, `docs/shared/` and `docs/prototypes/`. Everything this machine keeps to itself sits in `.local/`, specs, drafts and settings included, and the `.gitignore` is the one line `.local/`. A spec's tracks sit straight in its folder, with no `milestones/` level. A note recorded about one repository lands in that repository's folder. Every skill, the server, the brain page, the pane and the evals read the new layout. **Migrates with your say-so**: the first skill that finds an older brain offers the layout move and stops until it has run; the move keeps your drafts, specs and the page's Activity history.
- **Add brain opens a folder dialog.** On the brain page, **Add brain** opens your system's own folder picker (Explorer on Windows, Finder on macOS, zenity or kdialog on Linux) instead of asking you to paste the path; a folder with no `BRAIN.md` is refused. Only a Linux machine with neither dialog still asks for the path.
- **`code-design` is one skill for the shape of code.** `codebase-design`, `design-patterns` and `project-structure` are merged into it: one description triggers on all three, the agent reads only the reference its work reaches (`MODULE-DESIGN.md`, `DESIGN-PATTERNS.md`, `PROJECT-STRUCTURE.md`), and the three share one vocabulary.
- **`/brainstorm` fits any topic.** It infers the kind (a feature, a skill or agent, a decision, an open exploration) and closes with that kind's summary and next step; only a feature leads to `/write-spec`. `--docs` is gone: it adds its domain lens whenever it settles a repository's domain.
- **The brain is the home of a repository's terms and decisions.** `model-domain` is gone: its interviewing (challenging terms, sharpening them, probing scenarios) is `brainstorm`'s domain lens, and where things are written is the brain's `DOMAIN-DOCS.md`. A settled term becomes a `concept` note, with the words to avoid for it on a new `avoid` line, and a decision a `decision` note, both through `/brain sync`. No repository gains a `GLOSSARY.md` or `docs/adr/` it did not have; one that already keeps them gets its new entries there, and `/brain explore` mirrors them into explored notes, so recall finds every term and decision in one place, and a repository that is only registered has them too. Run `/brain explore <slug>` once for each repository that keeps a glossary or ADRs, to write its mirrors.
- **`agent-writing` is now `write-for-agents`.**
- **`/onboard` is now `/brain tour`.** The tour picks the repository's default branch like `/brain explore`, offers an explore first when the notes are behind, and starts from the explored notes, so its explorers spend their reads on how the code is built. Tours go to `docs/repos/<slug>/<YYYY-MM-DD-HHmm>-tour.html`.
- **One explorer agent.** `scout` is merged into `explorer`: every fact-finding, tour and refactor dispatch now goes to `alper-brain:explorer`, on Sonnet.
- **`reviewer` is now `standards-reviewer`**, beside `spec-reviewer`.
- **Design it twice reaches you.** `brainstorm`'s How phase, `refactor` and `code-design` now run DESIGN-IT-TWICE (the `architect` agents) when an interface's shape is unsettled or it is a contract other repositories consume.
- **Sub-agents respect the parallel cap** (`parallelAgents`) everywhere, in waves.
- **Your questions reach you.** A sub-agent's **Needs the user** items are kept in the tickets' Notes during a build and listed in every hand-over.
- **`build`** writes each closing step's **Phase** before it acts, verifies every fixer's commits, and releases its claims on every way out.
- **`commit`**: the key and title together fit in 72 characters, as `sdd squash` checks; an embedded brain's commit leaves the host's staged work alone.
- **The brain's Record and Sync** moved to their own reference files, so other skills load only what they use.

## 2.2.0

### New

- **Local brain.** A brain for one repository that stays on your machine: `/brain setup`, run inside the repository, offers it beside embedding. It lives in the repository's `.brain/` folder, ignored through `.git/info/exclude` so the repository's tracked files never change, and commits in its own git, never pushed. Every skill works in it. A skill that finds no brain now offers to create one there instead of only stopping. `/brain export` moves it into a repository of its own to share it.
- **Branches on a spec's page.** The brain page shows, for each repository a spec touches, its branches and a commit graph, updated live as you commit, check out or create a branch, two repositories to a page. **Simple** shows the spec's branches and its base since the spec forked, and flags any other branch running beside it; **Explore** shows every branch's history over the last 7, 15, 30 or 60 days. Grant each clone once with **Grant access**; every spec that touches it reuses the grant.

### Changed

- **The brain page's server is always up.** Agent Watcher starts it with every Claude Code session, adding the session's brain to its list, and it no longer stops after 30 idle minutes. Open the page any time at `http://127.0.0.1:9999/`; `/brain view` still opens it for you. To use another port, set it in `~/.alper-brain/config.json` as `{ "port": 51000 }`; the file is yours alone, outside every repository. The next start moves the server there and stops the one on the old port. A newer plugin version replaces a running older server.
- **Every brain lives in one `.brain/` folder**, marked by its `.brain/BRAIN.md`, whose `kind` line says standalone, embedded or local. The notes sit in `notes/`, each repository's card, tours and refactor reports in `repos/<slug>/`, prototypes in `prototypes/` and research in `research/`, all committed and shared. Drafts, clone paths (`repos/repos.json`), snapshots, specs, locks and settings stay on your machine, kept out of git by `.brain/.gitignore`. The move comes through `/brain sync`, and any skill that finds an old layout offers it once and stops until you agree and the move has run.
- **`timeline.json` is gone.** The brain page's Activity shows each note's history from git, through the brain server, so a sync makes no timeline commit and no conflict. From a file, without the server, Activity says to start it.
- **A squash deletes its milestone's branch.** When `/build` squashes a milestone into the spec's branch, it deletes `sdd/<spec>/M<NNN>` in the same step, so a running build leaves only the spec's branch and the one milestone in progress. Each ticket's **Commit** line is marked `(squashed into M<NNN>)`, since its commit is on no branch any more. A blocked or failed milestone keeps its branch.
- **Fewer milestones.** `/write-tickets` groups a track's work into as few milestones as its waits allow. It draws a boundary only at a **Builds after** or **Lands after** wait, past 8 tickets, or where a milestone's later work waits on another track's milestone that is not that track's first. Tickets stay the same size, so each milestone still leaves the code working. There are fewer reviews and squashes per spec.
- **Explore and ask read your clone in place.** When the repository is open, its tree is clean and the branch to read is the one checked out, `/brain explore` and `/brain ask` read the clone itself instead of checking out a snapshot. They claim it while they read, so a build waits, and they check afterwards that the branch did not move. A snapshot is still taken for a clone that is not open, or for a branch you do not have checked out.
- **Agent Watcher replaces the workshop.** The pane now shows the session's tokens: how full the context window is, the share per area, tokens per minute, and what each agent is doing. Open it with `/watcher`; `/watcher <theme>` picks one of six looks. With a brain open it adds a strip of the brain's counts and a **Building** card, a row per track of each spec in flight, red where a track waits on you. The build's status line is gone.

## 2.1.0

### New

- **Embedded brain.** A project that is one repository keeps its brain in that repository's `brain/` folder: `/brain setup`, run inside the repository, offers it. Notes are committed on your current branch and ship with the code. `/brain export` moves the brain, history included, into a repository of its own.
- **Release branches.** `/build` offers the default branch or the most recent `rlse/vX.Y.Z` as a spec's base, and from a release branch the next version, which it raises in the version files.
- **The workshop.** The build pane is now a live star chart of the session: the core, a star per station, and each agent as light. Open it with `/workshop`.
- **Follow the merge.** `/open-pr <spec-id> --merged` records that a spec's PRs merged: it brings each local base level with `origin` (after a squash or rebase merge too, once you agree) and writes the spec's **Merged** line. `/brain status` lists landed specs still waiting for their merge.
- **Repository claims.** A `/build` claims each repository it changes in `.brain/locks/`. A build of another spec in the same repository stops and asks you whether the first one still runs. `/brain status` shows each claim.
- **Amend a spec.** `/write-tickets <spec-id> --amend` changes a spec that is already ticketed or building. It keeps the work already built and re-cuts only the open tickets and milestones.
- **Options for blocked work.** When a track stops, `/build` lists what you can do. For example, you can build a blocked ticket by hand and tell `/build <spec-id> — <ticket> done at <SHA>`.
- **Abandon a spec.** `/build <spec-id> --abandon <reason>` marks the spec, deletes its branches and lists the work that already landed.
- **Answer PR comments.** `/open-pr <spec-id> --comments` gathers the review comments on a spec's open PRs. You mark each one fix, reply or skip. A fixer commits the fixes on the PR's branch, and once you agree, the PR gets the push and one reply.
- **Port a release fix.** When a spec lands on a release branch, `/build` offers to port its milestones to the default branch on `sdd/<spec>/port`, and `/open-pr` opens that PR too.
- **Free checks.** `node scripts/check.mjs` runs every check that needs no model; `.github/workflows/checks.yml` runs it on every push.

### Changed

- **Notes live in one `notes/` folder**, each authored note scoped by its `repos` line. Migrates by itself, at your next `/brain sync`, once you agree.
- **The brain's local folder is `.brain/`**, not `.sdd/`. Migrates by itself.
- **Milestones wait on other tracks through a Builds after line**, not a ticket's Depends on. Migrates by itself, at the next `/build` on the spec.
- **A spec waits for its dependencies to merge**, not only to land, in every repository that has a remote. A dependency that landed before 2.1.0 needs `/open-pr <its id> --merged` once.
- **Builders run on Sonnet**, not Haiku.
- When `/brain setup` records `docs/STRUCTURE.md`, it asks per app: record the layout as-is, or the plugin's default layout, with the moves it needs as refactor candidates. It also offers to keep a section that already exists.
- `/brain explore` asks whether to read the default branch or the branch you have checked out, when they differ.
- `/brain explore` gives each monorepo package its own area, and a rerun reads only the changed files.
- The brain page answers escalations, abandons specs and drafts notes.
- Evals grade what the agent does, not what git saves, so a read-only sandbox no longer lowers their scores. New cases cover abandoning a spec, a ticket built by hand, and amending a spec. The brain's scripts have tests.

### Fixed

- `sdd dispatch` works in a read-only sandbox: the brief holds the whole Context block.

## 2.0.0

- Every command is named for its action: `/to-spec` is `/write-spec`, `/to-tickets` is `/write-tickets`, `/pr` is `/open-pr`, `/improve-and-refactor` is `/refactor`, and `/brainstorm-with-docs` is `/brainstorm --docs`.
- The skills other skills run, and the reference skills, leave the slash menu.
