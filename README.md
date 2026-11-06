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
    ├── config.json                this machine's limits, such as how many tracks build at once
    └── specs/                     specs, milestones, tickets and reviews, across repositories
```

- **Knowledge is shared, work stays local.** Everything outside `.sdd/` is committed and shared by pull and push. Specs and tickets stay on your machine; what they teach reaches the team as notes.
- **You work from the brain.** Claude is launched in the brain's folder, so it always knows where the brain is. The repositories the work needs are opened beside it.
- **Each repository moves through three states.** **Registered**: the brain holds its `REPO.md` card (its remote, commit key pattern and test commands), so its notes and specs work. **Linked**: the brain knows where it is cloned on this machine, so skills can read its code. **Open**: it is open in the session, so skills can change it. Skills ask you to open a repository (`/add-dir <path>`) when they need to change it.
- **One brain per knowledge base.** A company, a client, your side projects: each gets its own brain, with its own notes, remote and `.sdd/`. Nothing crosses between them.

`skills/brain/references/FORMAT.md` defines all of it.

## Getting started

1. **Create or clone a brain.** Run `/brain setup` anywhere. It clones your team's brain or creates one, and tells you to launch Claude in it from then on.
2. **Register each repository.** In the brain, with a repository open (`/add-dir <path>`), run `/brain setup` again. It writes the repository's card (commit key, unit and e2e commands), settles its layout in `docs/STRUCTURE.md`, adds a short **Second brain** section to its `CLAUDE.md` or `AGENTS.md`, and moves its old `.sdd/` into the brain if it has one.
3. **Link the rest.** `/brain link` finds this machine's clones of every registered repository.
4. **Explore them.** `/brain explore` writes what each linked repository does into the brain, so teammates who never clone the code can ask about it. `/brain sync` shares the notes.
5. **Look around.** `/brain status` reports everything in flight, `/brain view` opens the brain page, and `/brain ask <question>` answers questions that cross repositories.

## The pipeline

```
/brainstorm  ──────────────  a shared understanding: What, then How
        │
/to-spec  ─────────────────  .sdd/specs/NNN-<slug>/spec.md, naming the repositories it changes
        │
/to-tickets  ──────────────  one track of milestones per repository, with tickets
        │
/build  (every track side by side, one event loop)        ┐
   ├─ branch sdd/<spec>/M<NNN> in each track's repository
   ├─ per track: one background builder at a time → tdd → commit
   └─ per milestone, one at a time, while the tracks build:   ┘
        review-changes → arbiter decides escalations → fix
        → check the milestone's "Done when" → squash into sdd/<spec>/spec
        → land the track's landable milestones (as it goes)
        │
   then, once every milestone is in
   └─ land the rest → record the spec's landing → offer what was learned as notes
```

Each stage writes files the next one reads, and each ends by telling you the next command to run. The files carry Mermaid diagrams so you can take them in at a glance: the spec has the user's **journey** and a **module map**, grouped by repository when it spans several, each milestone its slice of that map, each ticket its **tracer bullet** path through the layers, and each review a **finding map** of where its findings land. `skills/to-spec/references/DIAGRAMS.md` defines them, and the brain page draws them. You can stop between any two stages, or join partway through. For example, `/to-tickets` works on the current conversation without a spec, and `review-changes` works on any branch.

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

- A milestone is an increment that leaves the code working and tested, with a check the builder can run. It builds in **one repository**, since it is built, checked and squashed inside one git history. A spec's milestones sit in one **track** per repository, the folder `milestones/<repo>/`: each track numbers its milestones and tickets from `001`, and builds them in that order. A ticket names one it builds on in its own track by number, and one in another track as `<repo>/NNN`.
- A ticket is a **tracer bullet**: a thin vertical slice through every layer it needs, verifiable at a confirmed seam, and small enough for one agent with a fresh context. Prefactoring tickets come first. Wide mechanical refactors follow `WIDE-REFACTOR.md` so each batch stays green.
- A **contract change** between repositories follows `CONTRACT-CHANGE.md`: the producer adds the new shape beside the old one, each consumer moves over in its own milestone, then the producer removes the old shape. Every step leaves every repository working, since repositories deploy on their own schedules. Each consumer's move builds beside the producer's, against the shape the spec pins, and a **Lands after** line holds the order they land in; before the move squashes, the build checks its fakes against the producer's code.

You review the breakdown (boundaries, granularity, dependencies) until you approve it. Then it writes:

```
.sdd/specs/NNN-<slug>/
├── spec.md
└── milestones/
    └── <repo>/                     ← one track per repository
        └── NNN-<milestone-slug>/
            ├── milestone.md        ← Delivers, Done when, Phase, Squash, Landed, Shape
            ├── NNN-<ticket-slug>.md   ← Status: todo | doing | blocked | done, Commit: <sha>, Depends on, Notes
            └── review.md           ← written by review-changes: the findings, and the arbiter's answers to escalations
