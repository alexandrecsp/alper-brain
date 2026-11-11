---
name: build
description: Build every milestone of a spec in the brain's .sdd/specs/ and land it, one track per repository, the tracks side by side.
argument-hint: "[spec-id]"
disable-model-invocation: true
metadata:
  type: process
---

Build a spec from the files `write-tickets` wrote under the active brain's `.sdd/specs/NNN-<slug>/`. Each **milestone** builds in its **repository**, the one its track names, worked in by [FORMAT.md](../brain/references/FORMAT.md)'s working repository rules: its root comes from the brain's `.sdd/links.json`, every git command runs as `git -C <root>`, and every suite runs from the root. Each ticket is built by a **builder sub-agent** in a fresh context, running in the background, so every track, up to the cap step 1 reads, keeps a builder working while this session closes milestones; a milestone closes with one `review-changes` over its whole diff, and it is squashed from its own branch into the spec's branch in that repository as one commit. Each track lands its milestones on its repository's base as they become landable, by [LAND.md](references/LAND.md). Everything stays local: never push, fetch or open a PR; the user pushes by hand.

One call builds the whole spec as an **event loop** (step 3): this session is its only orchestrator, since a sub-agent cannot dispatch sub-agents, and each sub-agent's report is an event the loop acts on. When a step or LAND.md says to stop while the loop runs, only the track it works in stops: mark that track **blocked**, with what stopped it, and keep the others going. Steps 1 and 2 stop the whole call. Running the same call again resumes it.

Dispatch every builder sub-agent as the `alper-brain:builder` agent. A **fixer** is the `alper-brain:fixer` agent: it takes the review's findings, a failing check, or a ticket its builder could not finish. The review's escalated findings go to the `alper-brain:arbiter` agent when step 1 chose the arbiter: it decides them in place of the user. Open every brief with the Context block by [BRIEF.md](../brain/references/BRIEF.md): **Works in** the milestone's repository, **Spec** the ticket or `milestone.md`, **Branch** the milestone's branch, **Notes** the spec's **Brain notes** line, **Docs** adding, for a builder or fixer, the absolute paths of the `project-structure` and `codebase-design` skills' `SKILL.md`, and **Writes** the files under the root plus, for the builder of a ticket or the fixer finishing it, that ticket's file. Dispatch the sub-agents of steps 2 and 6 to 9 in the foreground, since the next step consumes each report; only step 5's builder and fixer run in the background. After each builder or fixer reports, check where it wrote by BRIEF.md's **After a sub-agent that changes a repository reports**; when a check fails, treat it as a sub-agent that could not finish its work. List every **Needs the user** item a sub-agent reports in the **Decided for you** section of LAND.md's hand-over.

## State

`sdd state` below is `node <this skill's folder>/scripts/sdd.mjs state`. It decides **Branches**' base, **Tracks**, **Phase**'s resume step and LAND.md's landable the same way every call, so read those from it rather than from the files. `sdd state <spec-folder>` prints the spec as JSON: its lines (`repos`, `base`, `abandoned`, `landed`, `brainNotes`), `layout`, `cap` (with `capProblem` when the settings file is wrong), `unlinked` repositories, `dependencies` with each one's `found`, `abandoned`, `landed` and `onBase`, and `allTodo`, `noneOpen`, `closingQueue`, `dispatchable` and `problems`. Per track: `repo` (`root`, `clean`, `head`, `base`, `baseFrom`, `branches`), `next`, `idle` and `landable`; per milestone: `state` (open, unlanded or landed), `phase`, `resume` (a step number, or `land`), `ready` with `waitsOn`, `landable` with `landsAfterOpen`, `onBase`, `branch`, `reviewCurrent`, `unanswered` (escalated findings with no **Answer**) and its tickets. A field that is null or an empty list is left out. Run it at step 1, and again whenever the loop acts on a report, a squash or a landing: the files changed under it. When `problems` is not empty, show the user and stop.

## Branches

