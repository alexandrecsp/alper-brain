# Brain format

The shape of the second brain: the team's notes on every repository, shared, and this machine's pipeline work across them, kept local.

## Layout

```
<repo or host>/.brain/                    ← the brain's root: every brain, of every kind, lives in a `.brain/` folder
├── BRAIN.md                              ← what the brain is, how to join, the repositories it covers; its `kind` line names its kind
├── .gitignore                            ← the one line `.local/`, in every kind
├── repos/<slug>.md                       ← the repository's card, by **Repositories**; nothing else sits in `repos/`
├── notes/                                ← what the agent knows
│   ├── repos/<slug>/<name>.md            ← the authored notes whose `repos` line names the one repository `<slug>`, and its explored notes
│   ├── shared/<name>.md                  ← the authored notes whose `repos` line names several repositories, or none
│   ├── domain/<name>.md                  ← the `term` notes: the canonical terms of the business, whatever their `repos`
│   └── research/<slug>.md                ← cited findings from `research`, with `<slug>/<group>.md` beside it when it fans out; never read as notes
├── docs/                                 ← what people read
│   ├── repos/<slug>/<YYYY-MM-DD-HHmm>-<kind>.html   ← one repository's tour (`tour`), refactor reports (`refactors`), or a page from `html` on it (its topic)
│   ├── shared/<YYYY-MM-DD-HHmm>-<topic>.html        ← pages from `html` on no single repository
│   └── prototypes/<slug>.html            ← logic prototypes from `prototype`, one home even for a prototype across repositories
└── .local/                               ← this machine's own: nothing in it is shared
    ├── config.json                       ← this machine's limits on the pipeline, by **Settings**
    ├── repos.json                        ← each linked slug's clone path on this machine, by **Repositories**
    ├── drafts/<name>.md                  ← notes waiting for `sync` to consolidate them, by **Drafts**
    ├── specs/NNN-<slug>/…                ← work planned or in flight, in one repository or several, by **Specs**
    │   ├── spec.md
    │   └── <repo-slug>/NNN-<milestone-slug>/   ← one track per repository the spec changes
    │       ├── milestone.md
    │       ├── NNN-<ticket-slug>.md
    │       └── review.md
    ├── snapshots/<slug>/                 ← the repository's default branch, checked out while a skill reads it
    ├── explore/<slug>/<area>/            ← the scratch folders `explore`'s scribes write into, only while it runs
    ├── locks/                            ← a repository's claim by `<slug>.json`, while a skill reads it or a build changes it
    └── handoff/                          ← what a session leaves for the next one on this machine
```

The `.gitignore` is `.brain/.gitignore` in every kind, the one line `.local/`, written by [SETUP.md](SETUP.md) and by the layout move: a file is shared unless it sits in `.local/`. The team shares the rest: the cards, the notes, research and the docs. Only this machine keeps `.local/`: what it learns reaches the team only as notes. A local brain's host also ignores the whole `.brain/`, by **Local brain**.

`BRAIN.md` holds a `kind` frontmatter line, `standalone`, `embedded` or `local`, so no skill works the kind out; `scripts/schema.mjs` checks it against the git test of **Embedded brain** and **Local brain**. A `standalone` brain is `<repo>/.brain/`, its agent file at the repository's root. The Obsidian vault opens at `.brain/` itself, since Obsidian skips hidden folders, `.local/` with them.

Older brains had other layouts, which [MIGRATE.md](MIGRATE.md)'s **The layout move** lists.

## The open session

The user works from the brain: it is one of the session's **working directories** (the primary one and the additional ones, as the environment lists them), so nothing records where it is. A folder is **open** when a working directory is that folder or holds it.

A machine can hold several brains. Each one is a separate **knowledge base**, with its own notes, remote and `.brain/`: whatever the user keeps apart, such as a company, a client or a field. Brains are **isolated**: a run reads and writes one brain only, and never carries a note, spec or path from one brain into another. A **brain name** is the last segment of the brain's `git remote get-url origin` without `.git`, else the name of the folder holding `.brain/` (a brain's own folder is always named `.brain`, so its name never is), in kebab-case.

