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
~/brains/acme/                       ← the brain's repository: launch Claude here
├── CLAUDE.md                          the agent file, pointing at the brain
└── .brain/                            the brain: every kind of brain lives in a `.brain/` folder
    ├── BRAIN.md                       what it is, how to join, the repositories it covers, its kind
    ├── .gitignore                     the one line `.local/`: everything outside it is shared
    ├── repos/<slug>.md                the repository's card (its remote, commit key pattern and test commands)
    ├── notes/
    │   ├── repos/<slug>/              the notes about one repository: team notes, and what its code does, from `/brain explore`
    │   ├── shared/                    team notes across several repositories
    │   └── research/                  cited findings from `research`
    ├── docs/
    │   ├── repos/<slug>/              onboarding tours, refactor reports and HTML pages from `html` on this repository
    │   ├── shared/                    HTML pages from `html` on no single repository
    │   └── prototypes/                logic prototypes, one home even across repositories
    └── .local/                        this machine's own, never shared
        ├── config.json                this machine's limits, such as how many tracks build at once
        ├── repos.json                 where each repository is cloned here
        ├── drafts/                    notes waiting for `/brain sync`
        ├── specs/                     specs, milestones, tickets and reviews, across repositories
        └── snapshots/  explore/  locks/  handoff/    default-branch checkouts, scratch, claims and handoffs
```

- **Knowledge is shared, work stays local.** The `.brain/.gitignore` is the one line `.local/`, which keeps this machine's files out of git; everything else is committed and shared by pull and push: the cards, the notes, research and the docs (tours, refactor reports, pages and prototypes). Specs and tickets stay in `.local/` on your machine; what they teach reaches the team as notes.
- **You work from the brain.** Claude is launched in the folder holding the brain's `.brain/`, so it always knows where the brain is. The repositories the work needs are opened beside it.
- **Each repository moves through three states.** **Registered**: the brain holds its `repos/<slug>.md` card (its remote, commit key pattern and test commands), so its notes and specs work. **Linked**: the brain knows where it is cloned on this machine, so skills can read its code. **Open**: it is open in the session, so skills can change it. Skills ask you to open a repository (`/add-dir <path>`) when they need to change it.
- **Or embed it in a single repository.** A project that is one repository can keep its brain in that repository's `.brain/` folder instead: you launch Claude in the repository, and the notes are committed on your current branch and ship with the code. `/brain export` later moves the brain, history included, into a repository of its own, so it can cover more.
- **Or keep it local, just for you.** A local brain sits in the repository's `.brain/` folder too, which the repository's git ignores through `.git/info/exclude`. It is a git repository of its own that is never pushed, so every skill works and nothing reaches the repository's history. A skill that finds no brain offers to create one. `/brain export` moves it out when you want to share it.
- **One brain per knowledge base.** A company, a client, your side projects: each gets its own brain, with its own notes and remote. Nothing crosses between them.

`skills/brain/references/FORMAT.md` defines all of it.

## Getting started

1. **Create or clone a brain.** Run `/brain setup` anywhere. It clones your team's brain or creates one, and tells you to launch Claude in it from then on. Run inside a repository, it can embed the brain there or keep a local one there instead, and registers that repository in the same run.
2. **Register each repository.** In the brain, with a repository open (`/add-dir <path>`), run `/brain setup` again. It writes the repository's card (commit key, unit and e2e commands), settles its layout in `docs/STRUCTURE.md`, points its `CLAUDE.md` or `AGENTS.md` at the layout and, in one `# References` line, at the brain for terms and decisions ("Terms and decisions: the second brain `<name>` (`<remote>`), read through the `brain` skill", or "on this machine only" for a local brain), and moves its old `.sdd/` into the brain if it has one.
3. **Link the rest.** `/brain link` finds this machine's clones of every registered repository.
4. **Explore them.** `/brain explore` writes what each linked repository does into the brain, so teammates who never clone the code can ask about it. `/brain sync` shares the notes.
5. **Look around.** `/brain status` reports everything in flight, `/brain view` opens the brain page, and `/brain ask <question>` answers questions that cross repositories.