In each repository, the spec's branch is `sdd/<spec-folder>/spec` and each milestone of its track has `sdd/<spec-folder>/M<NNN>`, with `NNN` the milestone's number in that track, such as `sdd/003-invoice-export/spec` and `sdd/003-invoice-export/M001`: the `sdd/<spec-folder>/` prefix groups a spec's branches, so they are listed and cleaned up with one glob. A repository's **base branch** is its `<slug>@<branch>` entry in the **Base** line of `spec.md`; when it has none, its remote's default. `state` gives it as the track's `repo.base`: when `repo.baseFrom` is `remote`, add the entry to the **Base** line, creating it under the **Key** line, so every landing and every spec that depends on this one reads the same base; when `repo.base` is missing, step 1 asks the user.

## Tracks

`state` decides open, unlanded, ready, idle and landable by these rules; the loop alone knows busy and blocked. A track works on one milestone at a time, in number order, and on one ticket at a time, since its repository has one working tree. A milestone is **open** until its **Squash** names a commit, and **unlanded** from then until its **Landed** names one.

- A track's next milestone is **ready** once every earlier milestone of its track is squashed, and so is every milestone of another track its tickets' **Depends on** reach, directly or through the tickets those name. A **Lands after** line never holds a build back: it orders the landing, by LAND.md, and holds a migrate at step 9's wait for its expand.
- A track is **idle** from its milestone's squash until its next milestone's branch exists, and once it has no open milestone: LAND.md lands a track only while it is idle, so no rebase runs under a milestone being built.
- A track is **busy** while its builder or fixer runs, or while its milestone is on the closing queue (step 3) or closing.
- A track is **blocked** from the step that stopped it until a later call resumes it. Nothing is stored for it beyond what the stop wrote (a ticket's `blocked` **Status**, a milestone's `failed` **Phase**, or its `ask`, its escalations left to the user), which the next call reads.

## Phase

Once its tickets are `done`, a milestone is still closing: reviewed, decided, fixed, checked, squashed. Each closing step begins by writing its word into `milestone.md`'s **Phase** line, above **Squash**, and a call **resumes** each open milestone from that line, as `state`'s `resume` gives it:

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
| `squash` | step 10 | | step 10 |

Once squashed, a milestone is unlanded and resumes in LAND.md, which writes `landed` when it lands, or `failed` when its landing gives up.

## Process

1. **Start the call.**
   - Run `sdd state <spec-id> --brain <the active brain>`, which resolves the id by [SPEC-ID.md](../write-spec/references/SPEC-ID.md), or, without one, `sdd state <spec-folder>` with the spec folder from this conversation. When it fails to resolve, report it and stop. When `abandoned` is set, report it and stop.
   - When `layout` is `flat`, move the milestones into tracks by [MIGRATE.md](../brain/references/MIGRATE.md)'s **Tracks** first, then run `state` again.
   - When `noneOpen`, follow LAND.md's **When no milestone is open** instead.
   - Check the repository of every track holding an open or unlanded milestone. Then ask the user, in one message, whatever the call's arguments and this conversation have not already answered:
     - to run `/brain link` for any repository in `unlinked`, and `/add-dir <root>` for any not open;
     - to clean any whose `repo.clean` is false, since the commits must hold only this spec's work;
     - for the base branch of any repository whose `repo.base` is missing;
     - how this call lands: each track **as it goes** (its landable milestones whenever it is idle) or **at the end** (all at once, after one more yes);
     - who decides the review's escalated findings: the **arbiter**, in the user's place, or the **user**, whose tracks stop at step 7 on an escalated finding until the next call asks; when the user decides, their answer to each escalated finding with no **Answer** line in a milestone at `ask` or `decide`: fix it as proposed, fix it another way, or skip it.
   - Stop until every repository is linked, open and clean. Add each repository's base to the **Base** line by **Branches**, and write each answer the user gave by step 7's form, with the reason `decided by the user`, adding step 7's Notes bullet to each ticket the answer builds differently from.
   - The **cap** is `state`'s `cap`; when `capProblem` is set, tell the user.

   Done when the spec is in tracks, every repository the call changes is linked, open and clean and has its base, you hold the cap, the landing choice and who decides escalations, and, when the user decides, every escalated finding at `ask` or `decide` has its Answer or the user left it for later, and `state` gives each track's next step.

