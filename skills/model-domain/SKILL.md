---
name: model-domain
description: Build and sharpen each repository's domain model, its glossary and decisions. Use when discussing domain terms, editing a GLOSSARY.md, or recording an ADR.
user-invocable: false
metadata:
  type: process
---

# Domain Modeling

Actively build and sharpen the domain model as you design: challenge terms, invent edge-case scenarios, and write the glossary and decisions down the moment they settle.

## Where it lives

Each repository the topic touches is its own context, with its own glossary and ADRs. Read the [domain docs](references/DOMAIN-DOCS.md) of every one of them before the first challenge: their glossaries are what you challenge against, and their notes are what you check terms and decisions against. Write each settled fact where DOMAIN-DOCS.md's table puts it.

Create files lazily: a `GLOSSARY.md` or a `docs/adr/` folder only when its first entry is written. When a `GLOSSARY-MAP.md` sits at a repository's root, it holds several contexts: follow [CONTEXTS.md](references/CONTEXTS.md).

## During the session

### Challenge against the glossary

When the user uses a term that conflicts with the language of the glossary of the repository it belongs to, call it out immediately. "Your glossary defines 'cancellation' as X, but you seem to mean Y. Which is it?" One word defined two ways in two repositories is two contexts, not a conflict: the contract between them records the translation.

### Sharpen fuzzy language

When the user uses vague or overloaded terms, propose a precise canonical term. "You're saying 'account': do you mean the Customer or the User? Those are different things."

When the term crosses an interface a `contract` note records, settling a new name changes the contract: raise it as the contract question `brainstorm` asks (do its other repositories change with it, or does the interface keep the old name?), and record the mapping in the contract note when the two sides keep different words.

### Discuss concrete scenarios

When domain relationships are being discussed, stress-test them with specific scenarios. Invent scenarios that probe edge cases and force the user to be precise about the boundaries between concepts.

### Cross-reference with code

When the user states how something works, check whether the code of each repository it involves agrees, and surface a contradiction: "Your code cancels entire Orders, but you just said partial cancellation is possible. Which is right?"

Beside `brainstorm`, the check is a fact: its **Facts and Decisions** sends it to a scout, and the round moves on. On your own, read one repository's code yourself. For a claim spanning several linked repositories, dispatch one `alper-brain:scout` per repository in one message, each brief opening with the Context block by [BRIEF.md](../brain/references/BRIEF.md), with the claim. Read glossaries yourself: they are short, and a challenge quotes them exactly.

### Write it down as it settles

When a term settles, write it where [DOMAIN-DOCS.md](references/DOMAIN-DOCS.md) puts it, in [GLOSSARY-FORMAT.md](references/GLOSSARY-FORMAT.md)'s format. A glossary or ADR in a repository needs that repository **open** ([FORMAT.md](../brain/references/FORMAT.md)). When it is only linked, add the entry to a **pending** list and keep the session moving. When it is only registered, the term rides on to the spec. A brain note needs only the brain: write it through **Record** in the [brain skill](../brain/SKILL.md).

A glossary holds terms and their definitions only: an implementation decision is an ADR or part of the spec. When a settled term contradicts a brain note you read, draft that note's fix through **Record** when it is authored; an explored note catches up at the next `/brain explore`.

### Offer ADRs sparingly

Only offer to create an ADR when all three are true:

1. **Hard to reverse**: the cost of changing your mind later is meaningful
2. **Surprising without context**: a future reader will wonder "why did they do it this way?"
3. **The result of a real trade-off**: there were genuine alternatives and you picked one for specific reasons

Weigh each candidate against **What qualifies** in [ADR-FORMAT.md](references/ADR-FORMAT.md) before offering, and write the accepted ones in its format, where [DOMAIN-DOCS.md](references/DOMAIN-DOCS.md) puts them: a decision that binds several repositories passes the same tests, and becomes a brain `decision` note.

## Beside brainstorm

When this skill runs beside `brainstorm`, the brainstorm drives: its rounds, phases and summaries stay as written, and this skill feeds them.

- Read the domain docs of every repository the topic touches alongside `What · Round 1`. They include the brain's recall, so they stand in for brainstorm's own.
- Each challenge (a conflicting or fuzzy term, an edge-case scenario) enters the current round as a frontier question. Across repositories, challenge a word with two meanings only where the design carries the concept across that boundary, and ask which meaning the contract carries.
- A claim about how the code works is a fact, checked by brainstorm's **Facts and Decisions**; each contradiction enters the next round as a frontier question.
- A settled decision that passes the three tests enters the next round as a frontier question, naming where it would go: a repository's `docs/adr/`, a context's, or a `shared/` decision note. Recommend yes or no.
- Each phase summary ends with **Domain docs**: per repository, the terms written, the ADRs written or declined, and the pending writes with what they wait on; cross-repository terms and decisions under the brain.

## Done

Done when every settled term is written in its home by DOMAIN-DOCS.md, and every decision that passed the three tests has been offered and, when accepted, written. Close it out in this order:

1. Ask the user once to run `/add-dir` for each root the **pending** list names, then write its entries.
2. Offer to commit each repository's domain-doc changes with `commit`, one commit per repository, since `/build` stops on a dirty tree.

Beside `brainstorm`, done when the user confirms the `How` summary with its **Domain docs** list complete, closed out as above.