```

### 4. `/build [spec-id]`

A **spec id** is the spec folder's number (`3` or `s03`), name or path. `/build s03` builds **every milestone and then lands the spec**.

Each track works on one milestone and one ticket at a time, and the tracks run side by side, at most 5 at a time unless `parallelAgents` in the brain's `.sdd/config.json` says otherwise. A milestone is ready once the earlier milestones of its track are squashed, and any milestone of another track one of its tickets depends on. The build is one **event loop** in your session, the only place that can start sub-agents:

1. It finds each track's repository through the brain's links and asks you, in one message, to open any that is not open and clean any dirty tree, how to land: each track **as it goes**, or **at the end** after one more yes; and who decides escalated findings: the **arbiter**, or you. It resumes each milestone from its **Phase** line when an earlier build stopped partway.
2. It checks out each milestone's own branch, `sdd/<spec-folder>/M<NNN>`, created from that repository's spec branch, `sdd/<spec-folder>/spec`, and starts a fresh **builder sub-agent** in the background for the track's next ticket. The builder builds the ticket with `tdd` (red, then green, at the ticket's seams), commits with `commit`, marks the ticket `done` with its SHA and leaves notes for the next ticket. As each builder reports, the loop starts that track's next ticket at once, so a slow repository never holds the others back.
3. When a milestone's last ticket is done, it joins a closing queue. The loop closes one milestone at a time, while the other tracks keep building.
4. It runs `review-changes` over the milestone's whole diff and saves the report as the milestone's `review.md`. Every finding is fixed automatically in one pass by a **fixer** sub-agent on Sonnet, with no second review. Findings flagged **escalate** (fixes that would contradict an ADR, change an interface that code outside the diff already calls, other repositories included, or need the spec itself changed) go first to an **arbiter** sub-agent on Opus, which decides each one without asking you; when you chose to decide them yourself, the track stops there instead, and the next `/build` asks you for each answer. The hand-over lists every decision under **Decided for you**, the defaults sub-agents took for want of a user among them, so you can revert any of them. Every sub-agent's brief opens with one **Context** block, defined in `skills/brain/references/BRIEF.md`: the repository it works in, what it may change, and the notes it reads. After each builder or fixer, the build checks it wrote only there.
5. It runs the repository's full suite and the milestone's **Done when** check, once, after the fixes. A contract change's migrate waits here until its expand is squashed, then has its fakes checked against the expand's code.
6. It squashes the milestone's branch into the spec's branch as one commit, recording its SHA in `milestone.md`.

A failure stops only its own track; the others go on, and the build reports every stopped track once nothing is left to do.

Landing takes your answer from the start of the call. A track lands only between a squash and its next milestone, and only its **landable** milestones: squashed, after its earlier ones, and after every milestone their **Lands after** names. To land a track, it rebases that repository's spec branch onto its base, runs the full suite (fixing it, in up to two tries, when the base's new commits broke it), and fast-forwards the base, then records **Landed** on each milestone that landed and the landing itself on the spec's **Landings** line, the order `/pr` merges in. Once every milestone has landed, the spec gets its **Landed** line, one entry per repository, and the tickets' gotchas and the arbiter's reasons are offered as notes. Everything stays local: nothing is pushed and no PR is opened, so run `/pr <spec-id>` when you want the PRs. Because progress lives in the ticket files, the **Phase** and **Landed** lines and `review.md`, a build that stops picks up where it left off.

#### Branches and landing

Each repository holds the spec's branches under the spec folder's name: `sdd/<spec-folder>/spec`, and `sdd/<spec-folder>/M<NNN>` for each milestone of its track, squashed back into the spec branch as one commit (highlighted above). So for a contract change cut into `billing-api` M001 (expand) and M002 (contract), and `web-app` M001 and `mobile` M001 (migrate), the three M001s build side by side, against the shape the spec pins; each migrate waits at its check until the expand squashes; `billing-api` lands M001 as soon as it squashes, each migrate right after its own squash, and M002 only once both migrates have landed. Each landed milestone's **Landed** line names its own commit on the base. Each base ends with one commit per milestone, in a straight line, with no merge commit. A spec in one repository lands once, at the end.

Every pipeline branch starts with `sdd/`, so `git branch --list 'sdd/*'` finds them all in a repository. After landing, `/build` offers to delete the spec's branches in each repository.

## The build pane

While `/build` runs, **build watch**, a live pane beside the chat shows the milestone being built, where it stands, and what each sub-agent is doing and spending:

```
004 Invoice export › M002 Consume v2 · web-app
████████░░░░ 2/3 tickets
✔ tickets → ● review → ○ decide → ○ fix → ○ check → ○ squash
412.0k tokens · agents 380.0k · main session 32.0k · 4 agents
  ✔ 001 Read rows                 61.0k tok · 4m10s · a1b2c3d
  ◐ 002 Map columns               22.3k tok · 1m15s
      ↳ Edit src/columns.ts
