---
name: build
description: Build the next frontier of a spec in the brain's .brain/specs/, one track per repository, the tracks side by side, and land each repository once its milestones are built.
argument-hint: "[spec-id]"
disable-model-invocation: true
metadata:
  type: process
---

Build a spec from the files `write-tickets` wrote under the active brain's `.brain/specs/NNN-<slug>/`. Each **milestone** builds in its **repository**, the one its track names, worked in by [FORMAT.md](../brain/references/FORMAT.md)'s working repository rules: its root comes from the brain's `.brain/links.json`, every git command runs as `git -C <root>`, and every suite runs from the root. Each ticket is built by a **builder sub-agent** in a fresh context, running in the background, so the tracks build side by side, at most the cap step 1 reads at once, while this session closes milestones; a milestone closes with one `review-changes` over its whole diff, and it is squashed from its own branch into the spec's branch in that repository as one commit. A track lands its milestones on its repository's base once it has no open milestone left, by [LAND.md](references/LAND.md), without asking. Everything stays local: never push, fetch or open a PR; the user pushes by hand.

One call builds one **frontier**, by **Tracks**, as an **event loop** (step 3), then ends, so the next frontier starts in a fresh context. This session is the loop's only orchestrator, since a sub-agent cannot dispatch sub-agents, and each sub-agent's report is an event the loop acts on. When a step or LAND.md says to stop while the loop runs, only the track it works in stops: mark that track **blocked**, with what stopped it, and keep the others going. Steps 1 and 2 stop the whole call. Running the same call again resumes the frontier it left, or builds the next one.

Dispatch every builder sub-agent as the `alper-brain:builder` agent. A **fixer** is the `alper-brain:fixer` agent: it takes the review's findings, a failing check, or a ticket its builder could not finish. The review's escalated findings go to the `alper-brain:arbiter` agent, which decides them in place of the user, unless the call's arguments say the user decides them. Open the brief of every builder, fixer and arbiter with what `sdd dispatch <its ticket, or milestone.md> --agent <builder|fixer|arbiter>` prints, as printed: it writes the agent's Context block by [BRIEF.md](../brain/references/BRIEF.md) to a file, every line filled for that agent, sets a builder's ticket to `doing`, and prints the **Works in** line, that file and the paths the agent works on. Each agent's definition holds its job, so a step adds only its one line and the inputs it names. Dispatch the sub-agents of steps 2 and 6 to 9 in the foreground, since the next step consumes each report; only step 5's builder and fixer run in the background. After each builder or fixer reports, check where it wrote by BRIEF.md's **After a sub-agent that changes a repository reports**, all in one call: `sdd verify <milestone.md> --commit <each commit it reports> --brain-head <brainHead from the state you dispatched it on>` after a review or check fixer, and `sdd next` (step 3) after a ticket's builder or fixer. Each prints `ok` or each problem; a problem means the sub-agent could not finish its work. List every **Needs the user** item a sub-agent reports in the **Decided for you** section of LAND.md's hand-over.

## State

`sdd` in this skill is `node <this skill's folder>/scripts/sdd.mjs`, and `sdd state` decides **Branches**' base, **Tracks**, **Phase**'s resume step and LAND.md's landable the same way every call, so read those from it rather than from the files. `sdd state <spec-folder>` prints the spec as JSON, leaving out each field that is null or an empty list: per milestone its `state` (open, unlanded or landed), `resume` (a step number, or `land`), `ready` with `waitsOn`, `landable` with `landsAfterOpen`, `reviewCurrent`, `unanswered` (escalated findings with no **Answer**) and `toFix` (the findings step 8 takes); per track its `repo` and `next`; and for the call its `frontier`, `dispatchable`, `closingQueue`, `cap`, `dependencies` and `problems`. Run it at step 1, and again when a step needs a field no command's output gave you since the files changed: `next`, `sdd review`, `mark`, `squash` and `land` each print what the loop acts on next. When `problems` is not empty, show the user and stop.

Write the pipeline files through `sdd` too, each write one call that needs no read first, chained with the step's next command where one follows: `sdd set <file> <Line> <value>` for a `**Line:**` such as **Phase**, **Status** or **Base**, and `sdd mark <review.md> <ID> "<Line>: <value>" [<ID> "<Line>: <value>"]…` for every **Answer**, **Fixed** or **Not fixed** line of a step at once. Each step gives the command it runs with its arguments: `state`, `dispatch`, `next`, `verify`, `set`, `mark`, `squash`, and LAND.md's `land`. Where a sandbox keeps Bash from writing a file, `sdd` fails on it: write that line with Edit and go on. `dispatch` and `next` go on by themselves: the brief they print then holds the whole Context block, and a `not written:` line names the **Status** line to write with Edit.