When a skill finds an old layout, one of those MIGRATE.md's **The layout move** lists, it offers the move by it and stops until the move has run. It reads and writes nothing of the old layout. `scripts/layout.mjs` finds the brain and detects each old layout.

The **active brain** is an open folder's `.brain/` holding `BRAIN.md`, or an open folder that is that `.brain/`. When several are open, it is the one the user names in this conversation (such as `@side-projects` in a command's arguments), or else the one holding the primary working directory, or embedded in or local to the repository holding it; failing both, ask the user once per conversation. When none is open and no old layout is found, the session has no brain: a skill stops and tells the user to launch Claude in the folder holding the brain or run `/add-dir <folder>`, or to run `/brain setup` when they have no brain yet; only `commit`, `tdd` and `diagnose` run instead, by **With no brain open** in **The working repository**. Before stopping, when the primary working directory sits in a git repository, the skill offers to create a local brain there; given a yes, it runs the `brain` skill's `setup` with the local choice, then goes on in the brain it created.

## Embedded brain

An **embedded brain** lives in the `.brain/` folder of the one repository it covers, its **host**: a project that is a single repository keeps its notes beside its code, with no second clone. Its `BRAIN.md` says `kind: embedded`, and it is embedded when `git -C <brain> rev-parse --show-toplevel` prints a folder other than the brain's own, and that folder is its host. Its layout is the one above, under `<host>/.brain/`, its own `.gitignore` inside it. The rest of this reference holds for it, except:

- **Open with its host.** The user launches Claude in the host, so the brain is open whenever the host is.
- **One repository.** The brain registers its host and no other repository, so the host is always the working repository: linked by `.local/repos.json` like any repository, and always open. To cover a second repository, move the brain into a repository of its own first, by [EXPORT.md](EXPORT.md).
- **One git.** The brain's commits are the host's, made on whatever branch the host has checked out, so its notes reach the team with the code, through the host's pull requests. Each commit names its paths (`git -C <host> commit -m <message> -- <path>...`), so the host's staged work stays staged, and takes the key [SYNC.md](SYNC.md)'s **Find the keys** settles. [SYNC.md](SYNC.md) neither pulls nor pushes.
- **The agent file.** A session started in the host loads the host's agent file, so that file points at the brain, by [SETUP.md](SETUP.md)'s step 9, and the brain holds no `CLAUDE.md` of its own.

## Local brain

A **local brain** lives in the `.brain/` folder of the one repository it covers, its **host**, and never leaves this machine: one person's brain for one repository, with every skill working and nothing in the host's history. Its `BRAIN.md` says `kind: local`. It is a git repository of its own inside the host's working tree, so `git -C <brain> rev-parse --show-toplevel` prints the `.brain/` folder itself and it is not embedded: that git test tells it from an embedded brain, whose `.brain/` the host's git owns. The host's git ignores the whole `.brain/` through the exclude file `git -C <host> rev-parse --git-path info/exclude` prints, so no tracked file of the host holds its notes. Its layout is the one above, under `<host>/.brain/`, its own `.gitignore` inside it. The rest of this reference holds for it, except:

- **Open with its host**, and **One repository**, as for an embedded brain.
- **Its own git, local only.** The brain commits in its own repository and has no remote, so [SYNC.md](SYNC.md) neither pulls nor pushes. To share it, move it into a repository of its own by [EXPORT.md](EXPORT.md)'s **Local brain**.
- **Its agent file line.** The host's agent file names the brain by [SETUP.md](SETUP.md)'s step 9 as on this machine only, with no **Brain** line. The active-brain rule finds the brain. The brain holds no `CLAUDE.md`.
- **Lost with its folder.** No remote holds a copy, and `git clean -x` in the host deletes ignored folders with the rest.

## Repositories

A **repo slug** names a repository the same way on every teammate's machine, whatever folder each clone sits in. A clone's slug is the `slug` of the card it matches, by the matching rule below; for a clone no card matches yet, it is the last segment of `git remote get-url origin` without `.git`, else the root folder's name. It is kebab-case, and unique within its brain. A repository registered in two brains has two separate sets of notes, one in each.

