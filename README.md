# alper-brain

Spec-driven agent skills for Claude Code, worked from a **second brain**. The brain is a git repository holding your team's knowledge about every repository it covers, and the hub you work from: features are brainstormed, written down as specs, cut into tickets and built test-first, across one repository or several. You make the decisions. The agent does the digging, writing and building.

## Install

```
/plugin marketplace add alexandrecsp/alper-brain
/plugin install alper-brain@alper-brain
```

The skills then show up as `/alper-brain:<name>`. Below they are written by their short names. alper-brain replaces alper-skills: install one or the other.

## How it works

```
~/brains/acme/                   ← the brain: launch Claude here
├── BRAIN.md                       what it is, how to join, the repositories it covers
├── repos/billing-api/             team notes on one repository, beside its REPO.md card
├── shared/                        notes spanning several (contracts between repositories)
└── .sdd/                          this machine's pipeline work, ignored by git
    ├── links.json                 where each repository is cloned here
    └── specs/                     specs, milestones, tickets and reviews, across repositories
```

- **Knowledge is shared, work stays local.** Everything outside `.sdd/` is committed and shared by pull and push. Specs and tickets stay on your machine; what they teach reaches the team as notes.
- **You work from the brain.** Claude is launched in the brain's folder, so it always knows where the brain is. The repositories the work needs are opened beside it.
- **Each repository moves through three states.** **Registered**: the brain holds its `REPO.md` card (its remote, commit key pattern and test commands), so its notes and specs work. **Linked**: the brain knows where it is cloned on this machine, so skills can read its code. **Open**: it is open in the session, so skills can change it. Skills ask you to open a repository (`/add-dir <path>`) when they need to change it.
- **One brain per knowledge base.** A company, a client, your side projects: each gets its own brain, with its own notes, remote and `.sdd/`. Nothing crosses between them.

`skills/brain/FORMAT.md` defines all of it.

## Getting started

1. **Create or clone a brain.** Run `/brain setup` anywhere. It clones your team's brain or creates one, and tells you to launch Claude in it from then on.
2. **Register each repository.** In the brain, with a repository open (`/add-dir <path>`), run `/brain setup` again. It writes the repository's card (commit key, unit and e2e commands), settles its layout in `docs/STRUCTURE.md`, adds a short **Second brain** section to its `CLAUDE.md` or `AGENTS.md`, and moves its old `.sdd/` into the brain if it has one.
3. **Link the rest.** `/brain link` finds this machine's clones of every registered repository.
4. **Look around.** `/brain status` reports everything in flight, `/brain view` opens the brain page, and `/brain ask <question>` answers questions that cross repositories.

## The pipeline

```
/brainstorm  ──────────────  a shared understanding: What, then How
        │
/to-spec  ─────────────────  .sdd/specs/NNN-<slug>/spec.md, naming the repositories it changes
        │
/to-tickets  ──────────────  milestones, each in one repository, with tickets
        │
/build  (every milestone, or one with a milestone id) ┐
   ├─ branch sdd/<spec>/M<NNN> in the milestone's repository
   ├─ per ticket: sub-agent → tdd → commit
   ├─ check the milestone's "Done when"
   ├─ review-changes → arbiter decides escalations → fix
   ├─ squash it into sdd/<spec>/spec
   └─ moving to another repository? land this one first ┘
        │
   then, once every milestone is in
   └─ land the rest → record the spec's landing → offer what was learned as notes
```

Each stage writes files the next one reads, and each ends by telling you the next command to run. The files carry Mermaid diagrams so you can take them in at a glance: the spec has the user's **journey** and a **module map**, grouped by repository when it spans several, each milestone its slice of that map, each ticket its **tracer bullet** path through the layers, and each review a **finding map** of where its findings land. `skills/to-spec/DIAGRAMS.md` defines them, and the brain page draws them. You can stop between any two stages, or join partway through. For example, `/to-tickets` works on the current conversation without a spec, and `review-changes` works on any branch.

### 1. `/brainstorm [topic]`

The agent interviews you, one round of questions at a time, until you share an understanding of the work. The decisions form a **design tree** with two phases:

- **What** comes first: the problem, scope, behaviour, constraints and what success looks like.
- **How** comes second: the approach, architecture, data and design patterns (via `design-patterns`).

