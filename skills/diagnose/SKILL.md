---
name: diagnose
description: Diagnose a hard bug or performance regression through a red feedback loop. Use when the user asks to diagnose or debug something, or a failure, flake or slowdown survives a first look.
argument-hint: "[symptom]"
metadata:
  type: process
---

Diagnosis is a loop: a **tight** command that goes **red** on this bug and **green** once it is fixed. Every later step (minimising, hypothesising, instrumenting, fixing) consumes that loop, so the loop is the hard part and the rest is mechanical. Each step below is a gate: the next starts only when the current one's **Done when** holds.

Start in the **working repository** the symptom shows in, by [FORMAT.md](../brain/FORMAT.md): its root holds the loop, and every git command runs as `git -C <root>`. The **failing path** is the chain of code from the trigger to the symptom. When it crosses into another repository (an API call, an event, a queue, a shared schema), that repository joins the path. The root cause can sit in any repository on the path, and the fix goes where the cause sits.

For each repository on the failing path, read its [domain docs](../domain-modeling/DOMAIN-DOCS.md), which recall the brain's notes on it, when it joins the path. A `gotcha` matching the symptom becomes a hypothesis in step 3. A `contract` note names the producer and consumers of a boundary the path crosses, and is what the boundary is checked against.

## Redact

Every command, output and captured artifact you show has its secrets replaced with `<REDACTED>`. Build loops on env vars, so credentials stay in the environment, and quote only the lines of a capture that carry the signal (captures carry auth headers and cookies). When the redacted output is too thin to diagnose from, say so and ask the user.

## Process

### 1. Build a tight loop

Be **relentless** here. Ways to build one, roughly in order of preference:

1. **Failing test** at whatever seam reaches the bug: unit, integration, e2e.
2. **HTTP script** (curl or similar) against a running dev server.
3. **CLI run** on a fixture input, diffing stdout against a known-good snapshot.
4. **Headless browser script** (Playwright, Puppeteer) asserting on DOM, console or network.
5. **Replayed capture**: a real request, payload or event log saved to disk and run through the code path in isolation. When the failing path crosses repositories, capture at the boundary: it cuts the other repository out of the loop.
6. **Throwaway harness**: a minimal slice of the system (one service, mocked deps) that hits the bug path in one call.
7. **Property or fuzz loop**, for "sometimes wrong output": run a thousand random inputs and catch the failure mode.
8. **Bisection harness**, when the bug appeared between two known states (commit, dataset, version): automate "set up state X, check" and hand it to `git bisect run`. When the path crosses repositories, bisect one repository at a time, holding the others at a fixed commit.
9. **Differential loop**: the same input through the old and new version (or two configs), outputs diffed.
10. **Human-in-the-loop script**, last resort, when a human must click: copy [scripts/hitl-loop.template.sh](scripts/hitl-loop.template.sh), edit its steps, and run it; the user follows its prompts and their answers come back to you as `KEY=VALUE` lines.

Then **tighten** it: faster (cache setup, skip unrelated init, narrow the scope), sharper (assert the exact symptom, beyond "didn't crash"), deterministic (pin time, seed RNG, isolate the filesystem, freeze the network). For a non-deterministic bug the target is a **reproduction rate** high enough to debug against: loop the trigger 100×, parallelise, add stress, narrow timing windows, inject sleeps. A 50% flake is debuggable; a 1% flake needs more.

Code reading in this step serves the loop: finding the seam and the trigger. Theories wait for step 3.

When no loop can be built, stop and report what you tried, then ask the user for one of: access to an environment that reproduces it, a redacted capture (HAR file, log dump, core dump, timestamped screen recording), or permission to add temporary production instrumentation.

Done when you can name **one command** you have already run, with its invocation and output shown, that is:

- **Red-capable**: it drives the real bug path and asserts the user's exact symptom, so it goes red on this bug and green once fixed.
- **Deterministic**: the same verdict every run, or for a flake, a pinned and high reproduction rate.
- **Fast**: seconds, not minutes.
- **Agent-runnable**: it runs unattended, or through the human-in-the-loop script.

### 2. Reproduce and minimise

Run the loop and watch it go red. Confirm the red is the user's failure, not a nearby one (a wrong bug gets a wrong fix), that it holds across runs, and capture the exact symptom (error message, wrong output, timing) for step 5 to verify against.

Then shrink the repro: cut inputs, callers, config, data and steps **one at a time**, re-running the loop after each cut. A minimal repro leaves fewer suspects for step 3 and becomes the regression test in step 5.

Done when the loop is red on the user's symptom and every remaining element is **load-bearing**: removing any one turns the loop green.

### 3. Hypothesise