## The pipeline

```
/brainstorm  ──────────────  a shared understanding: What, then How
        │
/write-spec  ─────────────────  .brain/.local/specs/NNN-<slug>/spec.md, naming the repositories it changes
        │
/write-tickets  ──────────────  one track of milestones per repository, with tickets
        │
/build  (one frontier per call: each track's next milestone) ┐
   ├─ branch sdd/<spec>/M<NNN> in each track's repository
   ├─ per track: one background builder at a time → tdd → commit
   └─ per milestone, one at a time, while the tracks build:   ┘
        review-changes → arbiter decides escalations → fix
        → check the milestone's "Done when" → squash into sdd/<spec>/spec
        → land the track once it has no open milestone
        │
   /clear, then /build again for the next frontier; once every milestone is in
   └─ land the rest → record the spec's landing → offer what was learned as notes
```

Each stage writes files the next one reads, and each ends by telling you the next command to run. The files carry Mermaid diagrams so you can take them in at a glance: the spec has the user's **journey** and a **module map**, grouped by repository when it spans several, each milestone its slice of that map, each ticket its **tracer bullet** path through the layers, and each review a **finding map** of where its findings land. `skills/write-spec/references/DIAGRAMS.md` defines them, and the brain page draws them. You can stop between any two stages, or join partway through. For example, `/write-tickets` works on the current conversation without a spec, and `review-changes` works on any branch.

### 1. `/brainstorm [topic]`

The agent interviews you, one round of questions at a time, until you share an understanding. It first infers what kind of brainstorm this is, and the kind decides how it ends:

- a **feature** closes with the lists `/write-spec` reads;
- a **skill or agent** closes with its design, to write by `write-for-agents`;
- a **decision** closes with the options, the choice and its reason, to record as a `decision` note;
- an **exploration** closes with the ideas kept and dropped, to save as a page or a note.

The decisions form a **design tree** with two phases:

- **What** comes first: the problem, scope, behaviour, constraints and what success looks like.
- **How** comes second: the approach, architecture, data and design patterns (via `code-design`).

Each round asks every question that can be answered *now*, with options and a recommended answer, so replying `ok` accepts all the recommendations. When a question depends on a fact about the codebase, the agent looks it up instead of asking you. For a feature, it reads the brain's notes on every repository the topic touches first, and each contract the design would change becomes a question: do its consumers change too, or does the interface stay compatible? Each phase ends with a summary for you to confirm.

When a brainstorm settles a repository's domain (every feature, and decisions or explorations about its business), it adds a **domain lens** to the interview. Terms are challenged against each repository's term notes and written down as they settle, and decisions that are hard to reverse are offered for recording. The brain is their home: a term becomes a `term` note with the words to avoid for it, and a decision a `decision` note. `/brain explore` absorbs the term lists and decision records a repository already keeps into those notes, so recall finds every term and decision in one place, and the repository's agent file names the brain for them.

### 2. `/write-spec`

Turns the conversation into `.brain/.local/specs/NNN-<slug>/spec.md` in the brain. Its **Repos** line names the repositories it changes, and specs are numbered in one sequence across all of them. The spec contains only what the conversation settled. Each question left open comes with a recommended answer, for you to settle now or record as open. Before writing, the agent proposes two things for you to confirm:

- the **seams** where tests will prove the feature works, as few as possible
- the **design patterns**, if the brainstorm never weighed them

It also asks for the spec's commit key: one key, or one per repository when their patterns differ.