2. **Check the dependencies.** Skip this unless `allTodo`: otherwise an earlier call already ran it. For each of `state`'s `dependencies`, stop at the first of these that holds:
   - `found` is false: report it;
   - `abandoned` is set: report that this spec must be revised to drop it;
   - an `onBase` entry is `unlinked`: ask the user to run `/brain link`;
   - `landed` is missing, or an `onBase` entry is not `true`: report that this spec waits on it.

   Then dispatch one `alper-brain:spec-reviewer` agent per dependency, in waves by BRIEF.md's **Fanning out**, with the Context block (the repositories the dependency's **Landed** line names under **Works in** and **Also reads**, read only, and **Writes** nothing), the paths of both `spec.md` files, and this brief:

   > Check whether the dependency was built as this spec assumes. For each bullet of this spec's **Relies On** section that names the dependency, read the code it touches as it stands on the branch the dependency's **Base** line names for that repository, with `git -C <root> show <base>:<path>` (the working tree may hold another branch), and the Notes of the dependency's tickets, and report the bullet as **holds** or **drifted**, with what the code does instead. Change nothing. Done when every such bullet has its verdict, or you report that no bullet names the dependency.

   When any bullet drifted, show the user the report and stop: revising the spec is the user's call. Done when every dependency has landed and every Relies On bullet has a verdict from its reviewer and holds, or the spec has none.

3. **Run the loop.** Keep as many tracks busy as the cap allows, and close one milestone at a time:

   - **Start.** The **closing queue** starts as `state`'s `closingQueue`: each milestone to resume at its `resume` step, with its branch checked out by step 4 before it closes. When the call lands as it goes, land every idle track that is not blocked by LAND.md's **Land a track**, since a call that stopped mid-landing resumes here.
   - **Dispatch.** The free **slots** are the cap minus the tracks with a builder or fixer running. Fill them from `state`'s `dispatchable`, in its order, skipping the tracks busy or blocked, counting each track taken against the slots; the rest wait for a slot. For each one taken: when the milestone's `branch` is false and the call lands as it goes, first land the track's landable milestones by LAND.md's **Land a track**, since the track is idle only until then; when that landing stops, the track is blocked and its slot goes to the next ready track. Then prepare the milestone's branch by step 4 whenever it has none or the repository's `HEAD` is not on it, and dispatch the builder of its next ticket not `done` by step 5. Send the tracks that need no landing first, all in one message.
   - **On a builder's or fixer's report**, check where it wrote by BRIEF.md's **After a sub-agent that changes a repository reports**; when it could not finish its ticket, follow step 5's last paragraph. When its milestone has a ticket left, dispatch that one right away, in the slot its track holds; when it was the last, put the milestone at the back of the closing queue. When the track is now queued or blocked, its slot is free: run **Dispatch**.
   - **Close.** While the queue holds a milestone, take its first through steps 6 to 10, in this session. Before each of those steps, act on every report that has arrived, then run **Dispatch**.
   - **After each squash**, report one line: the milestone, its repository, its squash commit and the number of findings fixed. Put at the back of the queue every milestone in `waits` whose expand just squashed. When the call lands as it goes, land every idle track that is not blocked by LAND.md's **Land a track**, and again after each landing, since one track's landing can make another's landable.
   - **Wait.** When a builder or fixer runs and nothing is queued or can be dispatched, end your turn with one line naming each running track and its ticket, and each track waiting for a slot: each report starts you again at **On a builder's or fixer's report**.
   - **Drain.** When, after acting on every report that has arrived, no builder or fixer runs, the queue is empty and no track can be dispatched, the loop ends. When no milestone is open, follow LAND.md's **When no milestone is open**. Otherwise report each blocked track with what stopped it, each track whose next milestone waits on a blocked one, each milestone in `waits` with the expand it waits on, and every **Needs the user** item reported so far, then stop.

   Done when the loop has drained.