A repository moves through three states, each building on the one before:

| State | Holds when | Enough for |
|---|---|---|
| **registered** | the brain holds `repos/<slug>.md` | its notes, and specs that name it |
| **linked** | the brain's `.local/repos.json` names this machine's clone of it | reading its code, by that path |
| **open** | that clone is open in this session | changing its code: building, fixing, committing |

`.local/repos.json` maps each linked slug to the clone's absolute path, with forward slashes: `{ "billing-api": "C:/work/acme/billing-api" }`. A clone matches a card when its `git remote get-url origin` names the same repository as the card's `remote` (ignoring a trailing `.git`, and whether it is written as SSH or HTTPS), or, for a `local only` repository, when its folder's name is the slug. `/brain setup` registers a repository, and `/brain link` links the registered ones.

Read a linked repository that is not open by its path, even though the user may be asked to allow each read. Before changing one, ask the user to run `/add-dir <path>`, and stop until it is open: running the same command again picks up from there.

A **snapshot** reads a linked repository's default branch, or its clone's current branch when a skill asks for it, without touching its clone's working tree, and inside the brain, so no read asks for permission: `git -C <root> fetch --quiet origin` (then `git -C <root> remote set-head origin --auto` when `origin/HEAD` is missing); when an earlier run left a snapshot, `git -C <root> worktree remove --force <brain>/.local/snapshots/<slug>`; then `git -C <root> worktree add --detach <brain>/.local/snapshots/<slug> <commit>`, the commit being `origin/HEAD` for the default branch, and the clone's `HEAD` for its current branch or a `local only` repository. Either way it holds committed work only. It writes only to the clone's `.git`, so the repository need only be linked. Remove it with `git -C <root> worktree remove --force <snapshot>` once its reads are done.

A skill reads a repository's committed code from its **source**: the clone itself, read **in place**, or a snapshot. Read in place when the clone is open, the branch to read is the one it has checked out, `git -C <root> status --porcelain` lists nothing, and no `.local/locks/<slug>.json` exists; otherwise take a snapshot. Reading in place copies nothing, so it suits an embedded or local brain best, whose host is always open. Its rules:

- **Claim it first.** Write `.local/locks/<slug>.json` as `{"spec": "<skill>", "since": "<now, in ISO 8601>"}`, `<skill>` being the reading branch (`explore`, `ask` or `tour`), so a build reaching the repository stops at its `held:` line by build's **Locks** instead of checking out a branch under the reads. Tell the user to leave the clone's branch and files as they are until the skill says it is done.
- **Check it after.** Once the reads are done, `git -C <root> rev-parse HEAD` must still print the commit they started at, and the tree must still be clean. When either fails, the reads may mix two states: say so, and offer to run the skill again.
- **Release it.** Delete the lock file once the check is done, and on every stop before it.

`repos/<slug>.md` is the repository's card:

```markdown
---
slug: billing-api
remote: git@github.com:acme/billing-api.git
commitKeyPattern: "FUNC-\\d+"
unit: npm run test:unit
e2e: npm run test:e2e
explored: a1b2c3d
---

Charges customers and emits the invoice events the web app and the ledger consume.
```

- `remote`: the URL `git remote get-url origin` prints, or `local only`.
- `commitKeyPattern`: the regex every commit key must fully match, or `null` when this repository's commits carry no key.
- `unit` and `e2e`: the commands of its two suites, run from its root. The **e2e suite** is the tests that drive a running app: a browser, a device or a deployed service; `none` when the repository has none. The **unit suite** is everything else: the linter, the typechecker, and the unit and integration tests. The **full suite** is both.
- `explored`: the short SHA the last `/brain explore` read, absent until the first one.
- The body: one paragraph on what the repository does, from its README. Once explored, the overview instead: what the repository does and for whom, then each of its `feature` notes as a `[[link]]`.

## The working repository

A skill that reads or changes code first names its **working repository**, and its **root**, the clone's path.