When another **in-flight** spec (one not landed yet) changes the same modules, or a contract the new work's repositories share, the new spec **depends on** it: it is designed against that spec's planned state, lists what it assumes under **Relies On**, and `/build` waits until the dependency lands and those assumptions still hold. In-flight checks see every spec in the brain, whatever repository it changes. A spec that will never be built carries an `**Abandoned:** <reason>` line: it stops counting as in-flight, `/build` refuses it, and the brain page greys it out.

### 3. `/write-tickets [spec-id]`

Breaks the spec into ordered **milestones**, and each milestone into **tickets**:

- A milestone is an increment that leaves the code working and tested, with a check the builder can run. It builds in **one repository**, since it is built, checked and squashed inside one git history. A spec's milestones sit in one **track** per repository, the folder `<repo>/` straight in the spec folder: each track numbers its milestones and tickets from `001`, and builds them in that order. A ticket names one it builds on in its own track by number, and one in another track as `<repo>/NNN`.
- A ticket is a **tracer bullet**: a thin vertical slice through every layer it needs, verifiable at a confirmed seam, and small enough for one agent with a fresh context. Prefactoring tickets come first. Wide mechanical refactors follow `WIDE-REFACTOR.md` so each batch stays green.
- A **contract change** between repositories follows `CONTRACT-CHANGE.md`: the producer adds the new shape beside the old one, each consumer moves over in its own milestone, then the producer removes the old shape. Every step leaves every repository working, since repositories deploy on their own schedules. Each consumer's move builds beside the producer's, against the shape the spec pins, and a **Lands after** line holds the order they land in; before the move squashes, the build checks its fakes against the producer's code.

You review the breakdown (boundaries, granularity, dependencies) until you approve it. Then it writes:

```
.brain/.local/specs/NNN-<slug>/
├── spec.md
└── <repo>/                         ← one track per repository
    └── NNN-<milestone-slug>/
        ├── milestone.md            ← Delivers, Done when, Builds after, Lands after, Phase, Squash, Landed, Shape
        ├── NNN-<ticket-slug>.md    ← Status: todo | doing | blocked | done, Commit: <sha>, Depends on, Notes
        └── review.md               ← written by review-changes: the findings, and the arbiter's answers to escalations
```

### 4. `/build [spec-id]`

A **spec id** is the spec folder's number (`3` or `s03`), name or path. `/build s03` builds the spec's next **frontier**: each repository's next milestone that is ready. Run it again, after `/clear`, for the next frontier, until the spec has landed. Each call ends by naming the next frontier, so a long spec never outgrows one session's context, and a call cut off partway, by a usage limit or a closed session, resumes where it stopped.

Each track works on one milestone and one ticket at a time, and the tracks run side by side, at most 5 at a time unless `parallelAgents` in the brain's `.brain/.local/config.json` says otherwise. A milestone is ready once the earlier milestones of its track are squashed, and every milestone of another track its **Builds after** names. Tracks wait on each other only at milestones: a ticket depends only on tickets of its own track. The cap limits how many tracks build at once, never the frontier: a milestone waiting for a slot takes the next one free. Each call is one **event loop** in your session, the only place that can start sub-agents:

1. It finds each track's repository through the brain's links and asks you, in one message, to open any that is not open and clean any dirty tree, for the base, and its next version, of any that has a [release branch](#release-branches), and for your answers to any escalated finding waiting on you. The **arbiter** decides escalated findings unless your command says you decide them, as in `/build s03 — I decide escalations`. It resumes each milestone from its **Phase** line when an earlier build stopped partway.
2. It checks out each milestone's own branch, `sdd/<spec-folder>/M<NNN>`, created from that repository's spec branch, `sdd/<spec-folder>/spec`, and starts a fresh **builder sub-agent** in the background for the track's next ticket. The builder builds the ticket with `tdd` (red, then green, at the ticket's seams), commits with `commit`, marks the ticket `done` with its SHA and leaves notes for the next ticket. As each builder reports, the loop starts that track's next ticket at once, so a slow repository never holds the others back.
3. When a milestone's last ticket is done, it joins a closing queue. The loop closes one milestone at a time, while the other tracks keep building.
4. It runs `review-changes` over the milestone's whole diff and saves the report as the milestone's `review.md`. The reviewers mark each judgement call **fix** or **keep**; every hard violation, Spec finding and judgement call marked **fix** is fixed automatically in one pass by a **fixer** sub-agent on Sonnet, with no second review, and a milestone with nothing to fix skips the fixer. Findings flagged **escalate** (fixes that would contradict a decision, change an interface that code outside the diff already calls, other repositories included, or need the spec itself changed) go first to an **arbiter** sub-agent on Opus, which decides each one without asking you; when your command says you decide them, the track stops there instead, and the next `/build` asks you for each answer. The hand-over lists every decision under **Decided for you**, the defaults sub-agents took for want of a user among them, so you can revert any of them. Every sub-agent's brief opens with one **Context** block, defined in `skills/brain/references/BRIEF.md`: the repository it works in, what it may change, and the notes it reads. After each builder or fixer, the build checks it wrote only there.
5. It runs the repository's full suite and the milestone's **Done when** check, once, after the fixes. A contract change's migrate waits here until its expand is squashed, then has its fakes checked against the expand's code.
6. It squashes the milestone's branch into the spec's branch as one commit, recording its SHA in `milestone.md`.

A failure stops only its own track; the others go on, and the call reports every stopped track once its frontier is done, with what you can do about each (change the ticket and rerun, build it by hand and tell `/build <spec-id> — <ticket> done at <SHA>`, or amend the spec), then names the next frontier.

A track lands, without asking, once it has no open milestone left, and only its **landable** milestones: squashed, after its earlier ones, and after every milestone their **Builds after** or **Lands after** names. To land a track, it rebases that repository's spec branch onto its base, runs the full suite (fixing it, in up to two tries, when the base's new commits broke it), and fast-forwards the base, then records **Landed** on each milestone that landed and the landing itself on the spec's **Landings** line, the order `/open-pr` merges in. Once every milestone has landed, the spec gets its **Landed** line, one entry per repository, and the tickets' gotchas and the arbiter's reasons are offered as notes. Everything stays local: nothing is pushed and no PR is opened, so run `/open-pr <spec-id>` when you want the PRs. Because progress lives in the ticket files, the **Phase** and **Landed** lines and `review.md`, a build that stops picks up where it left off.

#### Branches and landing

Each repository holds the spec's branches under the spec folder's name: `sdd/<spec-folder>/spec`, and `sdd/<spec-folder>/M<NNN>` for each milestone of its track, squashed back into the spec branch as one commit (highlighted above). So for a contract change cut into `billing-api` M001 (expand) and M002 (contract), and `web-app` M001 and `mobile` M001 (migrate), the three M001s build side by side, against the shape the spec pins; each migrate waits at its check until the expand squashes; `billing-api` lands M001 as soon as it squashes, each migrate right after its own squash, and M002 only once both migrates have landed. Each landed milestone's **Landed** line names its own commit on the base. Each base ends with one commit per milestone, in a straight line, with no merge commit. A spec in one repository lands once, at the end.

Every pipeline branch starts with `sdd/`, so `git branch --list 'sdd/*'` finds them all in a repository. After landing, `/build` offers to delete the spec's branches in each repository.

#### Release branches

When a spec's base is first defined in a repository that has `rlse/vX.Y.Z` branches, `/build` asks whether to start from the default branch or from the most recent release branch (the highest version, local or on `origin` as you last fetched it). From a release branch it also suggests the next version (patch, minor or major, one of them recommended from the spec) or keeping the branch as it is. You can answer up front, as in `/build s03 — main` or `/build s03 — rlse, minor`. A repository without release branches keeps its default, without a question. Whatever you pick must hold what the spec's dependencies landed. A release branch that is behind `origin` is fast-forwarded first. When you accept a version, `/build` creates that branch (`rlse/v1.2.3` → `rlse/v1.3.0`, or takes it when it already exists), raises the version in the files that declare it (`package.json`, `pom.xml` and the like, with their modules and lockfile entries), commits that on the new branch, and builds and lands the spec there. The new branch stays local. When you ask `/open-pr` to open the PR, it shows you what creating that branch on the remote would push and asks first, so the PR holds only the spec's commits.