Each round asks every question that can be answered *now*, with options and a recommended answer, so replying `ok` accepts all the recommendations. When a question depends on a fact about the codebase, the agent looks it up instead of asking you. It reads the brain's notes on every repository the topic touches first, and each contract the design would change becomes a question: do its consumers change too, or does the interface stay compatible? Each phase ends with a summary for you to confirm.

`/brainstorm-with-docs` runs the same interview together with `domain-modeling`. Terms are challenged against each repository's `GLOSSARY.md` and written down as they settle, and decisions that are hard to reverse are offered as ADRs in `docs/adr/`.

### 2. `/to-spec`

Turns the conversation into `.sdd/specs/NNN-<slug>/spec.md` in the brain. Its **Repos** line names the repositories it changes, and specs are numbered in one sequence across all of them. The spec contains only what the conversation settled. Each question left open comes with a recommended answer, for you to settle now or record as open. Before writing, the agent proposes two things for you to confirm:

- the **seams** where tests will prove the feature works, as few as possible
- the **design patterns**, if the brainstorm never weighed them

It also asks for the spec's commit key: one key, or one per repository when their patterns differ.

When another **in-flight** spec (one not landed yet) changes the same modules, or a contract the new work's repositories share, the new spec **depends on** it: it is designed against that spec's planned state, lists what it assumes under **Relies On**, and `/build` waits until the dependency lands and those assumptions still hold. In-flight checks see every spec in the brain, whatever repository it changes. A spec that will never be built carries an `**Abandoned:** <reason>` line: it stops counting as in-flight, `/build` refuses it, and the brain page greys it out.

### 3. `/to-tickets [spec-id]`

Breaks the spec into ordered **milestones**, and each milestone into **tickets**:

- A milestone is an increment that leaves the code working and tested, with a check the builder can run. It builds in **one repository**, named on its **Repo** line, since it is built, checked and squashed inside one git history.
- A ticket is a **tracer bullet**: a thin vertical slice through every layer it needs, verifiable at a confirmed seam, and small enough for one agent with a fresh context. Prefactoring tickets come first. Wide mechanical refactors follow `WIDE-REFACTOR.md` so each batch stays green.
- A **contract change** between repositories follows `CONTRACT-CHANGE.md`: the producer adds the new shape beside the old one, each consumer moves over in its own milestone, then the producer removes the old shape. Every step leaves every repository working, since repositories deploy on their own schedules.

You review the breakdown (boundaries, granularity, dependencies) until you approve it. Then it writes:

```
.sdd/specs/NNN-<slug>/
├── spec.md
└── milestones/
    └── NNN-<milestone-slug>/
        ├── milestone.md        ← Repo, Delivers, Done when, Phase, Squash, Landed, Shape
        ├── NNN-<ticket-slug>.md   ← Status: todo | doing | blocked | done, Commit: <sha>, Depends on, Notes
        └── review.md           ← written by review-changes: the findings, and the arbiter's answers to escalations
```

### 4. `/build [spec-id] [milestone-id]`

A **spec id** is the spec folder's number (`3` or `s03`), name or path; a **milestone id** is the milestone folder's number (`m01`, `M001` or `1`) or name. `/build s03` builds **every milestone and then lands the spec**; `/build s03 m02` builds **only that milestone**, once the milestones before it are squashed. For each milestone:

1. It picks the earliest milestone not yet squashed, or the one you named, and resumes it from its **Phase** line when an earlier build stopped partway. When the build is moving to another repository, it lands the one it is leaving first.
2. It finds the milestone's repository through the brain's links, asks you to open it when it is not open, and checks out the milestone's own branch there, `sdd/<spec-folder>/M<NNN>`, created from that repository's spec branch, `sdd/<spec-folder>/spec`. The working tree must be clean.
3. For each ticket, in order, it starts a fresh **builder sub-agent**, pointed at the repository's root. It builds the ticket with `tdd` (red, then green, at the ticket's seams) and commits with `commit`. Then it marks the ticket `done` with its SHA and leaves notes for the next ticket.
4. It runs `review-changes` over the milestone's whole diff and saves the report as the milestone's `review.md`. Every finding is fixed automatically in one pass by a **fixer**, the builder dispatched on Sonnet rather than Haiku, with no second review. Findings flagged **escalate** (fixes that would contradict an ADR, change an interface that code outside the diff already calls, other repositories included, or need the spec itself changed) go first to an **arbiter** sub-agent on Opus, which decides each one without asking you. The hand-over lists every decision under **Decided for you**, so you can revert any of them.
5. It runs the repository's full suite and the milestone's **Done when** check, once, after the fixes.
6. It squashes the milestone's branch into the spec's branch as one commit, recording its SHA in `milestone.md`.