## Branches

In each repository, the spec's branch is `sdd/<spec-folder>/spec` and each milestone of its track has `sdd/<spec-folder>/M<NNN>`, with `NNN` the milestone's number in that track, such as `sdd/003-invoice-export/spec` and `sdd/003-invoice-export/M001`: the `sdd/<spec-folder>/` prefix groups a spec's branches, so they are listed and cleaned up with one glob. A repository's **base branch** is its `<slug>@<branch>` entry in the **Base** line of `spec.md`; when it has none, its remote's default. `state` gives it as the track's `repo.base`: when `repo.baseFrom` is `remote` and `repo.releases` is absent, add the entry to the **Base** line, creating it under the **Key** line, so every landing and every spec that depends on this one reads the same base; when `repo.base` is missing, step 1 asks the user. When the repository has a **release branch**, `rlse/vX.Y.Z`, the base is the user's pick, the default or a release branch with its next version, by [RELEASE.md](references/RELEASE.md), and its entry waits for that pick.

## Tracks

`state` decides open, unlanded, ready, the frontier and landable by these rules; the loop alone knows busy and blocked. A track works on one milestone at a time, in number order, and on one ticket at a time, since its repository has one working tree. A milestone is **open** until its **Squash** names a commit, and **unlanded** from then until its **Landed** names one.

- A track's next milestone is **ready** once every earlier milestone of its track is squashed, and so is every milestone of another track its **Builds after** names. A **Builds after** orders the landing too, by LAND.md. A **Lands after** line never holds a build back: it orders the landing, by LAND.md, and holds a migrate at step 9's wait for its expand.
- The **frontier** is each track's next milestone that is ready, or that an earlier call started (a ticket past `todo`, or a **Phase** past `none`).
- A track is **busy** while its builder or fixer runs, or while its milestone is on the closing queue (step 3) or closing.
- A track is **blocked** from the step that stopped it until a later call resumes it. Nothing is stored for it beyond what the stop wrote (a ticket's `blocked` **Status**, a milestone's `failed` **Phase**, or its `ask`, its escalations left to the user), which the next call reads.

## Phase

Once its tickets are `done`, a milestone is still closing: reviewed, decided, fixed, checked, squashed. Steps 6 to 9 each begin by writing their word into `milestone.md`'s **Phase** line, above **Squash**, step 10 writes `squash` with the squash's commit, and a call **resumes** each open milestone from that line, as `state`'s `resume` gives it:

| Phase | Written by | Means | A call resumes at |
|---|---|---|---|
| `none` | the ticket template | not closing yet | step 4, or step 6 once its tickets are all `done` |
| `review` | step 6 | | step 6 |
| `decide` | step 7 | the arbiter decides its escalations | step 7 |
| `ask` | step 7 | the user decides them: the track waits on their answers | step 7 |
| `fix` | step 8 | | step 8 |
| `check` | step 9 | | step 9 |
| `waits` | step 9 | a migrate whose expand is still open | step 9 |
| `failed` | step 9 | it gave up on a failing check | step 9 |
| `squash` | step 10 | squashed, or, from an older call, a squash still to record | step 10 |

Once squashed, a milestone is unlanded and resumes in LAND.md, which writes `landed` when it lands, or `failed` when its landing gives up.

## Process

1. **Start the call.**
   - Run `sdd state <spec-id> --brain <the active brain>`, which resolves the id by [SPEC-ID.md](../write-spec/references/SPEC-ID.md), or, without one, `sdd state <spec-folder>` with the spec folder from this conversation. When it fails to resolve, report it and stop. When `abandoned` is set, report it and stop.
   - When `layout` is `flat`, move the milestones into tracks by [MIGRATE.md](../brain/references/MIGRATE.md)'s **Tracks** first, then run `state` again.
   - When `migrate` is set, its milestones still wait on another track through a ticket's **Depends on**, as specs ticketed before **Builds after** do: move each wait onto its milestone by MIGRATE.md's **Builds after**, then run `state` again.
   - When `noneOpen`, follow LAND.md's **When no milestone is open** instead.
   - Check the repository of every track holding an open or unlanded milestone. Then ask the user, in one message, whatever the call's arguments and this conversation have not already answered:
     - to run `/brain link` for any repository in `unlinked`, and `/add-dir <root>` for any not open;
     - to clean any whose `repo.clean` is false, since the commits must hold only this spec's work;
     - for the base branch of any repository whose `repo.base` is missing;
     - for the base, and from a release branch its next version, of any repository with a `repo.releases`, by RELEASE.md's **Offer**; when the user names a release branch as a base, make that offer as soon as they name it;
     - for each milestone at `ask`, the user's answer to each escalated finding with no **Answer** line: fix it as proposed, fix it another way, or skip it; or to leave them to the arbiter.
   - Stop until every repository is linked, open and clean, and every Offer has the user's pick. Add each repository's base to the **Base** line by **Branches**, except one picked at an Offer, which step 2 sets and records, and write each answer the user gave by step 7's form, with the reason `decided by the user`, adding step 7's Notes bullet to each ticket the answer builds differently from.
   - The **cap** is `state`'s `cap`; when `capProblem` is set, tell the user.

   Done when the spec is in tracks with no `migrate`, every repository the call changes is linked, open and clean and has its base or the user's pick for it, you hold the cap and who decides escalations, every escalated finding at `ask` has its Answer or the user left it for later or to the arbiter, and `state` gives each track's next step.