A spec that lands on a release branch is on that release only, so at the hand-over `/build` offers to port it to the default branch, and `/open-pr` opens that port's PR.

#### One build per repository

A repository has one working tree, so a `/build` claims each repository it changes in the brain's `.brain/.local/locks/`, and releases the claims when the call ends. A build of another spec that needs a claimed repository stops and asks you whether the first build still runs. `/brain status` shows each claim.

#### Changing or stopping a spec

- `/write-tickets <spec-id> --amend` changes a spec that is already ticketed or building. Work already built stays as it is: every squashed or closing milestone, and every ticket past `todo`. The change goes into the open tickets and milestones, and into new ones numbered after the highest.
- `/build <spec-id> --abandon <reason>` stops a spec for good. It writes the **Abandoned** line, deletes the spec's branches, and lists the milestones that already landed, whose work stays on the base.

### 5. After the PRs

`build` lands on your local base only. Once `/open-pr <spec-id>` has opened the PRs:

- `/open-pr <spec-id> --comments` gathers the review comments on the open PRs. You mark each one fix, reply or skip. A fixer commits the fixes on the PR's branch, and once you agree, the PR gets the push and one reply.
- `/open-pr <spec-id> --merged` records that the PRs merged. It brings each local base level with `origin`, and after a squash or rebase merge it drops the local copies of the squashes once you agree. Then it writes the spec's **Merged** line. A spec that depends on this one builds only once its **Merged** line names every repository that has a remote. `/brain status` lists the landed specs still waiting for their merge.

## Agent Watcher

**Agent Watcher** is a live pane beside the chat that shows what the session spends and what each agent is doing. It opens with the session and again whenever a sub-agent starts; `/watcher` opens it too, and `/watcher <theme>` switches its look: `ember`, `gold`, `tide`, `slate`, `dusk` or `mono`. The theme you pick is kept for the next session.

- **Tokens.** A ring gauge of how full the main session's context window is (its last request against the model's window, red from 85%, when compaction nears), and the mix of the session's input, output, cache reads and cache writes.
- **Areas.** What share of the tokens went to each area, a bar per area; an area glows while an agent works in it.
- **Tokens per minute.** The last few hours as a curve, the latest minute tagged.
- **Brain.** With a brain open, a strip of its counts: notes, registered repositories, specs in flight and landed, and drafts waiting for `sync`.
- **Building.** Each ticketed spec in flight, a row per track: a segment per milestone (dim once landed, filling with its tickets while it builds), the milestone and its tickets, and where it stands: `ready`, `building`, a closing step such as `review`, `landing`, or, in red, `waits on you`, `blocked` or `check failed`.
- **Agents.** The main session and each sub-agent: its area, what it is doing now (`edit register.tsx`, `run npm test`), its tokens and how long it has run. The latest six finished stay listed.

| Area | What counts there |
| --- | --- |
| Review | every call of a reviewer's or an arbiter's agent |
| Git | `git` and `gh` commands |
| Brain | reading or editing under `.brain/`, and `sdd` commands |
| Tests | test runs (`npm test`, `pytest`, `go test`…) |
| Shell | any other `Bash` or `PowerShell` command |
| Code | editing code |
| Read | reading or searching code |
| Docs | reading or editing documents (`.md`, `.txt`…) |
| Web | `WebSearch`, `WebFetch` and MCP tools |
| Think | a turn with no tool call, and any other tool |

