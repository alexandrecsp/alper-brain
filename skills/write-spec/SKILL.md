---
name: write-spec
description: Turn the current conversation into a spec saved in the brain's .sdd/specs/, across one repository or several.
disable-model-invocation: true
metadata:
  type: process
---

Turn the current conversation and your understanding of the codebase into a spec. This is **synthesis**: the spec states only what the conversation settled. What it left to you (the seams, the pattern choices when it never weighed patterns, the dependencies, the key), you propose and the user confirms before you write. A decision the conversation left open goes under Further Notes as an open question.

The spec lives in the active brain's `.sdd/specs/` and can change several repositories, each registered in the brain, by [FORMAT.md](../brain/references/FORMAT.md). When no brain is open, say so by FORMAT.md and stop.

## Process

1. **Explore.** Name the repositories the feature changes: the ones the conversation settled, else by [RECALL.md](../brain/references/RECALL.md)'s **Pick the repositories**, and confirm them with the user when the conversation leaves one unclear. Each must be registered; for one that is not, ask the user to run `/brain setup` with it open, and stop. Read each one's [domain docs](../model-domain/references/DOMAIN-DOCS.md), which recall the brain's notes, and the code the feature touches in each linked repository, unless you already have; read a linked repository that is not open by its path. For each linked repository the conversation has not read, dispatch one `alper-brain:scout`, in parallel, its brief opening with the Context block by [BRIEF.md](../brain/references/BRIEF.md) (**Writes** nothing), with a paragraph of the settled What and How and this brief: "In this repository only, report every module the feature builds or changes, by its glossary name, with the interfaces that change and the modules that call them; for each, the existing tests that reach its behaviour, with the suite each runs in; each interface the feature touches that this repository offers to or calls from another repository, with that repository; and one or two existing tests new ones should copy. Cite each fact with its `path:line`." A repository that is not linked is planned from its notes alone, its explored notes standing in for its code; name it at step 5 with the hint `/brain link`. Without a glossary, use the terms the conversation settled. Done when you can name every module the feature builds or changes, each with its repository, and you hold the paths of the notes recall read and each changed contract with its consumers.

2. **Settle the dependencies.** Follow [IN-FLIGHT.md](references/IN-FLIGHT.md) for the modules and changed contracts from step 1; when the conversation already ran it, take its findings and check only the modules and contracts it did not cover. Each overlapping spec is a **dependency**: this spec is built after it lands. For each dependency, list the **assumptions** this spec makes about its planned state, each naming the repository or contract it is about: an interface, a seam, a behaviour, a term. Done when every dependency has its assumptions, and every possible overlap is settled with the user as a dependency or not.

3. **Sketch the seams.** Pick the seams where tests will prove the feature works. Each seam sits in one repository and runs in one of its suites (its card's `unit` or `e2e`), since each milestone checks itself in one repository. Prefer existing seams to new ones, and the highest seam that still reaches the behaviour; propose a new seam at the highest point you can. A changed contract gets a seam on each side, by [CONTRACTS.md](../tdd/references/CONTRACTS.md): in the producer, one proving it offers the new shape (and still the old, while consumers migrate), and in each consumer, one proving it handles the shape. Fewer is better; one per repository is ideal. Done when every behaviour discussed is reachable from a listed seam, every repository in **Repos** has at least one, and each seam names its repository and suite.

4. **Record patterns.** Take the pattern choices the conversation settled, including a decision that none is needed. When the conversation never weighed patterns, invoke the `design-patterns` skill and choose them by its rules. Done when each choice has its Pattern, Where and Why, or the spec states that none is needed.

5. **Confirm.** Show the user, each with your recommendation:

   - the repositories, each marked linked or not
   - the seams, each with its repository and suite
   - the pattern choices you made in step 4
   - the dependencies, each with its assumptions
   - each changed contract with its consumers and its proposed shape, pinned as [SPEC-TEMPLATE.md](references/SPEC-TEMPLATE.md)'s API contracts line asks, or why it cannot be pinned before the producer is built, which goes under Further Notes as an open question; a consumer missing from the repositories is a question: add it, or keep the interface compatible
   - the open questions, each with your recommended answer, to settle now or leave open
   - when a repository's card sets a `commitKeyPattern`, the spec's **key** (the optional prefix every commit for this spec carries, such as `FUNC-1234`), shaped as [FORMAT.md](../brain/references/FORMAT.md)'s **Key** line holds it

   When the user adds a repository, run steps 1 to 3 for it, then confirm again. Done when the user confirms every item, has settled or left open each open question, and gives the key line's entries, each fully matching its repository's pattern, or none.

6. **Write the spec.** Save it as `spec.md` in a new spec folder in the brain, `.sdd/specs/NNN-<slug>/`: `NNN` is one past the highest folder number already there (starting at `001`), and `<slug>` is the spec title in kebab-case. Fill [SPEC-TEMPLATE.md](references/SPEC-TEMPLATE.md) in plain prose, by [PROSE.md](../brain/references/PROSE.md), and check `spec.md` by its **Check**. Done when the check prints `prose: ok`, every section is filled from the conversation and steps 1 to 5, every diagram slot holds its diagram, and the spec holds together: every module-map module sits in a repository, those marked `new` or `changed` only in **Repos**; every arrow crossing a repository's edge with a changed interface appears under API contracts with its consumers and its pinned shape, or with an open question in Further Notes saying why its shape is not pinned; every repository in **Repos** has a seam; every **Depends on** entry has its Relies On bullets; and the user has the spec's path and the next step, `/write-tickets <spec-id>`, plus `/brain link` for any repository in **Repos** not linked yet.