- **With no brain open**, only `commit`, `tdd` and `diagnose` run; every other skill stops, by **The open session**. The working repository is the one holding the primary working directory, and its root is what `git -C <primary working directory> rev-parse --show-toplevel` prints; when that fails, ask the user to launch Claude inside the repository, and stop. It has no card, notes or specs: take the suites from the project's scripts, read only the code and `docs/STRUCTURE.md` (a skill that finds the task touching the domain tells the user to open the brain), and skip every step that recalls from or records to the brain or reads its `.brain/`. Another repository is read only by a path the user gives. The numbered rules below are for a brain; the bullets after them hold in both cases.

In an embedded or local brain, it is the host, by **Embedded brain** and **Local brain**. With any other brain open, the session's primary folder is the brain, so the working repository is the one the first of these rules gives:

1. The repository whose track holds the milestone the work builds, by **Specs**.
2. The repository the user names, by slug or by a path inside its clone.
3. The repository whose clone holds the files the conversation is working on.
4. The only repository open in this session besides the brain.

Otherwise ask the user, listing the registered repositories. Its root comes from `.local/repos.json` or the open folder; when it has neither, ask the user to run `/brain link`, or `/add-dir <path>`, and stop. Then:

- Paths a skill gives relative to a repository (`docs/STRUCTURE.md`, `AGENTS.md`, `CLAUDE.md`) are relative to its root. Read and write its files by absolute path.
- Run every git command as `git -C <root>`, and every suite or script from the root (`cd <root> && <command>`).
- Its agent file is not loaded into a session started in the brain: read it when a skill names it.
- Sub-agents have no user: brief each one by [BRIEF.md](BRIEF.md).

## Notes

One fact per file. Teammates adding notes at the same time never conflict, and the graph shows one node per fact. A note is one of two kinds, told by its `explored` line and never by its folder:

- **Authored**: what a repository cannot tell by looking, such as the reason behind a choice, a trap, or a contract between two repositories. It lives in its **home**: `notes/domain/` for a `term`, else `notes/repos/<slug>/` when its `repos` line names one repository, else `notes/shared/`. Its `repos` line names the repositories it bears on. [RECORD.md](RECORD.md) writes it as a draft, and [SYNC.md](SYNC.md)'s **Consolidate** there commits it once the user confirms it.
- **Explored**: what the code does, written for an outsider who never opens it. It lives in `notes/repos/<slug>/`, its repository's folder, beside that repository's authored notes. Only `/brain explore` writes it, by [EXPLORE.md](EXPLORE.md), and its next run rewrites it. Its `explored` line marks it.

```markdown
---
name: billing-retry-idempotency
description: Billing retries reuse the charge's idempotency key, so a retried charge never bills twice
type: how-to
layer: application
repos: [billing-api]
---

A retried charge sends the first attempt's idempotency key, and the provider answers with the first attempt's result.

**Why:** the provider double-billed during the March outage, when retries carried fresh keys.
**How to apply:** pass the stored key to every retry path, including manual replays from the admin console.

Related: [[invoice-event-contract]]
```