A turn's tokens are split evenly across the areas of its tool calls. Narrow, the pane stacks its cards and lists the areas as rows; wide, the gauge and the areas sit side by side. The pane finds the brain from the session's folder, or from the first path a tool call names inside one, and reads its files again every 30 s and after each turn; it only reads. The terminal draws no pictures, so there it is a list: the areas by share, each track, then each agent.

`hooks/register.tsx` is the module and its bookkeeping, `hooks/brain.ts` what it reads from the brain, `hooks/draw.ts` the drawing and the themes, `hooks/register.test.tsx` its tests (`claude plugin test .`), and `types/index.d.ts` the state it keeps. The drawing is one Svg under the 128 KB an Svg holds. The editor draws that Svg as an image, which reloads whenever its source changes: so the drawing changes at most once every 2 s, and its clocks move by the minute.

## The brain

Everything about the brain runs through `/brain`, and its first argument picks what it does:

| Command | What it does |
|---|---|
| `/brain setup` | Clones or creates a brain, then registers a repository in it: its card, its layout, its agent-file section, and its old `.sdd/` moved over. Run it once per brain on each machine, then once per repository. |
| `/brain link` | Finds this machine's clone of each registered repository and records where it is. Linking opens nothing. |
| `/brain explore [<repo>]` | Reads a repository's default branch, one scribe sub-agent per area in parallel, and writes what it does as notes a product owner or a newcomer can read without the code: a `feature` note per capability with its rules, `concept` notes for its flows and data, and an overview in its card. Each note is stamped with the commit it was read at. Without a repository, it explores every linked one whose notes are missing or behind. A rerun reads only the areas that changed. |
| `/brain tour [<repo>]` | Tours one repository for a newcomer who will code in it. It offers `/brain explore` first when the explored notes are behind, then starts from them: one explorer per area in parallel, spending its reads on how the code is built, then traces the two or three journeys that cross the most areas, following them into linked neighbours. Writes the tour to the brain's `.brain/docs/repos/<slug>/`, as `<YYYY-MM-DD-HHmm>-tour.html`: a context map with the neighbouring repositories, the journeys, a card per area, where things live, the vocabulary and the commands. Then offers to record the terms, decisions and contracts it found undocumented. |
| `/brain status` | Every repository (unlinked, linked or open, dirty, unpushed, and whether its explored notes are behind) and every in-flight spec with its state, risks first: blocked or failed builds, specs waiting on a dependency, and contract changes whose consumers the spec leaves out. It also lists landed specs whose PRs have not merged, and the spec that claims each repository. |
| `/brain ask <question>` | Answers a question that crosses repositories: recalls the notes, sends one explorer per repository in parallel, answers with citations from each, and offers what the notes lacked as new notes. Asking is how an empty brain fills up. |
| `/brain view` | Opens the brain page: every brain you add, each live on five screens. **Overview** shows what is in flight, a heatmap of every ticket, the specs in dependency waves and what needs you; a spec opens on its own page, its milestones a pipeline with a lane per repository. **Board** is a kanban of specs or milestones, **Notes graph** draws every note and `[[link]]` in a force layout with tunable forces, **Domain** draws the canonical terms as a graph, their relations labelled with verbs and each decision linked to its terms, with each repository's word for a term in the inspector (it needs the server), and **Activity** lists the brain's commits. The document you select, reviews and diagrams included, reads in a panel over the screen. Needs Chrome or Edge. |
| `/brain recall` | Reads the notes bearing on the current work. Skills do this on their own. |
| `/brain remember <fact>` | Drafts a note for the next `/brain sync` to propose and commit. |
| `/brain sync` | Pulls with rebase, consolidates the notes drafted on this machine (you confirm each) and commits them, asking once per repository for a commit key, then pushes. Nothing is pushed until you run it. |

