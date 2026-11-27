---
name: refactor
description: Scan the codebase for deepening and refactoring opportunities, show them as a visual HTML report, then brainstorm the one you pick into the spec pipeline.
argument-hint: "[<repo>] [module, area or pain point]"
disable-model-invocation: true
metadata:
  type: process
---

Find where the codebase's shape causes **friction**, and propose refactors that remove it. Candidates come through two lenses:

- **Deepening**: shallow modules merged or reshaped into a deep one, judged in the vocabulary and principles of `code-design`'s [MODULE-DESIGN.md](../code-design/references/module-design/MODULE-DESIGN.md).
- **Smell**: a Fowler smell from the baseline in [SMELLS.md](../review-changes/references/SMELLS.md), with its named fix.

Every candidate preserves behaviour: a refactor changes the shape, never what the code does. The aim is testability and code an agent can navigate.

Scan the **working repository**, by [FORMAT.md](../brain/references/FORMAT.md). When the argument names a module, area or pain point but no repository, find which registered repository holds it, from the explored notes' descriptions and **Sources** and the cards' overviews, before falling back to FORMAT.md's rules. It must be linked in the active brain: when it is registered but not linked, tell the user to run `/brain link`; when it is not registered, `/brain setup`; then stop.

## Process

1. **Load the vocabulary.** Read `code-design`'s [MODULE-DESIGN.md](../code-design/references/module-design/MODULE-DESIGN.md), and use its terms exactly in every candidate. Read the repository's domain docs by [DOMAIN-DOCS.md](../brain/references/DOMAIN-DOCS.md)'s **Read them**: modules are named in the terms of the map ("the Order intake module"), and the candidates respect the `decision` notes. Done when you know the terms, the `decision` notes that bind the repository, its `how-to` notes, and each `contract` note naming its slug with the repositories that consume it.

2. **Scope.** Deepening pays back through future changes, so look where **churn** is. When the user named a module, area or pain point, take it. Otherwise rank the **hot spots** by churn over the last six months (`git -C <root> log --since="6 months ago" --name-only --format=`), skipping lockfiles, generated and vendored code, and group them into areas by [AREAS.md](../brain/references/AREAS.md). Raise an area that a `how-to` note names, or that holds the **Sources** of a feature note with many rules. When changes are scattered with no hot spot, take every area. Done when you can name the areas to scan, each with why.

3. **Explore.** Dispatch one `alper-brain:explorer` agent per area, in waves by BRIEF.md's **Fanning out**, each brief opening with the Context block by [BRIEF.md](../brain/references/BRIEF.md) (**Works in** the working repository, read only, **Docs** the absolute paths of `code-design`'s MODULE-DESIGN.md and DEEPENING.md and of review-changes' `SMELLS.md`, **Notes** the notes whose **Sources** fall in its area, the `how-to` notes whose `repos` names this slug, and the `contract` notes naming this slug, **Writes** nothing), with its area's paths, the area list, the decisions of the `decision` notes, and this brief:

   > Walk this area and report where you feel **friction**: shape that hurts testability or navigation. Each candidate keeps behaviour: it changes the shape, never what the code does. Explore by reading, following each concept to where it lives: where understanding one concept means bouncing between many small modules; where an interface is nearly as complex as its implementation; where logic was extracted for testability but the bugs hide in how it is called; where modules leak across their seams; which code is untested, or hard to test through its interface; and every smell in SMELLS.md. Put each suspected shallow module through the deletion test: does deleting it concentrate complexity, or only move it? A `how-to` note on this area marks friction someone has already hit. Report each candidate with:
   >
   > - **Lens**: deepening, or the smell's name.
   > - **Files**: each as `path:line`.
   > - **Problem** and **Refactor**: one sentence each.
   > - **Deletion test**: concentrates or only moves complexity (deepening only).
   > - **Shape**: the modules involved, which calls which, and where the seam sits before and after.
   > - **Dependencies**: each with its category from DEEPENING.md.
   > - **Tests**: how they would change.
   > - **Contract**: the contract note whose interface the refactor would change, or none.
   > - **Reaches**: each other area the candidate spans, or none.
   > - **Strength**: **Strong** when the deletion test concentrates complexity and the friction shows in churn, a `how-to` note or untested code; **Worth exploring** when the friction is real but the payoff hangs on a design choice; **Speculative** when the shape suggests friction nobody has hit.
   >
   > Report every candidate and every field, writing "none" for an empty one.

   Merge candidates that two areas report under **Reaches** into one. Drop a candidate a `decision` note forbids, unless its friction is real enough to reopen that decision; keep that one, flagged with the decision and why. Done when every candidate has every field, re-dispatching an explorer whose report is missing one.

4. **Report.** Number the candidates `#1` to `#N`, strongest first; the number is the candidate's handle, so the user picks by it and you refer to it by it from here on. Write the candidates as one self-contained HTML file, the brain's `docs/repos/<repo-slug>/<YYYY-MM-DD-HHmm>-refactors.html`, by [HTML-REPORT.md](references/HTML-REPORT.md), and hand it over by [THEME.md](../brain/references/THEME.md)'s **Hand-over**. The cards show shape and seams, and leave each interface's signatures to step 5. List each candidate's number and title in your reply, and ask: "Which of these would you like to explore? Pick by number." Done when the file holds one card per candidate with every field and both diagrams, it is handed over, and the user has picked a candidate or declined them all, which ends the skill.

5. **Brainstorm the pick.** Invoke the `brainstorm` skill, and run the rounds on the candidate as a **feature** brainstorm.

   - **What**: the behaviour that must stay unchanged, the tests that pin it today and those it lacks, and the scope of the refactor.
   - **How**: the deepened module's interface, where its seam sits, what goes behind it, and how each dependency is tested by its category in DEEPENING.md. When the How changes an interface a `contract` note records, or the user has not settled the interface's shape, design it twice by [DESIGN-IT-TWICE.md](../code-design/references/module-design/DESIGN-IT-TWICE.md) of `code-design`.
   - When the user rejects the candidate for a reason a future scan would need, offer to record it by [DOMAIN-DOCS.md](../brain/references/DOMAIN-DOCS.md)'s **Write it**: "Want me to record this so future scans don't suggest it again?" Skip the offer for passing reasons ("not now").

   Done when the user confirms the How summary; or rejects the candidate, the record offer is answered or skipped for a passing reason, any record accepted is written, drafted or told to the user as pending by **Write it**, and the skill ends.

6. **Size the refactor.** Check the confirmed How summary against five tests:

   - **One seam**: the existing tests at one confirmed seam pin the behaviour, or one new test there would.
   - **Local blast radius**: only callers inside the refactored area change; no caller elsewhere in the repository, has to move in the same change.
   - **No contract crossed**: every interface a `contract` note records for this repository keeps its shape.
   - **No decision reopened**: the candidate carried no `decision`-note callout.
   - **One fresh context**: a single builder sub-agent could build it, with no earlier ticket to build on.

   When all five hold, the refactor is **contained**; otherwise it is **staged**. Done when you can name the size and, for a staged one, each test it failed.

7. **Hand over.** Give the user the size, each test a staged one failed, and the next step, so they can override it:

   - **Contained**: `/write-tickets`, straight from this conversation with no spec, cutting one milestone of one ticket, then `/build`.
   - **Staged**: `/write-spec`, then `/write-tickets`, then `/build`. `/write-tickets` cuts a refactor that crosses a contract by its CONTRACT-CHANGE.md, with the producer and every consumer in the spec's **Repos**, and one whose blast radius spans the repository by its WIDE-REFACTOR.md.

   Done when the user has the next step.