Rank 3–5 hypotheses before testing any, each naming the repository its cause sits in; a single hypothesis anchors on the first plausible idea. Each is **falsifiable**, stated as a prediction: "If X is the cause, then changing Y turns the loop green (or changing Z makes it worse)." A hypothesis whose prediction you cannot state gets sharpened or dropped.

When the failing path enters a repository that is linked but not open, dispatch one `alper-brain:scout` per such repository, all in one message, each brief opening with the Context block by [BRIEF.md](../brain/BRIEF.md) (**Notes** the `contract` note, **Writes** nothing), with the call site at the boundary (`path:line` in the repository it is called from), the captured symptom or payload, the last known-good commit or date when there is one, and this brief: "Trace the path from this boundary through this repository to where it produces or consumes the shape in question. Report each hop as `path:line`; the commits since the last known-good that touch those files (`git -C <root> log --oneline <since>.. -- <files>`); and every place the code disagrees with the contract note." Read the other side inline instead when it is one file you can already name.

Show the ranked list to the user; they often re-rank it at once ("we just deployed a change to #3") or have ruled some out already. Continue with your own ranking when the user is away.

Done when the domain docs of every repository on the failing path are read, and 3–5 ranked hypotheses, each with its prediction and its repository, are shown to the user.

### 4. Instrument

When the failing path crosses a repository boundary, the first probe is the payload at that boundary, checked against its `contract` note: one that breaks the contract puts the cause in the producer, one that honours it puts it in the consumer.

Each probe tests one prediction from step 3, changing **one variable** at a time. Reach first for a debugger or REPL, where the environment has one; otherwise add targeted logs at the boundaries that tell hypotheses apart. **Tag** every debug log with one unique prefix, such as `[DEBUG-a4f2]`, so cleanup is a single grep.

For a performance regression, measure instead of logging: take a baseline (a timing harness, `performance.now()`, a profiler, a query plan), then bisect against it.

Done when one hypothesis has survived its prediction and the others are falsified: that one is the **root cause**. When every hypothesis is falsified, return to step 3 with what the probes taught you; when the path now reaches a repository not yet on it, that repository joins the path.

### 5. Fix with a regression test

The fix goes in the repository the root cause sits in. Before changing it, check it is **open** by FORMAT.md; when it is only linked, ask the user to run `/add-dir <root>`, and stop. When the cause is two repositories disagreeing across a contract:

- **One side breaks the contract its `contract` note records:** fix that side. Its regression test goes in that repository too, at its side of the boundary.
- **The contract is wrong, unrecorded, or the fix changes a shape another repository calls:** this is a contract change, which lands expand–contract across the repositories ([CONTRACT-CHANGE.md](../to-tickets/CONTRACT-CHANGE.md)). Stop at the root cause: report it, with the producer and every consumer, and offer `/to-spec` to plan it.

The regression test goes at a **correct seam**: one where the test exercises the bug pattern as it really occurs at the call site, with every caller and step of the chain the minimised repro proved load-bearing. A correct seam for a bug across a contract is the side of the boundary that broke it: the producer's test asserts the shape it emits, and the consumer's test feeds the recorded boundary payload through its reader, each in its own repository's suite. A shallower seam (a single-caller test for a multi-caller bug, a unit test that skips the triggering chain) gives false confidence, so a missing correct seam is itself a finding: note it for the report in step 6, and skip the test.

With a correct seam, write the test the `tdd` way:

1. Turn the minimised repro into a failing test at that seam, and watch it go red on the captured symptom. When you forced the red by mutating code or a fixture, `diff` against a pristine copy to prove the mutation landed.
2. Apply the fix, and watch the test go green.
3. Re-run the step 1 loop on the original, un-minimised scenario.

Done when the step 1 loop is green, and the regression test is green or the missing seam is recorded.

### 6. Clean up and report

1. Remove every tagged log, and delete throwaway harnesses: grepping for the prefix in the root of every repository you instrumented finds none.
2. Run the full suite of each repository the fix changed, from its root.
3. Commit in each repository the fix changed, one commit each, with the `commit` skill naming that repository, its details naming the hypothesis that proved right, so the next debugger learns from it.
4. Report to the user: the root cause and the repository it sits in, the fix, the regression test or the missing seam, and the commit SHAs. When the seam was missing, offer `/improve-and-refactor` to deepen the module so the bug can be locked down.
5. Invoke the `brain` skill to record the root cause as a `gotcha` by FORMAT.md, in the notes of the repository the cause sits in, or in `shared/` naming both slugs when the trap is how two repositories meet. When a `contract` note on the path was wrong or silent about the trap, propose its fix in the same list. Skip this when none of those repositories is registered in the brain.

Done when the tag grep is empty in every instrumented root, each changed repository's suite passes and holds its commit, the user has the report, and the user has confirmed or declined the gotcha, or no repository on the path is registered in the brain.
