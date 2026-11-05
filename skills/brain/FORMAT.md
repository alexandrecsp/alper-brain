# Brain format

The shape of the second brain: the team's notes on every repository, shared, and this machine's pipeline work across them, kept local.

## Layout

```
<brain>/
├── BRAIN.md                              ← what the brain is, how to join, the repositories it covers
├── .gitignore                            ← holds `.sdd/`
├── repos/<slug>/
│   ├── REPO.md                           ← the repository's card
│   └── <name>.md                         ← notes on one repository
├── shared/<name>.md                      ← notes spanning several repositories
└── .sdd/                                 ← this machine's pipeline work, ignored by git
    ├── links.json                        ← where this machine's clones of the repositories are
    ├── specs/NNN-<slug>/                 ← work planned or in flight, in one repository or several
    │   ├── spec.md
    │   └── milestones/NNN-<milestone-slug>/
    │       ├── milestone.md
    │       ├── NNN-<ticket-slug>.md
    │       └── review.md
    ├── research/<slug>.md                ← cited findings from `research`, with `<slug>/<group>.md` beside it when it fans out
    ├── tours/<repo-slug>/                ← onboarding tours from `onboard`
    ├── refactors/<repo-slug>/            ← reports from `improve-and-refactor`
    ├── prototypes/<slug>.html            ← logic prototypes from `prototype`
    ├── snapshots/<repo-slug>/            ← a repository's default branch, checked out while a skill reads it
    └── explore/<repo-slug>/<area>/       ← explored notes `explore` drafts, only while it runs
```

Everything outside `.sdd/` is the team's and is committed. `.sdd/` is this machine's and never leaves it: what it learns reaches the team only as notes.

## The open session

The user works from the brain: it is always one of the session's **working directories** (the primary one and the additional ones, as the environment lists them), so nothing records where it is. A folder is **open** when a working directory is that folder or holds it.

A machine can hold several brains. Each one is a separate **knowledge base**, with its own notes, remote and `.sdd/`: whatever the user keeps apart, such as a company, a client or a field. Brains are **isolated**: a run reads and writes one brain only, and never carries a note, spec or path from one brain into another. A **brain name** is the last segment of the brain's `git remote get-url origin` without `.git`, else its folder's name, in kebab-case.

