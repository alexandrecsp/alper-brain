---
name: brainstorm
description: Brainstorm a plan or design with the user. Use when the user wants to brainstorm, or to stress-test a plan.
argument-hint: "[topic]"
metadata:
  type: process
---

Interview the user relentlessly until you reach a shared understanding. Map this as a **design tree**: every decision branches into the decisions that hang off it.

## What, then How

The tree has two aspects:

1. **What** is the outcome: the problem, who it serves, scope, behaviour, constraints, and what success looks like.
2. **How** is the mechanism: approach, architecture, tools, data, sequencing, the choices that deliver the `What`.

To sort a decision: if two different implementations could both satisfy it, it is a `What`; if it chooses between implementations, it is a `How`.

Every `How` decision hangs off `What` decisions, so settle the `What` first. When a `How` question surfaces during the `What`, **park** it for the `How` phase and keep it out of the round. When the `How` exposes a gap in the `What`, reopen that branch: ask it in the next round tagged **(What)**, and the frontier rule holds back the `How` questions that depend on it.

Close each phase, once its frontier is empty, with a **summary** of its settled decisions as a short bulleted list. The `What` summary opens with **Repositories**: each slug in scope with its one-line reason, plus any that need `/brain setup` or `/brain link`. It ends with the parked questions under **Parked for How**; the user's confirmation of it opens the `How`, with the parked questions in its first frontier.

When the `How` opens, invoke the `design-patterns` skill. Each module and contract `design-patterns` says to weigh is then a frontier question: recommend a pattern with its Where and Why, or no pattern when the problem doesn't call for one. The `How` summary adds four lists, which `/to-spec` reads: **Contracts**, each changed contract with its consumers and the settled path (expand–contract, additive only, or old shape kept); **Builds on**, each overlapping in-flight spec and what it shares; **Patterns**, as Pattern, Where and Why, the Where prefixed by its repository's slug when the design spans several; and **Notes read**, the absolute paths of the brain notes the session relied on.

## Rounds

Work each phase in **rounds**. The **frontier** is every decision whose prerequisites are already settled: the questions you can ask _now_ without guessing at answers you haven't heard yet, including answers to other questions in the same round. Ask the whole frontier in one round, then wait for the user's answers.

Leave no assumption unspoken: any choice you would otherwise make silently becomes a frontier question.

Each round of answers reshapes the tree: settled decisions unblock the questions that hung off them, and new answers can sprout new branches. Recompute the frontier and ask the next round.

Write every round in the format of [ROUND-FORMAT.md](references/ROUND-FORMAT.md).

### Facts and Decisions

Finding _facts_ is your job; the user only ever answers _decisions_. When a frontier question needs a fact from the environment (codebase, docs, tools), dispatch an `alper-brain:scout` agent to find it, its brief opening with the Context block by [BRIEF.md](../brain/references/BRIEF.md): one scout per repository the round's facts sit in, in one message, each answering every fact for its repository with its `path:line`, or "not found" with where it looked. A fact one known file answers, read inline. When the fact is owned outside the repositories (a library, API, standard or tool), invoke the `research` skill for it instead; its answer arrives in the background like a scout's. Keep the round moving: a running exploration is an unsettled prerequisite, so only the questions downstream of it wait for the sub-agent to report; ask the rest of the frontier now.

### Second brain

Follow [RECALL.md](../brain/references/RECALL.md) alongside `What · Round 1`, picking every repository the topic reaches by its **Pick the repositories**: a design can span several, and its notes are facts, so you look them up rather than ask. Each in-or-out call the notes leave open enters the round as a scope question. Each changed contract enters the `What` as a scope question (do its consumers change with it, or does the interface stay compatible?), and its mechanism is parked for the `How`, by [CONTRACT-CHANGE.md](../to-tickets/references/CONTRACT-CHANGE.md): expand–contract, additive only, or the old shape kept. A repository that is registered but not linked is designed from its notes alone, its explored notes standing in for its code, with the hint `/brain link`.

### In-flight specs

When the brain's `.sdd/specs/` holds specs, other specs may be planned or mid-build in the modules or contracts this design touches, in any repository. Follow [IN-FLIGHT.md](../to-spec/references/IN-FLIGHT.md) alongside `What · Round 1`, and again when the `How` opens, since the `How` names new modules. Each overlap with an in-flight spec enters the next round as a frontier question: build on its planned state, or revise it separately.

## Done

The session is done when the user confirms the `How` summary: every branch of the `What` and the `How` visited, nothing left silently assumed. That confirmation is the shared understanding; act on the plan only after it. `/to-spec` turns it into a spec.
