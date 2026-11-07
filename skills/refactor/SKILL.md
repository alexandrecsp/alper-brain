---
name: refactor
description: Scan the codebase for deepening and refactoring opportunities, show them as a visual HTML report, then brainstorm the one you pick into the spec pipeline.
argument-hint: "[<repo>] [module, area or pain point]"
disable-model-invocation: true
metadata:
  type: process
---

Find where the codebase's shape causes **friction**, and propose refactors that remove it. Candidates come through two lenses:

- **Deepening**: shallow modules merged or reshaped into a deep one, judged in the `codebase-design` skill's vocabulary and principles.
- **Smell**: a Fowler smell from the baseline in [SMELLS.md](../review-changes/references/SMELLS.md), with its named fix.

Every candidate preserves behaviour: a refactor changes the shape, never what the code does. The aim is testability and code an agent can navigate.

Scan the **working repository**, by [FORMAT.md](../brain/references/FORMAT.md). When the argument names a module, area or pain point but no repository, find which registered repository holds it, from the explored notes' descriptions and **Sources** and the cards' overviews, before falling back to FORMAT.md's rules. It must be linked in the active brain: when it is registered but not linked, tell the user to run `/brain link`; when it is not registered, `/brain setup`; then stop. Run every git command as `git -C <root>`.

## Process

1. **Load the vocabulary.** Invoke the `codebase-design` skill, and use its terms exactly in every candidate. Read the repository's [domain docs](../model-domain/references/DOMAIN-DOCS.md): modules are named in the glossary's terms ("the Order intake module"), and the candidates respect the ADRs and `decision` notes. Done when you know the terms, the ADR and `decision`-note decisions that bind the repository, its `gotcha` notes, and each `contract` note naming its slug with the repositories that consume it.

2. **Scope.** Deepening pays back through future changes, so look where **churn** is. When the user named a module, area or pain point, take it. Otherwise rank the **hot spots** by churn over the last six months (`git -C <root> log --since="6 months ago" --name-only --format=`), skipping lockfiles, generated and vendored code, and group them into areas by [AREAS.md](../brain/references/AREAS.md). Raise an area that a `gotcha` note names, or that holds the **Sources** of a feature note with many rules. When changes are scattered with no hot spot, take every area. Done when you can name the areas to scan, each with why.

3. **Explore.** Dispatch one `alper-brain:explorer` agent per area, in waves by BRIEF.md's **Fanning out**, each brief opening with the Context block by [BRIEF.md](../brain/references/BRIEF.md) (**Docs** the glossary and the absolute paths of `codebase-design`'s SKILL.md and DEEPENING.md and of review-changes' `SMELLS.md`, **Notes** the notes whose **Sources** fall in its area and the `contract` notes naming this slug, **Writes** nothing), with its area's paths, the area list, the ADR decisions, and this brief:

   > Walk this area and report where you feel **friction**. Explore by reading, following each concept to where it lives: where understanding one concept means bouncing between many small modules; where an interface is nearly as complex as its implementation; where logic was extracted for testability but the bugs hide in how it is called; where modules leak across their seams; which code is untested, or hard to test through its interface; and every baseline smell. Put each suspected shallow module through the deletion test: does deleting it concentrate complexity, or only move it? A `gotcha` note on this area marks friction someone has already hit. Report each candidate with:
   >
   > - **Lens**: deepening, or the smell's name.
   > - **Files**.
   > - **Problem** and **Refactor**: one sentence each.
   > - **Deletion test**: concentrates or only moves complexity (deepening only).
   > - **Shape**: the modules involved, which calls which, and where the seam sits before and after.
   > - **Dependencies**: each with its category from DEEPENING.md.
   > - **Tests**: how they would change.
   > - **Contract**: the contract note whose interface the refactor would change, or none.
   > - **Reaches**: each other area the candidate spans, or none.
   > - **Strength**: **Strong**, **Worth exploring** or **Speculative**.
   >
   > Report every candidate and every field, writing "none" for an empty one.

   Merge candidates that two areas report under **Reaches** into one. Drop a candidate an ADR or a `decision` note forbids, unless its friction is real enough to reopen that decision; keep that one, flagged with the decision and why. Done when every candidate has every field, re-dispatching an explorer whose report is missing one.

4. **Report.** Number the candidates `#1` to `#N`, strongest first; the number is the candidate's handle, so the user picks by it and you refer to it by it from here on. Write the candidates as one self-contained HTML file, the brain's `.sdd/refactors/<repo-slug>/<YYYY-MM-DD-HHmm>.html`, stamped with the branch and `git -C <root> rev-parse --short HEAD`, adding "uncommitted changes" when `git -C <root> status --porcelain` lists any. Build it by [HTML-REPORT.md](references/HTML-REPORT.md). Open it (`cmd /c start "" "<path>"` on Windows, `open` on macOS, `xdg-open` on Linux) and give the user its absolute path. Interfaces wait for step 5: the report names problems and refactors only. List each candidate's number and title in your reply, and ask: "Which of these would you like to explore? Pick by number." Done when the user has picked a candidate, or declined them all.

5. **Brainstorm the pick.** Invoke the `brainstorm` and `model-domain` skills, and run the rounds on the candidate by model-domain's **Beside brainstorm**.

   - **What**: the behaviour that must stay unchanged, the tests that pin it today and those it lacks, and the scope of the refactor.
   - **How**: the deepened module's interface, where its seam sits, what goes behind it, and how each dependency is tested by its category in DEEPENING.md. When the interface is contested, run `codebase-design`'s DESIGN-IT-TWICE.md.
   - A new module named after a concept missing from `GLOSSARY.md` adds the term as it settles.
   - When the user rejects the candidate for a reason a future scan would need, offer to record it: an ADR when the repository keeps `docs/adr/`, else a `decision` note in the brain by **Record** in the `brain` skill: "Want me to record this so future scans don't suggest it again?" Skip the offer for passing reasons ("not now").

   Done when the user confirms the How summary, or rejects the candidate; a rejection skips step 6.

6. **Size the refactor.** Check the confirmed How summary against five tests:

   - **One seam**: the existing tests at one confirmed seam pin the behaviour, or one new test there would.
   - **Local blast radius**: only callers inside the refactored area change; no caller elsewhere in the repository, and no repository a `contract` note names as a consumer, has to move in the same change.
   - **No contract crossed**: every interface a `contract` note records for this repository keeps its shape.
   - **No decision reopened**: the candidate carried no ADR or `decision`-note callout.
   - **One fresh context**: a single builder sub-agent could build it, with no earlier ticket to build on.

   When all five hold, the refactor is **contained**; otherwise it is **staged**. Done when you can name the size and the test that decided it.

7. **Hand over.** Give the user the size, the deciding test, and the next step, so they can override it:

   - **Contained**: `/write-tickets`, straight from this conversation with no spec, cutting one milestone of one ticket, then `/build`.
   - **Staged**: `/write-spec`, then `/write-tickets`, then `/build`. `/write-tickets` cuts a refactor that crosses a contract by its CONTRACT-CHANGE.md (expand in the producer, migrate each consumer, contract), with the producer and every consumer in the spec's **Repos**, and one whose blast radius spans the repository by its WIDE-REFACTOR.md.

   Done when the user has the next step; or, after a rejection, the record offer is answered or skipped for a passing reason, and any record accepted is written.