- `name`: the file name without `.md`, in kebab-case, unique across the **whole brain** and not only its folder, since `[[name]]` resolves by it here and in Obsidian. A note naming one repository starts with its slug, as `billing-api-retry-idempotency`, so a folder listing groups it with its repository; the brain page's graph drops the prefix from the label, since the colour already shows the repository. A note naming several takes no prefix, and neither does a `term`, which is named for the business: `customer`, `ledger-account`. A new note a link already names keeps that name. `scripts/schema.mjs` warns about a name without its prefix, a `term` excepted, and does not fail on it, since a note's name changes only with every link to it.
- `description`: one line that stands alone. Recall judges relevance from it without opening the note.
- `type`: one of the types below.
- `layer`: `business` or `application`, worked out from the note's type and its `explored` line by **Layers**. Which types store the line is in **Layers**, and `scripts/schema.mjs` warns of a stored line that differs from the worked-out one.
- `repos`: on authored notes only, required, the registered slugs the note bears on, as `[billing-api]` or `[billing-api, web-app]`: one when the fact is about one repository, each one it holds for when it spans several. Recall finds a note for a repository by this line, so add a slug when another repository comes to rely on the fact. The note's folder follows the line, so a change to it moves the note, by [SYNC.md](SYNC.md)'s **Consolidate**. An explored note belongs to the repository whose folder holds it. A `term`'s line lists each repository its pairings name, once, and no other.
- `explored`: on explored notes only, the short SHA of the commit the note was read at.
- `aliases`: optional, 3 to 6 other words for the note's subject that its name and description leave out: business wording, the symptom a user reports, and the code's English terms. Recall ranks them like the description, so a search in other words still reaches the note. Write one `  - <alias>` line each under `aliases:`, as Obsidian does, or `[a, b]`.
- `avoid`: on a `term` note only, optional, the words the domain avoids for the term, in the same list forms as `aliases`. A word on it is challenged wherever it names the term, and recall ranks it like the description. A pairing carries its own avoided words in its line. An `avoid` line on a `concept` is a legacy form: `scripts/schema.mjs` warns of it, and sync absorbs the note into a term.
- `status` and `supersededBy`: on a superseded `decision` only, `status: superseded` and the name of the decision that replaced it, by **When a note stops being true**.

| type | holds |
|---|---|
| `feature` | something a user, an operator or another system can do through the repository: who does it, what happens, and its rules. Explored only; always `business` |
| `term` | one canonical term of the business, named once above every repository, with each repository's word for it, by **The term note**. Authored only, always `business`, always in `notes/domain/` |
| `concept` | how a part of the system works. An authored one is always `application`: an authored `business` `concept` is the old form of a `term`, which `scripts/schema.mjs` warns of. An explored one is `business`, like every explored note |
| `decision` | a choice and its reason: a product choice (`business`) or a technical one (`application`). |
| `how-to` | what to do about a trap or a recurring task: surprising behaviour, a past incident and its lesson, or a procedure no script or doc in the repository runs |
| `contract` | an interface between repositories (an API, event, queue or shared schema) with its producer and consumers. Its `repos` names at least two; always `application` |

Write the `description` and the body in plain prose, by [PROSE.md](PROSE.md). The body states the fact first. A `decision` or `how-to` follows it with **Why:** and **How to apply:** lines; a procedure's steps follow its **How to apply:** line as a numbered list. Link every note it builds on or bears on with `[[name]]`: each link is an edge in the graph. A link to a note not written yet draws as a dashed node, marking a note worth writing.

Any note can name what a link means in a `## Relations` section, which `scripts/notes.mjs` is the one parser of:

```markdown
## Relations
- starts [[billing-api-invoicing]]
- is a [[party]]
```

A **relation line** is `- <verb> [[<note>]]`. The verb is free, in the domain's words; `is a` and `part of` are reserved for hierarchy. Its target may be a note not written yet. A plain `[[link]]` stays valid without one. Write a relation only when the code or the domain proves the link.

### The term note

A `term` keeps flat frontmatter, with `type: term` and `repos` listing the slugs its pairings name. Its body opens with the definition and the states the entity moves through, then holds a `## Pairings` section, and may hold `## Relations`, as any note may. `scripts/notes.mjs` is the one parser of both:

```markdown
## Pairings
- billing-api: `Customer`, narrower. Only who has paid at least once. Avoid: `buyer`.
- web-app · checkout: `User`, broader. Anyone signed up.

## Relations
- places [[order]]
- is a [[party]]
```

- A **pairing line** is ``- <slug>[ · <context>]: `<word>`, <same|narrower|broader>[. <nuance>][. Avoid: `<w>`, `<w>`].`` The degree says how the repository's word relates to the term: `same`, `narrower` or `broader`. The context names one context of a repository, such as a module of a monolith. A term has at least one pairing.
- A term's **relation line** is the note format's, with a term for its target.

### Layers

A note's **layer** names its reader:

- **`business`**: what the product does and why, in the domain's words, for a product owner or a teammate on their first day. Every explored note is `business`.
- **`application`**: how the system is built (its modules, data, interfaces and traps), for whoever changes the code.

