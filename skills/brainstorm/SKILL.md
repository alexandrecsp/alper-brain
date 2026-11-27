---
name: brainstorm
description: Brainstorm a feature, a skill or agent, a decision or open ideas with the user, round by round, until you share one understanding. Use when the user asks to brainstorm or to stress-test a plan.
argument-hint: "[topic]"
metadata:
  type: process
---

Interview the user relentlessly until you reach a shared understanding. Map this as a **design tree**: every decision branches into the decisions that hang off it.

## Kind

Before `What · Round 1`, infer the brainstorm's **kind** from the topic and the conversation. The kind decides what the tree is about, what the closing summary holds, and the next step it hands to. When the topic leaves the kind open (two kinds fit, or none), Round 1 holds that choice alone, your pick recommended, since every other question depends on it. Name the kind in the heading line of the first round that follows its choice. Done when the kind is named in a round heading.

| Kind | Tell | Read when the kind is set | The `How` summary | Next step |
|---|---|---|---|---|
| **Feature**: a change to code in the brain's repositories, a refactor included | behaviour a repository should gain or lose, a module to reshape | [FEATURE.md](references/FEATURE.md) | the decisions, then FEATURE.md's four lists | `/write-spec` |
| **Agent document**: a skill, an agent, a reference, a `CLAUDE.md` | names a skill, an agent, a slash command or a prompt for Claude Code, here or in another plugin | invoke `write-for-agents` | **Design**: name and invocation, the description's branches, the steps with their completion criteria, what moves to references, the agents it dispatches | write it by `write-for-agents` |
| **Decision**: a choice between options, with nothing built yet | "X or Y", "should we", a tool, vendor or approach | none | **Decision**: the options weighed, the choice, its reason, and what would reverse it | record it where [DOMAIN-DOCS.md](../domain-modeling/references/DOMAIN-DOCS.md) puts a decision: an ADR by `domain-modeling`'s **Offer ADRs sparingly**, or a brain `decision` note drafted by [RECORD.md](../brain/references/RECORD.md) |
| **Exploration**: open ideas, no choice owed yet | "ideas for", "what could we", "explore" | none | **Ideas**: each idea kept, ranked, with its one-line case; each dropped, with why; the open questions | save it as a page by `html`, or as a brain note drafted by [RECORD.md](../brain/references/RECORD.md), or brainstorm the top idea as its own kind |

**Domain docs.** When the brainstorm settles what a registered repository's domain concepts mean or how they relate, invoke the `domain-modeling` skill and run it beside this one by its **Beside brainstorm**, so the glossary and ADRs are written as the design settles. That is every feature, and a decision or exploration about a repository's business; an agent document, or a topic no repository owns, runs without it. When domain terms first surface later in the session, invoke it then. Tell the user in one line above the round when it joins.

The kind can change mid-session: an exploration or a decision that settles on one thing to build becomes a feature or an agent document. Say so in the next round's heading line and keep every settled decision. Then run what the new kind adds to the phases already settled (its reads and its `What` summary lists), and ask the user to confirm the changed `What` summary before the `How` goes on.

## What, then How

The tree has two aspects, in every kind:

1. **What** is the outcome: the problem, who it serves, scope, behaviour, constraints, and what success looks like. In a decision or an exploration, it is also the criteria an option or idea is judged by.
2. **How** is the mechanism: approach, architecture, tools, data, sequencing, the choices that deliver the `What`. In a decision, the options; in an exploration, the ideas.

To sort a decision: if two different implementations could both satisfy it, it is a `What`; if it chooses between implementations, it is a `How`.

Every `How` decision hangs off `What` decisions, so settle the `What` first. When a `How` question surfaces during the `What`, **park** it for the `How` phase and keep it out of the round. When the `How` exposes a gap in the `What`, reopen that branch: ask it in the next round tagged **(What)**, and the frontier rule holds back the `How` questions that depend on it.

### Summaries

Close each phase, once its frontier is empty (in an exploration, once the user adds no more ideas), with a **summary** of its settled decisions as a short bulleted list, and ask the user to confirm it. Beside `domain-modeling`, each summary ends with the **Domain docs** list `domain-modeling` adds, after the lists named here.

- The `What` summary's last list of its own is **Parked for How**. The user's confirmation opens the `How`, with the parked questions in its first frontier.
- The `How` summary closes with the list its kind names in **Kind**, every item of it filled or written `none`.

## Rounds

Work each phase in **rounds**. The **frontier** is every decision whose prerequisites are already settled: the questions you can ask _now_ without guessing at answers you haven't heard yet, including answers to other questions in the same round. Ask the whole frontier in one round, then wait for the user's answers.

Leave no assumption unspoken: any choice you would otherwise make silently becomes a frontier question.

Each round of answers reshapes the tree: settled decisions unblock the questions that hung off them, and new answers can sprout new branches. Recompute the frontier and ask the next round.

Write every round in the format of [ROUND-FORMAT.md](references/ROUND-FORMAT.md).

### Facts and Decisions

Finding _facts_ is your job; the user only ever answers _decisions_. When a frontier question needs a fact from the environment (codebase, docs, tools), dispatch one `alper-brain:explorer` agent per repository the round's facts sit in, in the background and in waves by [BRIEF.md](../brain/references/BRIEF.md)'s **Fanning out**, each brief opening with the Context block by BRIEF.md (**Works in** the repository, read only, **Writes** nothing) and listing that repository's facts as questions. A fact one known file answers, read inline. When the fact is owned outside the repositories (a library, API, standard or tool), invoke the `research` skill for it instead; its answer arrives in the background like an explorer's. Keep the round moving: a running exploration is an unsettled prerequisite, so only the questions downstream of it wait for the sub-agent to report; ask the rest of the frontier now. A fact an explorer reports "not found" enters the next round as a question for the user. Done when each fact the round needs is answered with its `path:line`, or enters the next round as a question for the user, re-dispatching an explorer whose report leaves a question unanswered.

The brain's notes are facts too: when the topic touches a registered repository, recall its notes by [RECALL.md](../brain/references/RECALL.md) alongside `What · Round 1`, rather than asking. A feature recalls by FEATURE.md's **Second brain** instead.

## Done

The session is done when the user confirms the `How` summary in its kind's form: every branch of the `What` and the `How` visited, nothing left silently assumed. That confirmation is the shared understanding; act on it only after. Then offer the kind's next step and wait for the user's go.