Before changing any base branch, `/build` asks you. To land a repository, it rebases that repository's spec branch onto its base, runs the full suite (fixing it, in up to two tries, when the base's new commits broke it), and fast-forwards the base, then records **Landed** on each milestone that landed. Once every milestone has landed, the spec gets its **Landed** line, one entry per repository, and the tickets' gotchas and the arbiter's reasons are offered as notes. Everything stays local: nothing is pushed and no PR is opened, so push by hand when you want to. Because progress lives in the ticket files, the **Phase** and **Landed** lines and `review.md`, a build that stops picks up where it left off.

#### Branches and landing

Each repository holds the spec's branches under the spec folder's name: `sdd/<spec-folder>/spec`, and `sdd/<spec-folder>/M<NNN>` for each of its milestones, squashed back into the spec branch as one commit (highlighted above). A repository lands each time the build moves from its milestones to another repository's, and once after the last milestone. So for a spec whose milestones run `billing-api`, `web-app`, `billing-api`, the bases take them in that order: `billing-api` lands M001 before `web-app` builds M002, `web-app` lands M002 before M003, and `billing-api` lands M003 last. Each base ends with one commit per milestone, in a straight line, with no merge commit. A spec in one repository lands once, at the end.

Every pipeline branch starts with `sdd/`, so `git branch --list 'sdd/*'` finds them all in a repository. After landing, `/build` offers to delete the spec's branches in each repository.

## The brain

Everything about the brain runs through `/brain`, and its first argument picks what it does:

| Command | What it does |
|---|---|
| `/brain setup` | Clones or creates a brain, then registers a repository in it: its card, its layout, its agent-file section, and its old `.sdd/` moved over. Run it once per brain on each machine, then once per repository. |
| `/brain link` | Finds this machine's clone of each registered repository and records where it is. Linking opens nothing. |
| `/brain status` | Every repository (unlinked, linked or open, dirty, unpushed) and every in-flight spec with its state, risks first: blocked or failed builds, specs waiting on a dependency, and contract changes whose consumers the spec leaves out. |
| `/brain ask <question>` | Answers a question that crosses repositories: recalls the notes, sends one scout per repository in parallel, answers with citations from each, and offers what the notes lacked as new notes. Asking is how an empty brain fills up. |
| `/brain view` | Opens the brain page: every brain you add, each with its **Specs** (milestones, tickets, reviews and diagrams, live) and its **Notes** (a graph of every note and `[[link]]`, clustered round repository hubs, or a list). Needs Chrome or Edge. |
| `/brain recall` | Reads the notes bearing on the current work. Skills do this on their own. |
| `/brain remember <fact>` | Proposes a note and commits it once you confirm. |
| `/brain sync` | Pulls with rebase, merges any note two people changed, then pushes. Nothing is pushed until you run it. |

Each note holds one fact: frontmatter with `name`, a one-line `description` and a `type` (`concept`, `decision`, `gotcha`, `contract`, `how-to`), then the fact, linked to related notes with `[[name]]`. Obsidian can open the brain as a vault.

The pipeline uses the brain throughout. Every skill that reads the glossary and ADRs also reads the brain's notes on the repositories it works in. A `contract` note records which repositories consume an interface: a change to it becomes a question in `brainstorm`, a confirmed item in `to-spec`, an overlap in the in-flight check, an **escalate** flag in `review-changes`, and a one-way door in `pr`, with those repositories in its blast radius. Knowledge flows back as proposals you pick from: `diagnose` offers the root cause as a gotcha, landing a spec offers the tickets' gotchas and the arbiter's reasons, `onboard` offers undocumented dependencies on other repositories as contracts, `research` offers its verified answer, and `/brain ask` offers whatever the notes lacked.