The layer is worked out, not written: a `feature`, a `term` and every explored note is `business`, and a `contract` and an authored `concept` is `application`. Only a `decision` and a `how-to` store a `layer` line, whose type leaves the layer open. `scripts/notes.mjs`'s `layerOf` and `STORES_LAYER` work it out for the scripts; `brain.html` holds a copy of both, since the page cannot import `notes.mjs`, and `note-copies.test.mjs` keeps the two alike.

A fact about both takes the layer of the reader who acts on it: a refund limit is `business`, the job that enforces it `application`.

### When a note stops being true

The note's type decides, so the brain keeps a past only where the past is knowledge, and git keeps the rest:

| The note | becomes | by the draft |
|---|---|---|
| An explored note | rewritten or deleted by the next `/brain explore` | none |
| An authored `concept`, `contract` or `how-to` whose subject still exists | its new text, edited in place | `update` |
| A `decision` reversed or replaced | kept, marked by its `status` and `supersededBy` fields above, with a `Superseded by [[<name>]]` line under its body; the new decision links it, and says why it changed in its **Why:** line | `supersede` |
| A note whose subject or trap is gone, or that was simply wrong | deleted, the reason in its commit's body | `delete` |

### Drafts

A **draft** is a note this machine learned that the team has not yet seen: one file in `.local/drafts/`, named `<name>.md` after the note it proposes. [RECORD.md](RECORD.md) writes it, and [SYNC.md](SYNC.md)'s **Consolidate** turns it into a commit, discards it or keeps it. It holds the note's full text as it would land, by the format above, with two more frontmatter lines, and a third on a `supersede`:

- `target`: the path the note lands at, its home by the note's `repos` line (`notes/repos/billing-api/billing-api-retry-idempotency.md` for one repository, `notes/shared/<name>.md` for several or none, and `notes/domain/<name>.md` for a `term`).
- `action`: `record` for a new note, `update` for a new version of the note at `target`, `supersede` for a new decision replacing another, or `delete` for removing the note at `target`, whose body then holds only the reason.
- `supersedes`: on a `supersede` only, the name of the decision it replaces.

### Explored notes

An explored note speaks the domain's words, so an outsider can read it, and ends on a **Sources** line naming the files it comes from, so a teammate with the code can check it and the next explore knows which changes touch it:

```markdown
---
name: billing-api-refunds
description: A paid invoice can be refunded within 30 days, in full or in part, with finance approving any refund above 500
type: feature
explored: a1b2c3d
---

A customer, or support on their behalf, asks to refund a paid invoice. The money goes back to the card it was paid with.

**Rules:**
- Only within 30 days of payment.
- A partial refund never exceeds what is left unrefunded.
- Above 500, the refund waits for a finance approver.

Related: [[billing-api-invoices]] · [[invoice-event-contract]]

Sources: `src/refunds/refund.service.ts`, `src/refunds/refund-policy.ts`
```

An explored note is **current** while the repository's default branch still points at its commit, and **behind** once the branch has moved on. `git ls-remote <remote> HEAD` tells which without a clone: compare the SHA it prints with the note's `explored` line, by prefix. With the repository linked, `git -C <root> rev-list --count <explored>..origin/HEAD` after a fetch says by how many commits. When the remote cannot be reached, its state is **unknown**. `git -C <brain> log -1 --format=%cr -- <note>` says when the note was last explored.

## Settings

`.local/config.json` in the active brain holds this machine's limits on the pipeline, as one JSON object: `{ "parallelAgents": 3 }`. A setting takes its default when it is missing, when it holds a value its row does not allow, or when the file is missing or does not parse as a JSON object; say so when the file does not parse. To set one, write the value its row allows into that key, keeping the other keys and creating the file when it is missing. When the file does not parse, show the user and leave it untouched. When the value asked for is not one its row allows, say what the row allows and write nothing.

| Setting | Default | Holds |
|---|---|---|
| `parallelAgents` | `5` | the most sub-agents a fan-out runs at once, by BRIEF.md's **Fanning out**, and the most tracks `build` keeps a background builder or fixer running in: a positive whole number |