4. **Prepare the branch** of a track's next milestone. When `git -C <root> status --porcelain` is not empty, report it and stop. Find the base branch by **Branches**. When the spec's branch does not exist in the repository, create it from the base. When the milestone's branch exists, check it out; otherwise create it from the spec's branch. The **fixed point**, the commit the review diffs against, is `git -C <root> merge-base sdd/<spec-folder>/spec HEAD`, which survives rebases. Done when the milestone's branch is checked out and its fixed point resolves.

5. **Build a ticket.** A milestone's tickets build in number order, each only on the tickets before it. Set the ticket's **Status** to `doing`, then dispatch its builder in the background, with its milestone's Context block, the paths of the ticket, `milestone.md` and `spec.md`, the slug and root (from `.sdd/links.json`) of each other track its **Depends on** or its milestone's **Lands after** names, under **Also reads**, and this brief:

   > Build this ticket in the repository the Context block names. First read the ticket and the notes the Context block lists, then run `node <sdd.mjs's absolute path> brief <the ticket's path>`: it prints its milestone's **Delivers** and **Done when**, and the Notes and changed files of the earlier tickets of its milestone and of those its **Depends on** names. Read `milestone.md`, `spec.md`, those tickets and their commits' diffs only for what it leaves open. Follow the `tdd` skill, testing at the seams the ticket's acceptance criteria name. Place and name every new file by `<root>/docs/STRUCTURE.md`, reading the `project-structure` SKILL.md under **Docs** where it is silent. Build its Design patterns rows at their Where. Leave the full suite to the milestone check: you are done building when each acceptance criterion has a test at its seam that you saw fail, then pass, and the unit suite and your e2e tests pass. Then fill the ticket's Notes with what its diff can't show the next ticket (decisions the ticket left open, departures from it, gotchas you hit) in a few bullets, or "None". Commit everything by the `commit` skill, with the spec folder and the repository. Then write the commit's SHA into the ticket's **Commit** line and set its **Status** to `done`. Report the commit, and anything you could not build.

   When the ticket was already `doing` or `blocked`, an earlier call stopped on it: add to the brief that part of its work may already be committed on this branch, and that its Notes say what blocked it. When a builder could not build its ticket, dispatch a fixer once, in the background, with the same brief, adding the builder's report and that part of its work may already be committed: the fixer finishes the ticket as the brief says, its **Commit** and **Status** lines included. When the fixer could not build it either, set its **Status** to `blocked`, write what stopped it into its Notes, and stop: the tickets after it may depend on it. Done when the ticket is `done` and committed, or its track is blocked.

6. **Review.** When the milestone's `reviewCurrent` is true, its `review.md` was made from the branch as it stands: take that report. Otherwise invoke the `review-changes` skill with the fixed point, the milestone folder and the repository; it saves its report as the milestone's `review.md`. Show the user the report. Done when the milestone's `review.md` has the branch's `HEAD` as its **Head**.