2. **Check the dependencies.** Skip the check unless `allTodo` and `state` lists `dependencies`: otherwise an earlier call already ran it, or the spec has none. Check each by [DEPENDENCIES.md](references/DEPENDENCIES.md). Then, checked or skipped, set each base picked at step 1 by RELEASE.md's **Set the base**, only now so it holds what the dependencies landed, and run `state` again when you set one. Done when every dependency has landed, every Relies On bullet that names it holds and every base picked is recorded, or the call stopped.

3. **Run the loop.** Build the frontier, keeping as many tracks busy as the cap allows, and close one milestone at a time:

   - **Start.** The frontier is `state`'s `frontier`, fixed for the call: a squash does not bring its track's next milestone in. The **closing queue** starts as `state`'s `closingQueue`: each milestone to resume at its `resume` step, with its branch checked out by step 4 before it closes. Land every track with no open milestone and a landable one, since a call that stopped mid-landing resumes here. To **land** a track, run `sdd land <spec-folder> --track <slug> --brain <the active brain>`, LAND.md's **Land a track** in one call; open LAND.md only when it prints `stopped`, for what to do, or when no milestone is open.
   - **Dispatch.** The free **slots** are the cap minus the tracks with a builder or fixer running. Fill them from `state`'s `dispatchable` entries whose milestone is in the frontier, in its order, skipping the tracks busy or blocked, counting each track taken against the slots; the rest wait for a slot. For each one taken, prepare the milestone's branch by step 4 whenever it has none or the repository's `HEAD` is not on it, and dispatch the builder of its next ticket not `done` by step 5, all in one message.
   - **On a builder's or fixer's report** for a ticket, run `sdd next <its ticket> --commit <each commit it reports> --brain-head <brainHead>`: it runs the opening paragraph's check and, when that holds, prints the brief of the milestone's next ticket, already `doing`; dispatch that builder right away by step 5, in the slot its track holds. When it prints `every ticket done`, put the milestone at the back of the closing queue. When it prints a problem, follow step 5's last paragraph. When the track is now queued or blocked, its slot is free: run **Dispatch**.
   - **Close.** While the queue holds a milestone, take its first through steps 6 to 10, in this session. Before each of those steps, act on every report that has arrived, then run **Dispatch**.
   - **After each squash**, report one line: the milestone, its repository, its squash commit and the number of findings fixed. Put at the back of the queue every milestone in `waits` whose expand just squashed. When the squash leaves its track no open milestone, land it; after each landing, land every other track with no open milestone and a landable one, since one track's landing can make another's landable.
   - **Wait.** When a builder or fixer runs and nothing is queued or can be dispatched, end your turn with one line naming each running track and its ticket, and each track waiting for a slot: each report starts you again at **On a builder's or fixer's report**.
   - **Drain.** When, after acting on every report that has arrived, no builder or fixer runs, the queue is empty and no frontier milestone can be dispatched, the loop ends. When no milestone is open, follow LAND.md's **When no milestone is open**. Otherwise report each blocked track with what stopped it, each milestone in `waits` with the expand it waits on, and every **Needs the user** item reported so far; then run `state` again and end with its `frontier`, each milestone with its repository, and the line `Run /clear, then /build <spec-id> to build it.`

   Done when the loop has drained: every frontier milestone is squashed, blocked or in `waits`.

4. **Prepare the branch** of a track's next milestone. When `git -C <root> status --porcelain` is not empty, report it and stop. Find the base branch by **Branches**. When the spec's branch does not exist in the repository, create it from the base. When the milestone's branch exists, check it out; otherwise create it from the spec's branch. The **fixed point**, the commit the review diffs against, is `git -C <root> merge-base sdd/<spec-folder>/spec HEAD`, which survives rebases. Done when the milestone's branch is checked out and its fixed point resolves.