## Specs

Specs live in `.local/specs/`, each in a folder `NNN-<slug>/`: `NNN` one past the highest folder number already there (starting at `001`), in one sequence across every repository, and `<slug>` the spec's title in kebab-case. [SPEC-ID.md](../../write-spec/references/SPEC-ID.md) resolves the short forms users type. A spec can change several repositories.

A spec's milestones sit in one **track** per repository it changes: the folder `<slug>/` straight in the spec folder, whose name is the repository every milestone in it builds in. A track numbers its milestones `001` upwards, and its tickets `001` upwards across those milestones, and builds and lands them in number order. A number names a milestone or ticket inside its own track; from anywhere else, write `<slug>/NNN`. Tracks wait on each other only at milestones: a ticket's **Depends on** of `003, 004` names tickets of its own track, and a milestone's **Builds after** of `web-app/002` names `web-app`'s milestone `002`. A spec ticketed before **Builds after** may hold `<slug>/NNN` in a ticket's **Depends on**; `build` moves it onto the milestone, by [MIGRATE.md](MIGRATE.md)'s **Builds after**.

In a spec folder, a folder whose name starts with three digits is a milestone of the flat layout, and every other folder is a track. A spec is **ticketed** when its folder holds a track or a milestone folder.

A spec ticketed before tracks has the **flat layout**: its milestones sit straight in the spec folder, numbered across the spec, and each one's track is the slug on its `**Repo:**` line. In it a milestone's number, and the number of its `sdd/<spec-folder>/M<NNN>` branch, run across the whole spec. Skills read both layouts; `build` alone moves a flat spec into tracks, by [MIGRATE.md](MIGRATE.md)'s **Tracks**, before it builds.

| Line | In | Holds |
|---|---|---|
| **Repos** | `spec.md` | the slugs the spec changes, each registered |
| **Key** | `spec.md` | one commit key for every repository when all of **Repos** share one `commitKeyPattern`; otherwise one `<slug>: <key>` entry per repository, `<slug>: None` for one whose pattern is `null`; or `None`. Each key fully matches its repository's pattern |
| **Base** | `spec.md` | one `<slug>@<branch>` entry per repository: the branch its milestones land on |
| **Landings** | `spec.md` | each landing in the order it reached its base, as `<slug> <NNN>` or `<slug> <NNN>-<NNN>`: the slug, a space (not the `/` of an id), then the first and last of the track's milestones it put on the base, or the one; entries separated by `; `, such as `billing-api 001; web-app 001-002`. Absent until the first landing |
| **Landed** | `spec.md` | one `<slug>@<SHA>` entry per repository, written once every milestone has landed |
| **Merged** | `spec.md` | one `<slug>@<SHA>` entry per repository whose remote holds the spec's work: the commit on `origin/<base>` that holds the repository's last landing, written by `open-pr --merged`. Absent until the first merge |
| **Abandoned** | `spec.md` | the user's reason the spec will never be built, under its **Key** line, by [IN-FLIGHT.md](../../write-spec/references/IN-FLIGHT.md); absent otherwise |
| **Builds after** | `milestone.md` | the milestones of other tracks it starts building after they squash, and reaches its base after, as `<slug>/NNN` ids, or `None`. Absent in the flat layout |
| **Lands after** | `milestone.md` | the milestones of other tracks it reaches its base after while building beside them, as `<slug>/NNN` ids, or `None`; only a contract change's order writes them. Absent in the flat layout |
| **Landed** | `milestone.md` | the SHA its squash became on its repository's base once it landed, or `none` |

A spec is **landed** when its `spec.md` has a **Landed** line, and **in flight** while it has neither a **Landed** nor an **Abandoned** line. A landed spec is **merged** once its **Merged** line names every repository of its **Landed** line whose card has a remote; a repository whose card says `local only` needs no entry. Each repository holds the spec's branches under the spec folder's name: `sdd/<spec-folder>/spec`, and `sdd/<spec-folder>/M<NNN>` for each milestone of its track.