Each note holds one fact: frontmatter with `name`, a one-line `description`, a `type` (`feature`, `concept`, `decision`, `how-to`, `contract`) and a `layer` (`business` for what the product does and why, `application` for how the system is built), then the fact, linked to related notes with `[[name]]`. A note is **authored**, holding what the code cannot tell you (a reason, a trap, a contract), or **explored**, holding what the code does, for teammates who never open it. Explored notes carry the commit they were read at, so `/brain ask` and `/brain status` can say when they fall behind. Teammates who don't code need to clone only the brain. Recall runs `skills/brain/scripts/recall.mjs`, which filters the notes by repository and layer and ranks them against the work, so a skill reads a short list instead of every note. Obsidian can open the brain as a vault.

The pipeline uses the brain throughout. Every skill reads a repository's terms and decisions from the brain, with the rest of the brain's notes on it. A `contract` note records which repositories consume an interface: a change to it becomes a question in `brainstorm`, a confirmed item in `write-spec`, an overlap in the in-flight check, an **escalate** flag in `review-changes`, and a one-way door in `open-pr`, with those repositories in its blast radius. Knowledge flows back as proposals you pick from: `diagnose` offers the root cause as a `how-to`, landing a spec offers the tickets' gotchas and the arbiter's reasons, `/brain tour` offers undocumented dependencies on other repositories as contracts, `research` offers its verified answer, and `/brain ask` offers whatever the notes lacked.

## Skills used along the way

| Skill | Role |
|---|---|
| `tdd` | Red then green, one vertical slice at a time, with tests only at confirmed seams. Runs the suites the repository's card names. |
| `commit` | `<KEY>: <Present-tense title>` plus one to three bullets. Reads the key from the spec, or the repository's card. |
| `review-changes` | Reviews a diff in separate sub-agents. **Standards** checks repo docs, the brain's terms and decisions, and the smell baseline. **Spec** checks for missing requirements, scope creep and requirements built wrong. **Consumers**, when the diff changes a contract, sends an explorer into each linked consumer repository and escalates every call site the change breaks. A whole spec gets one Standards reviewer per repository and one Spec reviewer across them all. Saves the report as `review.md` in the milestone's folder, or the spec's when it reviews the whole spec. |
| `open-pr` | Writes a PR's title and body: a visual **Summary**, before-and-after **Evidence** checked against the spec's claims, and a **Merge Danger** call (one-way or two-way door, blast radius from the contract notes and an explorer per consumer). A spec across repositories gets one PR per landing, cross-linked under **Merge Order** in the order they must merge and deploy. It opens or updates the PRs only when you ask. Then `--comments` answers the PRs' review comments and `--merged` records their merge. |
| `code-design` | The shape of code, as three references sharing one vocabulary, each read only when its work comes up. **Module design**: deep modules (module, interface, seam, adapter, depth) and design it twice. **Design patterns**: a catalogue and when to choose each, recorded as Pattern, Where and Why. **Project structure**: one hexagonal layout for every language, with role-suffixed names for TypeScript, Python and Java and frontend, backend and full-stack apps; the repo's `docs/STRUCTURE.md` overrides it. |
| `write-for-agents` | How to write skills, agent definitions, briefs, `CLAUDE.md` and `AGENTS.md`. Used when editing this repo. |
| `diagnose` | Diagnoses a hard bug or performance regression. It first builds a tight loop that goes red on the bug, then minimises the repro, ranks falsifiable hypotheses, and instruments one variable at a time. It fixes with a regression test at a correct seam, or records that no such seam exists. |
| `brain` | The hub, behind one command: `setup`, `link`, `explore`, `tour`, `status`, `ask`, `view`, `recall`, `remember` and `sync`. On its own, it reads a repository's notes before work and drafts a note when it learns something the repository doesn't record, for `sync` to consolidate. It syncs only when you ask. |
| `research` | Researches a question against primary sources in a background sub-agent. Saves the cited findings to the brain's `.brain/notes/research/<slug>.md`. |
| `prototype` | Builds a throwaway prototype that answers one design question: a shareable HTML demo for logic, or switchable variants for UI, each drafted in parallel by its own designer sub-agent. Keeps a UI prototype on a `prototype/<slug>` branch and a logic one in the brain's `.brain/docs/prototypes/`, and records the verdict in the spec and as a brain decision. |
| `refactor` | Scans hot spots for deepening and smell refactors, shows them as an HTML report saved to the brain's `.brain/docs/repos/<slug>/`, as `<YYYY-MM-DD-HHmm>-refactors.html`, and brainstorms the one you pick. A contained refactor goes straight to `/write-tickets` and `/build`; a larger one starts at `/write-spec`. |
| `html` | Shows any output as a self-contained HTML page in the report theme of the tours and refactor reports: "audit the auth flow, as HTML". Saves it to the brain's `.brain/docs/repos/<slug>/`, or `.brain/docs/shared/` when it covers no single repository, and opens it. |