## Skills used along the way

| Skill | Role |
|---|---|
| `tdd` | Red then green, one vertical slice at a time, with tests only at confirmed seams. Runs the suites the repository's card names. |
| `commit` | `<KEY>: <Present-tense title>` plus one to three bullets. Reads the key from the spec, or the repository's card. |
| `review-changes` | Reviews a diff in two separate sub-agents. **Standards** checks repo docs, glossary, ADRs and the smell baseline. **Spec** checks for missing requirements, scope creep and requirements built wrong. Saves the report as `review.md` in the milestone's folder, or the spec's when it reviews the whole spec. |
| `pr` | Writes a PR's title and body: a visual **Summary**, before-and-after **Evidence** checked against the spec's claims, and a **Merge Danger** call (one-way or two-way door, blast radius). It opens or updates the PR only when you ask. |
| `domain-modeling` | Maintains each repository's `GLOSSARY.md` and ADRs, including multi-context repos with `GLOSSARY-MAP.md`. |
| `design-patterns` | A catalogue of patterns and when to choose each one. Each choice is recorded as Pattern, Where and Why. |
| `project-structure` | One hexagonal layout for every language: `domain/` (entities, value objects, ports), `application/` (use cases, services, DTOs), `infrastructure/` (driving, driven, config). Covers role-suffixed names for TypeScript, Python and Java, and frontend, backend and full-stack apps. The repo's `docs/STRUCTURE.md` overrides it. |
| `codebase-design` | Vocabulary for deep modules: module, interface, seam, adapter, depth. |
| `writing-for-agents` | How to write skills, `CLAUDE.md` and `AGENTS.md`. Used when editing this repo. |
| `diagnose` | Diagnoses a hard bug or performance regression. It first builds a tight loop that goes red on the bug, then minimises the repro, ranks falsifiable hypotheses, and instruments one variable at a time. It fixes with a regression test at a correct seam, or records that no such seam exists. |
| `brain` | The hub, behind one command: `setup`, `link`, `status`, `ask`, `view`, `recall`, `remember` and `sync`. On its own, it reads a repository's notes before work and proposes a note when it learns something the repository doesn't record. It syncs only when you ask. |
| `research` | Researches a question against primary sources in a background sub-agent. Saves the cited findings to the brain's `.sdd/research/<slug>.md`. |
| `prototype` | Builds a throwaway prototype that answers one design question: a shareable HTML demo for logic, or switchable variants for UI, each drafted in parallel by its own designer sub-agent. Keeps it on a `prototype/<slug>` branch and records the verdict. |
| `improve-and-refactor` | Scans hot spots for deepening and smell refactors, shows them as an HTML report saved to the brain's `.sdd/refactors/<slug>/`, and brainstorms the one you pick. A contained refactor goes straight to `/to-tickets` and `/build`; a larger one starts at `/to-spec`. |
| `onboard` | Explores a whole repository, one scout per area in parallel, then traces the two or three journeys that cross the most areas. Writes an onboarding tour for a newcomer to the brain's `.sdd/tours/<slug>/`: a context map, the journeys, a card per area, where things live, the vocabulary and the commands. Then offers to record the terms and decisions it found undocumented. |

The pipeline skills (`brainstorm-with-docs`, `to-spec`, `to-tickets`, `build`), `improve-and-refactor`, `onboard` and `pr` only run when you type their command. The others can also be invoked by the agent when it needs them.

## Moving from alper-skills

Install alper-brain in place of alper-skills, then run `/brain setup` in a brain with each repository open. Setup moves the repository's `.sdd/` into the brain's: each spec keeps its folder name unless its number is taken (then it is renumbered, and its branches renamed), gains its **Repos** and **Repo** lines, and its research, tours and refactor reports come along. The commit key from `.sdd/settings.json` moves to the repository's card, and the **Spec workflow** section of its agent file becomes a **Second brain** section. The dashboard and the graph page are now the one brain page, `/brain view`.

## Repository layout

```
.claude-plugin/   plugin.json and marketplace.json
skills/<name>/    SKILL.md plus any reference files it points to
agents/           the sub-agents the skills dispatch, each pinned to a model
docs/DESIGN.md    why the brain became the hub
```