5. **Build a ticket.** A milestone's tickets build in number order, each only on the tickets before it. Dispatch its builder in the background, its brief what `sdd dispatch <the ticket> --agent builder` prints (or, from step 3, what `sdd next` printed), then the line `Build this ticket.` The dispatch sets the ticket to `doing`, and its Context block names under **Also reads** each other track its milestone builds or lands after; the builder's definition holds how it builds and reports.

   When the ticket was already `doing` or `blocked`, an earlier call stopped on it: add to the brief that part of its work may already be committed on this branch, and that its Notes say what blocked it. When a builder could not build its ticket, dispatch a fixer once, in the background, its brief what `sdd dispatch <the ticket> --agent fixer` prints, then the line `Finish this ticket.` and the builder's report. When the fixer could not build it either, set its **Status** to `blocked`, write what stopped it into its Notes, and stop: the tickets after it may depend on it. Done when the ticket is `done` and committed, or its track is blocked.

6. **Review.** When the milestone's `reviewCurrent` is true, its `review.md` was made from the branch as it stands: take that report. Otherwise invoke the `review-changes` skill with the fixed point, the milestone folder and the repository; it saves its report as the milestone's `review.md`, shows the user its Summary, and its `sdd review` prints the review's `unanswered` and `toFix`, which steps 7 and 8 take. Done when the milestone's `review.md` has the branch's `HEAD` as its **Head**.

7. **Decide.** When the milestone's `unanswered` is empty, no finding flagged **escalate** lacks an **Answer** line: skip this. When the user decides escalations in this call, write `ask` into the **Phase** line in place of `decide`, mark the track **blocked**, its escalated findings waiting on the user, and stop: the next call's step 1 asks for the answers. Otherwise dispatch one arbiter, its brief what `sdd dispatch <milestone.md> --agent arbiter` prints (its **Notes** add the brain's `contract` notes whose `repos` name this repository, and its **Also reads** the other repositories those notes name), then the line `Decide the unanswered escalations in <review.md's path>.` The arbiter's definition holds how it decides and its one line per finding.

   Write every answer under its finding in one `sdd mark`, each as `"Answer: <the answer, opening on fix or skip> — <reason>"`: `toFix` reads that first word. For each ticket an answer names or, for the user's answer, builds differently from, add a bullet to its Notes: `Departs from the spec: <what is built instead>, by review finding <the finding in a few words>`; for a ticket whose builder or fixer is running, add it once that report arrives. Notes override `spec.md` for every later reader, so `spec.md` stays as the user approved it. Done when every escalated finding has its Answer, or the track is blocked on the user's.

8. **Fix.** The findings to fix are the milestone's `toFix`: those with no **Fixed** or **Not fixed** line, not marked **keep**, and, when escalated, whose Answer fixes them. When `toFix` is empty, skip this. Otherwise dispatch one fixer, its brief what `sdd dispatch <milestone.md> --agent fixer` prints, then the line `Fix findings <the toFix IDs> of <review.md's path>.`

   Write the fixer's lines in one `sdd mark`, each as `"Fixed: <SHA>"` or `"Not fixed: <reason>"`. The review runs once per milestone, so fixing never turns into a review loop. Done when that `sdd mark` prints `toFix: none`; a finding the fixer left without a line goes to one more fixer, once.

9. **Check the increment.** When the milestone's **Lands after** names a producer's **expand**, it is a **migrate**: run step 1 of [MIGRATE-CHECK.md](references/MIGRATE-CHECK.md) first, which holds it at `waits` until the expand squashes, and its step 2, the **fakes check**, after the suite. Run the repository's full suite and the check in `milestone.md`'s **Done when**, from its root, so each prints only its failures and summary (its quiet reporter, or its output through `tail -n 40`): this is the milestone's one full run.

   When any check fails, dispatch a fixer, its brief what `sdd dispatch <milestone.md> --agent fixer` prints, then the line `Make this failing check pass.` and the failing command with the end of its output, or the fakes check's report; then run every check again.

   After two failed fixes, write `failed` into the **Phase** line, report the failure to the user and stop. Done when every check passes, and for a migrate the fakes check is done; or the milestone waits.

10. **Squash into the spec.** Run `sdd squash <the milestone's folder> --title "<its increment>" [--detail "<bullet>"]…`, the title and up to three one-line details by the `commit` skill's message rules, the key and title together within 72 characters. It squashes the milestone's branch into the spec's with the trailer `Sdd-Milestone: <spec-folder>/<repo-slug>/M<NNN>`, by which LAND.md finds the squash again after each rebase, and writes **Phase** and **Squash**; run again after a stop, it records a squash already committed. When it fails on the key, ask the user for a key that fully matches the repository's `commitKeyPattern`, or none, and run it again with `--key <key|none>`. Keep the milestone's branch: its ticket commits stay readable there until the spec lands. Done when it prints the squash's SHA.