The **active brain** is the open folder holding `BRAIN.md`. When several are open, it is the one the user names in this conversation (such as `@side-projects` in a command's arguments), or else the one holding the primary working directory; failing both, ask the user once per conversation. When none is open, the session has no brain: tell the user to launch Claude in the brain's folder or run `/add-dir <brain>`, or to run `/brain setup` when they have no brain yet.

## Repositories

A **repo slug** names a repository the same way on every teammate's machine, whatever folder each clone sits in. It is the slug the repository's **Second brain** section of `AGENTS.md` or `CLAUDE.md` names for this brain, when it names one; else the last segment of `git remote get-url origin` without `.git`; else the root folder's name. It is kebab-case, and unique within its brain. A repository registered in two brains has two separate sets of notes, one in each.

A repository moves through three states, each building on the one before:

| State | Holds when | Enough for |
|---|---|---|
| **registered** | the brain holds `repos/<slug>/REPO.md` | its notes, and specs that name it |
| **linked** | the brain's `.sdd/links.json` names this machine's clone of it | reading its code, by that path |
| **open** | that clone is open in this session | changing its code: building, fixing, committing |

`.sdd/links.json` maps each linked slug to the clone's absolute path, with forward slashes: `{ "billing-api": "C:/work/acme/billing-api" }`. A clone matches a card when its `git remote get-url origin` names the same repository as the card's `remote` (ignoring a trailing `.git`, and whether it is written as SSH or HTTPS), or, for a `local only` repository, when its folder's name is the slug. `/brain setup` registers a repository, and `/brain link` links the registered ones.

Read a linked repository that is not open by its path, even though the user may be asked to allow each read. Before changing one, ask the user to run `/add-dir <path>`, and stop until it is open: running the same command again picks up from there.

A **snapshot** reads a linked repository's default branch without touching its clone's working tree, and inside the brain, so no read asks for permission: `git -C <root> fetch --quiet origin` (then `git -C <root> remote set-head origin --auto` when `origin/HEAD` is missing), then `git -C <root> worktree add --detach <brain>/.sdd/snapshots/<slug> origin/HEAD` (the clone's `HEAD` for a `local only` repository), first running `git -C <root> worktree remove --force <brain>/.sdd/snapshots/<slug>` when an earlier run left one there. It writes only to the clone's `.git`, so the repository need only be linked. Remove it with `git -C <root> worktree remove --force <snapshot>` once its reads are done.

`REPO.md` is the repository's card:

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

The session's primary folder is the brain, so a skill that reads or changes code first names its **working repository**, by the first rule that gives one:

1. The **Repo** line of the milestone the work builds.
2. The repository the user names, by slug or by a path inside its clone.
3. The repository whose clone holds the files the conversation is working on.
4. The only repository open in this session besides the brain.

Otherwise ask the user, listing the registered repositories. Its **root** is its clone's path, from `.sdd/links.json` or the open folder; when it has neither, ask the user to run `/brain link`, or `/add-dir <path>`, and stop. Then:

- Paths a skill gives relative to a repository (`docs/STRUCTURE.md`, `GLOSSARY.md`, `docs/adr/`, `AGENTS.md`, `CLAUDE.md`) are relative to its root. Read and write its files by absolute path.
- Run every git command as `git -C <root>`, and every suite or script from the root (`cd <root> && <command>`).
- Its agent file is not loaded into a session started in the brain: read it when a skill names it.
- Sub-agents start in the brain too, with no user: brief each one by [BRIEF.md](BRIEF.md).

## Notes

One fact per file. Teammates adding notes at the same time never conflict, and the graph shows one node per fact. A note is one of two kinds:

- **Authored**: what a repository cannot tell by looking, such as the reason behind a choice, a trap, or a contract between two repositories. **Record** in [SKILL.md](SKILL.md) writes it, one confirmed note at a time.
- **Explored**: what the code does, written for an outsider who never opens it. Only `/brain explore` writes it, by [EXPLORE.md](EXPLORE.md), and its next run rewrites it. Its `explored` line marks it.

```markdown
---
name: billing-retry-idempotency
description: Billing retries reuse the charge's idempotency key, so a retried charge never bills twice
type: gotcha
---

A retried charge sends the first attempt's idempotency key, and the provider answers with the first attempt's result.

**Why:** the provider double-billed during the March outage, when retries carried fresh keys.
**How to apply:** pass the stored key to every retry path, including manual replays from the admin console.

Related: [[invoice-event-contract]]
```

- `name`: the file name without `.md`, in kebab-case, unique across the **whole brain** and not only its folder, since `[[name]]` resolves by it here and in Obsidian. Prefix the repo slug when a bare name could clash.
- `description`: one line that stands alone. Recall judges relevance from it without opening the note.
- `type`: one of the types below.
- `repos`: in `shared/` only, the slugs the note spans, as `[billing-api, web-app]`. A note in `repos/<slug>/` belongs to that slug.
- `explored`: on explored notes only, the short SHA of the commit the note was read at.

| type | holds |
|---|---|
| `feature` | something a user, an operator or another system can do through the repository: who does it, what happens, and its rules. Explored only |
| `concept` | how a part works, or what a term means in this repository. When the repository's `GLOSSARY.md` defines the term, link it and record only what the glossary lacks |
| `decision` | a choice and its reason. When the repository keeps ADRs, link the ADR's path and record only what it lacks |
| `gotcha` | a trap: surprising behaviour, or a past incident and its lesson |
| `contract` | an interface between repositories (an API, event, queue or shared schema) with its producer and consumers. Lives in `shared/` |
| `how-to` | a recurring procedure that no script or doc in the repository runs |

The body states the fact first. A `decision` or `gotcha` follows it with **Why:** and **How to apply:** lines. Link every note it builds on or bears on with `[[name]]`: each link is an edge in the graph. A link to a note not written yet draws as a dashed node, marking a note worth writing.

### Explored notes

An explored note speaks the domain's words, so an outsider can read it, and ends on a **Sources** line naming the files it comes from, so a teammate with the code can check it and the next explore knows which changes touch it:

```markdown
---
name: billing-api-refunds
description: A paid invoice can be refunded within 30 days, in full or in part, with finance approving any refund above 500
type: feature
explored: a1b2c3d
---

A customer, or support on their behalf, asks for a refund of a paid invoice, and the money goes back to the card it was paid with.

**Rules:**
- Only within 30 days of payment.
- A partial refund never exceeds what is left unrefunded.
- Above 500, the refund waits for a finance approver.

Related: [[billing-api-invoices]] · [[invoice-event-contract]]

Sources: `src/refunds/refund.service.ts`, `src/refunds/refund-policy.ts`
```

An explored note is **current** while the repository's default branch still points at its commit, and **behind** once the branch has moved on. `git ls-remote <remote> HEAD` tells which without a clone: compare the SHA it prints with the note's `explored` line, by prefix. With the repository linked, `git -C <root> rev-list --count <explored>..origin/HEAD` after a fetch says by how many commits. When the remote cannot be reached, its state is **unknown**. `git -C <brain> log -1 --format=%cr -- <note>` says when the note was last explored.

## Specs

Specs live in `.sdd/specs/`, numbered `NNN` in one sequence across every repository: [SPEC-ID.md](../to-spec/SPEC-ID.md) resolves the short forms users type. A spec can change several repositories, and each of its milestones changes exactly one.

| Line | In | Holds |
|---|---|---|
| **Repos** | `spec.md` | the slugs the spec changes, each registered |
| **Key** | `spec.md` | one commit key for every repository when all of **Repos** share one `commitKeyPattern`; otherwise one `<slug>: <key>` entry per repository, `<slug>: None` for one whose pattern is `null`; or `None`. Each key fully matches its repository's pattern |
| **Base** | `spec.md` | one `<slug>@<branch>` entry per repository: the branch its milestones land on |
| **Landed** | `spec.md` | one `<slug>@<SHA>` entry per repository, written once every milestone has landed |
| **Repo** | `milestone.md` | the one slug from **Repos** this milestone builds in, with that repository's branches and suites |
| **Landed** | `milestone.md` | the SHA its squash became on its repository's base once it landed, or `none` |

A spec is **landed** when its `spec.md` has a **Landed** line, and **in flight** while it has neither a **Landed** nor an **Abandoned** line. Each repository holds the spec's branches under the spec folder's name: `sdd/<spec-folder>/spec`, and `sdd/<spec-folder>/M<NNN>` for each of its milestones.