```

- **The milestone.** As soon as a sub-agent's brief or a tool call names a path under the brain's `.sdd/specs/<spec>/milestones/<milestone>/`, the pane follows that milestone: each ticket's **Status** and **Commit**, and the **Phase** line as `/build`'s stages (tickets, review, decide, fix, check, squash).
- **Each sub-agent.** Its role (`builder`, `fixer`, `reviewer`, `arbiter`, `scout`, `scribe`…), the repository its brief works in, the ticket it builds or its job in the phase, elapsed time, steps, tool calls, tokens, model and what it is doing now. Press a row to open that agent's transcript. In VS Code and the desktop app each row starts with a pixel critter dressed for its role.
- **What the milestone cost.** Tokens per ticket, the sub-agents' total and the main session's own requests, saved per milestone so the totals carry across `/build` calls and sessions.
- **A status line** under the prompt, such as `⚙ M002 web-app 2/3 tickets · review · 1 agent running · 412.0k tok`.

Open it with `/build-watch`; it also opens by itself when a sub-agent starts or a milestone is picked up. It only reads `.sdd/`. `hooks/register.tsx` is the module, `hooks/register.test.tsx` its tests (`claude plugin test .`), and `types/index.d.ts` the state it keeps.

## The brain

Everything about the brain runs through `/brain`, and its first argument picks what it does:

| Command | What it does |
|---|---|
| `/brain setup` | Clones or creates a brain, then registers a repository in it: its card, its layout, its agent-file section, and its old `.sdd/` moved over. Run it once per brain on each machine, then once per repository. |
| `/brain link` | Finds this machine's clone of each registered repository and records where it is. Linking opens nothing. |
| `/brain explore [<repo>]` | Reads a repository's default branch, one scribe sub-agent per area in parallel, and writes what it does as notes a product owner or a newcomer can read without the code: a `feature` note per capability with its rules, `concept` notes for its flows and data, and an overview in its card. Each note is stamped with the commit it was read at. Without a repository, it explores every linked one whose notes are missing or behind. A rerun reads only the areas that changed. |
| `/brain status` | Every repository (unlinked, linked or open, dirty, unpushed, and whether its explored notes are behind) and every in-flight spec with its state, risks first: blocked or failed builds, specs waiting on a dependency, and contract changes whose consumers the spec leaves out. |
| `/brain ask <question>` | Answers a question that crosses repositories: recalls the notes, sends one scout per repository in parallel, answers with citations from each, and offers what the notes lacked as new notes. Asking is how an empty brain fills up. |
| `/brain view` | Opens the brain page: every brain you add, each with its **Specs** (milestones, tickets, reviews and diagrams, live), its **Map** (each repository as a hub, only those the specs in flight name unless you show all specs, ringed by what it is being built into, the specs in flight at the centre, work moving live along the lines) and its **Notes** (a graph of every note and `[[link]]`, clustered round repository hubs, or a list). Needs Chrome or Edge. |
| `/brain recall` | Reads the notes bearing on the current work. Skills do this on their own. |
| `/brain remember <fact>` | Proposes a note and commits it once you confirm. |
| `/brain sync` | Pulls with rebase, merges any note two people changed, then pushes. Nothing is pushed until you run it. |

Each note holds one fact: frontmatter with `name`, a one-line `description` and a `type` (`feature`, `concept`, `decision`, `gotcha`, `contract`, `how-to`), then the fact, linked to related notes with `[[name]]`. A note is **authored**, holding what the code cannot tell you (a reason, a trap, a contract), or **explored**, holding what the code does, for teammates who never open it. Explored notes carry the commit they were read at, so `/brain ask` and `/brain status` can say when they fall behind. Teammates who don't code need to clone only the brain. Obsidian can open the brain as a vault.

The pipeline uses the brain throughout. Every skill that reads the glossary and ADRs also reads the brain's notes on the repositories it works in. A `contract` note records which repositories consume an interface: a change to it becomes a question in `brainstorm`, a confirmed item in `to-spec`, an overlap in the in-flight check, an **escalate** flag in `review-changes`, and a one-way door in `pr`, with those repositories in its blast radius. Knowledge flows back as proposals you pick from: `diagnose` offers the root cause as a gotcha, landing a spec offers the tickets' gotchas and the arbiter's reasons, `onboard` offers undocumented dependencies on other repositories as contracts, `research` offers its verified answer, and `/brain ask` offers whatever the notes lacked.

## Skills used along the way

| Skill | Role |
|---|---|
| `tdd` | Red then green, one vertical slice at a time, with tests only at confirmed seams. Runs the suites the repository's card names. |
| `commit` | `<KEY>: <Present-tense title>` plus one to three bullets. Reads the key from the spec, or the repository's card. |
| `review-changes` | Reviews a diff in separate sub-agents. **Standards** checks repo docs, glossary, ADRs and the smell baseline. **Spec** checks for missing requirements, scope creep and requirements built wrong. **Consumers**, when the diff changes a contract, sends a scout into each linked consumer repository and escalates every call site the change breaks. A whole spec gets one Standards reviewer per repository and one Spec reviewer across them all. Saves the report as `review.md` in the milestone's folder, or the spec's when it reviews the whole spec. |
| `pr` | Writes a PR's title and body: a visual **Summary**, before-and-after **Evidence** checked against the spec's claims, and a **Merge Danger** call (one-way or two-way door, blast radius from the contract notes and a scout per consumer). A spec across repositories gets one PR per landing, cross-linked under **Merge Order** in the order they must merge and deploy. It opens or updates the PRs only when you ask. |
| `domain-modeling` | Maintains each repository's `GLOSSARY.md` and ADRs, including multi-context repos with `GLOSSARY-MAP.md`. |
| `design-patterns` | A catalogue of patterns and when to choose each one. Each choice is recorded as Pattern, Where and Why. |
| `project-structure` | One hexagonal layout for every language: `domain/` (entities, value objects, ports), `application/` (use cases, services, DTOs), `infrastructure/` (driving, driven, config). Covers role-suffixed names for TypeScript, Python and Java, and frontend, backend and full-stack apps. The repo's `docs/STRUCTURE.md` overrides it. |
| `codebase-design` | Vocabulary for deep modules: module, interface, seam, adapter, depth. |
| `writing-for-agents` | How to write skills, `CLAUDE.md` and `AGENTS.md`. Used when editing this repo. |
| `diagnose` | Diagnoses a hard bug or performance regression. It first builds a tight loop that goes red on the bug, then minimises the repro, ranks falsifiable hypotheses, and instruments one variable at a time. It fixes with a regression test at a correct seam, or records that no such seam exists. |
| `brain` | The hub, behind one command: `setup`, `link`, `explore`, `status`, `ask`, `view`, `recall`, `remember` and `sync`. On its own, it reads a repository's notes before work and proposes a note when it learns something the repository doesn't record. It syncs only when you ask. |
| `research` | Researches a question against primary sources in a background sub-agent. Saves the cited findings to the brain's `.sdd/research/<slug>.md`. |
| `prototype` | Builds a throwaway prototype that answers one design question: a shareable HTML demo for logic, or switchable variants for UI, each drafted in parallel by its own designer sub-agent. Keeps a UI prototype on a `prototype/<slug>` branch and a logic one in the brain's `.sdd/prototypes/`, and records the verdict in the spec and as a brain decision. |
| `improve-and-refactor` | Scans hot spots for deepening and smell refactors, shows them as an HTML report saved to the brain's `.sdd/refactors/<slug>/`, and brainstorms the one you pick. A contained refactor goes straight to `/to-tickets` and `/build`; a larger one starts at `/to-spec`. |
| `onboard` | Tours one repository for a newcomer who will code in it, one scout per area in parallel, starting from the brain's notes on it, then traces the two or three journeys that cross the most areas, following them into linked neighbours. Writes the tour to the brain's `.sdd/tours/<slug>/`: a context map with the neighbouring repositories, the journeys, a card per area, where things live, the vocabulary and the commands. Then offers to record the terms, decisions and contracts it found undocumented. |

The pipeline skills (`brainstorm-with-docs`, `to-spec`, `to-tickets`, `build`), `improve-and-refactor`, `onboard` and `pr` only run when you type their command. The others can also be invoked by the agent when it needs them.

## Moving from alper-skills

Install alper-brain in place of alper-skills, then run `/brain setup` in a brain with each repository open. Setup moves the repository's `.sdd/` into the brain's: each spec keeps its folder name unless its number is taken (then it is renumbered, and its branches renamed), gains its **Repos** line, its milestones move into that repository's track, and its research, tours and refactor reports come along. The commit key from `.sdd/settings.json` moves to the repository's card, and the **Spec workflow** section of its agent file becomes a **Second brain** section. The dashboard and the graph page are now the one brain page, `/brain view`. The alper-flow mod is built in as the build pane, now opened with `/build-watch`: uninstall `alper-flow@alper-mods`.

A spec ticketed before tracks keeps its milestones straight under `milestones/`, each naming its repository on a **Repo** line. The brain page and the build pane read it as it is, and the next `/build` on it moves it into tracks first: it renumbers each track's milestones and tickets from `001`, rewrites the **Depends on** lines and renames the milestone branches. A PR branch (`sdd/<spec>/pr-M<NNN>`) keeps its old number.

## Repository layout

```
.claude-plugin/   plugin.json and marketplace.json
skills/<name>/    SKILL.md plus any reference files it points to
agents/           the sub-agents the skills dispatch, each pinned to a model
hooks/            the build pane: hooks.json names register.tsx, the hooks module
types/            the build pane's state contract
evals/            behaviour checks for the skills (claude plugin eval), by evals/README.md
scripts/          check-refs.mjs: every "FILE.md's **Section**" reference resolves
docs/DESIGN.md    why the brain became the hub
docs/TRACKS.md    why a spec's milestones run in one track per repository
```
