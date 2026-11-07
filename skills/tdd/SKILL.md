---
name: tdd
description: Test-driven development, red then green. Use when the user wants work built test-first, or wants integration tests.
user-invocable: false
metadata:
  type: process
---

TDD is the **red → green** loop. This skill makes that loop produce tests worth keeping.

## Where you work

Name the **working repository** by [FORMAT.md](../brain/references/FORMAT.md)'s working repository rules (a builder's brief names it in its Context block), or by its **With no brain open** when no brain is open. It must be open, since you write tests and code into it. Run every command as `cd <root> && <command>`, the single filtered test included: with a brain open, each shell call starts in the brain. Its seams are the ones you test: a spec's seams in other repositories belong to their own milestones.

Read the working repository's [domain docs](../model-domain/references/DOMAIN-DOCS.md): test names and interface vocabulary use the glossary's terms. When your brief lists the brain notes to read, read those instead of recalling notes yourself.

## What a good test is

A good test verifies behaviour through a public interface and reads like a specification: "user can checkout with valid cart" names a capability and survives any refactor that keeps it. Before writing the first test, read [TESTS.md](references/TESTS.md): a good and a bad example of each kind below.

- **Implementation-coupled** tests mock internal collaborators, test private methods, or verify through a side channel (querying the database instead of using the interface). The tell: the test breaks on a refactor that kept the behaviour.
- **Tautological** tests recompute the expected value the way the code computes it, so they pass by construction. Take expected values from an independent source of truth: a known-good literal, a worked example, the spec.

## Seams: where tests go

A **seam** is where a module's interface lives, as the `codebase-design` skill defines it: tests cross it and observe behaviour without reaching inside. Tests live at **confirmed seams** only, which puts the testing effort on the critical paths and complex logic rather than on every edge case.

- When a spec or ticket names the seams (its Testing Decisions or acceptance criteria), they are already confirmed: test there.
- A failing test or check your brief hands you is already red at a confirmed seam: start the loop at **Then green**.
- For a review finding, test at a seam the spec or its tickets name, or the one an existing test of that hunk crosses.
- Otherwise, before writing any test, propose the seams, each with a one-line note on what it catches and what it misses, and wait for the user to confirm them. As a sub-agent with no user to ask, report the seams you would propose and stop before writing code: whoever dispatched you confirms them.

When a seam is an interface another repository calls or offers (a `contract` note in the brain names it), read [CONTRACTS.md](references/CONTRACTS.md) before writing its test. When the shape of the interface is itself in question (how deep the module is, where the seam belongs, what the interface exposes), invoke the `codebase-design` skill for the vocabulary and principles.

## Rules of the loop

- **Red first.** Write one failing test, run it, and watch it go red for the reason you expect. A test that fails for another reason, or passes, proves nothing yet. When the test reaches past the working repository's own code (another repository, a third-party service, the clock, a database), mock it by [MOCKING.md](references/MOCKING.md).
- **Then green.** Write only enough code to pass it, then run the test again.
- **Vertical slices.** One seam, one test, one minimal implementation per cycle: each test a **tracer bullet** aimed by what the last cycle taught you: write the next test only once the last one is green, never a batch of tests up front.
- **One logical assertion per test.**
- **Refactor at review.** Refactoring belongs to the `review-changes` skill's findings, outside the red → green cycle. A builder dispatched by `build` skips this: `build` reviews each milestone. Otherwise end by offering the user a `review-changes` run.

## Suites

The **unit**, **e2e** and **full suites** are defined by the `unit` and `e2e` bullets of [FORMAT.md](../brain/references/FORMAT.md)'s card. The working repository's card (your Context block's **Card** line, else `repos/<slug>/REPO.md` in the brain) names each one's command in its `unit` and `e2e` fields. When a field is missing, or no brain is open, take the command from the project's scripts; with a brain open, report that `/brain setup` would record them.

- **Inside the loop**, run the test you are writing, filtered by its name, and the unit suite.
- **Your e2e tests** are the e2e tests you wrote or changed. Run each one filtered by its name, never its whole file: red, then green. The rest of its file, and an e2e test that imports a helper you changed or drives a screen you changed, waits for the full suite.
- **An e2e test outside your tests that fails** belongs to the full suite's run: report it and go on.
- **An e2e test that needs another repository's change** runs like any other when the environment the `e2e` command drives already serves that change. Otherwise it can't go red for the right reason: prove the behaviour at the unit seam against the producer's fake ([CONTRACTS.md](references/CONTRACTS.md)), leave the e2e test marked pending by the framework's own skip (`test.fixme`, `@skip`), with a reason naming the repository and the shape it waits on, and report it.
- **Every run is foreground and terse**: give the tool call a timeout longer than the run, so it never moves to the background, and use a one-line-per-failure reporter. Inside the loop, stop at the first failure; the full suite runs to the end, so one run hands back every failure. When the full suite can outlast the longest timeout, run the unit and e2e suites as separate calls.

The loop is done when every behaviour in scope has a test at a confirmed seam that went red, then green, and the unit suite and your e2e tests pass. Then run the full suite once, unless your brief names a later check that runs it: done when it passes, or when every failure your change caused is fixed and each other one is reported by name.