7. **Decide.** When the milestone's `unanswered` is empty, no finding flagged **escalate** lacks an **Answer** line: skip this. When the user decides escalations in this call, write `ask` into the **Phase** line in place of `decide`, mark the track **blocked**, its escalated findings waiting on the user, and stop: the next call's step 1 asks for the answers. Otherwise dispatch one arbiter with the Context block (**Notes** adding the `contract` notes in the brain's `shared/` whose `repos` name this milestone's repository, **Also reads** the root of each other repository those notes name, and **Writes** nothing), the paths of `review.md`, `milestone.md` and `spec.md`, and this brief:

   > Decide each finding in this review flagged escalate that has no **Answer** line. For each, read its hunk in the repository the Context block names, the rule or requirement it cites, the ADRs and `decision` notes it touches and the code that calls what it would change. Take each consumer's call sites from the review's Consumers section, reading the repositories the contract notes name only where a finding needs more, and only with `git -C <its root> show <its entry in spec.md's Base line>:<path>`, since their working trees hold other tracks' unfinished builds. Answer it with one of: fix it as proposed; fix it another way, saying how; or skip it. Give a one-line reason, and when your answer builds something other than what the spec or a ticket says, name those tickets. Weigh the findings together: they come from one diff. When an answer changes an interface another repository calls, keep the old shape offered beside the new one, unless another milestone of this spec migrates that consumer: name the milestone. Report one line per finding, by its ID. Change nothing.

   Write each answer under its finding as `**Answer:** <answer> — <reason>`. For each ticket an answer names or, for the user's answer, builds differently from, add a bullet to its Notes: `Departs from the spec: <what is built instead>, by review finding <the finding in a few words>`; for a ticket whose builder or fixer is running, add it once that report arrives. Notes override `spec.md` for every later reader, so `spec.md` stays as the user approved it. Done when every escalated finding has its Answer, or the track is blocked on the user's.

8. **Fix.** When `review.md` holds nothing to fix, skip this. Otherwise dispatch one fixer with the Context block, the path of `review.md`, and this brief:

   > Fix the findings in this review, in the repository the Context block names: every one not flagged escalate, and each escalated one as its answer says, skipping any with a **Fixed** or **Not fixed** line. Prove each fix with the smallest test at the seam it touches; a refactor needs only the suite. Finish with the unit suite and your e2e tests passing. Commit by the `commit` skill, with the spec folder and the repository. Report one line per finding, by its ID: fixed, with the commit, or not fixed, with why.

   Write the fixer's line under each finding in `review.md`, as `**Fixed:** <SHA>` or `**Not fixed:** <reason>`. The review runs once per milestone, so fixing never turns into a review loop. Done when every finding to fix has its line, or there was nothing to fix.

9. **Check the increment.** When the milestone's **Lands after** names a producer's **expand**, it is a **migrate**: run step 1 of [MIGRATE-CHECK.md](references/MIGRATE-CHECK.md) first, which holds it at `waits` until the expand squashes, and its step 2, the **fakes check**, after the suite. Run the repository's full suite and the check in `milestone.md`'s **Done when**, from its root: this is the milestone's one full run.

   When any check fails, dispatch a fixer with the Context block (for the fakes check's report, with its **Also reads**), the paths of `milestone.md` and `spec.md`, the failing command and the end of its output, or the fakes check's report, and this brief, then run every check again:

   > Make this failing check pass in the repository the Context block names. Find the cause before changing anything. Fix the code; change a test, the check or the milestone's **Done when** only when it contradicts the ticket or spec it proves, and say so. Commit by the `commit` skill, with the spec folder and the repository. Done when the failing command passes, or each drifted fake matches, and the unit suite still passes. Report the cause, the commit, and every test you changed.

   After two failed fixes, write `failed` into the **Phase** line, report the failure to the user and stop. Done when every check passes, and for a migrate the fakes check is done; or the milestone waits.

10. **Squash into the spec.** Check out the spec's branch. When `git -C <root> diff sdd/<spec-folder>/spec sdd/<spec-folder>/M<NNN>` is empty, an earlier call already committed the squash: take `HEAD` as its commit. Otherwise run `git -C <root> merge --squash sdd/<spec-folder>/M<NNN>` and commit it by invoking the `commit` skill with the spec folder, the repository and the trailer `Sdd-Milestone: <spec-folder>/<repo-slug>/M<NNN>` (the track's repository slug), by which LAND.md finds the squash again after each rebase: the subject is the milestone's increment. Write the commit's SHA into `milestone.md`'s **Squash** line. Keep the milestone's branch: its ticket commits stay readable there until the spec lands. Done when the squash is committed and recorded.