The pipeline skills (`write-spec`, `write-tickets`, `build`), `refactor` and `open-pr` only run when you type their command. The other actions can also be invoked by the agent when it needs them. The skills other skills run as a step (`tdd`, `review-changes`) and the reference skills (`code-design`, `write-for-agents`) stay out of the slash menu: the agent and other skills load them, and you ask for one in words ("review this branch", "build this test-first").

## Moving from 1.x

2.0 names every command for its action: `/to-spec` is now `/write-spec`, `/to-tickets` is `/write-tickets`, `/pr` is `/open-pr`, `/improve-and-refactor` is `/refactor`, and `/brainstorm-with-docs` is `/brainstorm --docs`. `tdd`, `review-changes`, `model-domain` (formerly `domain-modeling`) and the reference skills (`codebase-design`, `design-patterns`, `project-structure` and `agent-writing`, formerly `writing-for-agents`) leave the slash menu: the agent still loads them when the work calls for them, and you can ask for one in words. Specs, notes and branches are unchanged.

## Moving from alper-skills

Install alper-brain in place of alper-skills, then run `/brain setup` in a brain with each repository open. Setup moves the repository's `.sdd/` into the brain's: each spec keeps its folder name unless its number is taken (then it is renumbered, and its branches renamed), gains its **Repos** line, its milestones move into that repository's track, and its research, tours and refactor reports come along. The commit key from `.brain/settings.json` moves to the repository's card, and the **Spec workflow** section of its agent file is removed. The dashboard and the graph page are now the one brain page, `/brain view`. The alper-flow mod is replaced by the Agent Watcher pane, opened with `/watcher`: uninstall `alper-flow@alper-mods`.

A spec ticketed before tracks keeps its milestones straight in the spec folder, each naming its repository on a **Repo** line. The brain page reads it as it is, and the next `/build` on it moves it into tracks first: it renumbers each track's milestones and tickets from `001`, rewrites the **Depends on** lines and renames the milestone branches. A PR branch (`sdd/<spec>/pr-M<NNN>`) keeps its old number. A spec whose tickets depend on another track's tickets, from before **Builds after**, has those waits moved onto its milestones the same way.

## Repository layout

```
.claude-plugin/   plugin.json and marketplace.json
skills/<name>/    SKILL.md plus any reference files it points to
agents/           the sub-agents the skills dispatch, each with the model its role needs
hooks/            the Agent Watcher pane: hooks.json names register.tsx, the hooks module
types/            the Agent Watcher pane's state contract
evals/            behaviour checks for the skills (claude plugin eval), by evals/README.md
scripts/          check.mjs runs every free check: check-refs.mjs (every "FILE.md's **Section**" reference resolves),
                  check-phases.mjs, the scripts' tests and the Agent Watcher pane's tests
CHANGELOG.md      what each release changes, and what migrates by itself
docs/TRACKS.md    why a spec's milestones run in one track per repository
```
