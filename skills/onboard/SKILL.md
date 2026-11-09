---
name: onboard
description: Tour one repository for a newcomer who will code in it, as an HTML page with its map, journeys, areas and commands, then offer the undocumented terms, decisions and contracts it found.
argument-hint: "[<repo>]"
disable-model-invocation: true
metadata:
  type: process
---

Write a **tour** of the codebase for a **newcomer**: someone who knows the stack but not this repo. The tour is a guided path of **stops**, from the big picture down to where each thing lives, built on the **journeys** a request takes through the code. Every fact in it is **grounded**: it names the file it comes from, so the newcomer can go and look.

Tour the **working repository**, by [FORMAT.md](../brain/references/FORMAT.md): run every git command as `git -C <root>`. It must be linked in the active brain: when it is not registered, tell the user to run `/brain setup`; when it is registered but not linked, tell them to run `/brain link`; then stop. Open every scout's brief with the Context block by [BRIEF.md](../brain/references/BRIEF.md): **Works in** this repository, read only, **Writes** nothing.

## Process

1. **Survey.** Read the README, the manifests (`package.json`, `pyproject.toml`, `go.mod`, …), `docs/STRUCTURE.md`, the repository's `AGENTS.md` or `CLAUDE.md`, its `REPO.md` card, and the [domain docs](../model-domain/references/DOMAIN-DOCS.md) with every context's glossary and ADRs. Recall the repository by [RECALL.md](../brain/references/RECALL.md), reading every note in `repos/<slug>/` and every `shared/` note whose `repos` names the slug, and note whether its explored notes are current, behind or missing, by FORMAT.md. Split the tracked files into **areas** by [AREAS.md](../brain/references/AREAS.md). Done when the split is done and every note on the repository is read.

2. **Fan out.** Dispatch one `alper-brain:scout` agent per area, in waves by [BRIEF.md](../brain/references/BRIEF.md)'s **Fanning out**. Each Context block's **Docs** names the glossary and `docs/STRUCTURE.md`, and its **Notes** the notes whose **Sources** fall in its area or that name its files. Then give each its area's paths, the area list, each ADR's title and decision, the slug and card summary of every other registered repository, the `contract` notes naming this one, and this brief:

   > Walk this area as a guide preparing a tour of it for a newcomer who knows the stack but not this repo. Report each fact with the file it comes from:
   >
   > - **Purpose**: what the area does, in one sentence in the glossary's terms.
   > - **Entry points**: every route, command, handler, job, page or exported function that the outside world or another area calls, with its kind and the other areas and repositories it calls into.
   > - **Key modules**: at most eight, each with its interface in one line.
   > - **Dependencies**: every other area, every other registered repository (by slug, naming the contract when one is given), and every external system it calls or is called by, and how (import, HTTP, queue, database).
   > - **Data**: the entities it owns and where they are stored.
   > - **Tests**: where they live, their kinds, and the command that runs only them.
   > - **Changes**: the three to five kinds of change `git log` shows most often in this area, each as "to change X, go to `path`", with a commit that made one.
   > - **Gaps**: terms the code uses that the glossary lacks or defines differently, each with the definition the code implies; and decisions the code makes that are hard to reverse and surprising, but that no ADR records.
   > - **Contradicted**: each note given to you that the code contradicts, with what the code does instead.
   >
   > Report every field, writing "none" for an empty one.

   Done when every area's report has every field, re-dispatching a scout whose report is missing one.

3. **Trace journeys.** Rank the entry points across all reports by how many areas and repositories they call into, counting each explored flow note that starts at one as a tie-breaker. Pick the top two or three, preferring different kinds (a user request and a background job over two requests) and, when one exists, an entry point that crosses into another repository. Dispatch one scout per journey in parallel, with the Context block (**Also reads** the linked repositories its contracts name), the area reports as its map, and this brief:

   > Trace this entry point end to end, from where it is called to its effect: data stored, response returned, event emitted. When it crosses into another repository your Context block names, follow it there to its effect. Report every **hop** in order, each with its function, its file, its area and its repository, and name the contract at each crossing.

   Done when every journey is an ordered list of hops, each with its function, file, area and repository.

4. **Write the tour.** Write the brain's `.sdd/tours/<slug>/<YYYY-MM-DD-HHmm>.html` by [TOUR-HTML.md](references/TOUR-HTML.md). Stamp it with `git -C <root> rev-parse --short HEAD` and the branch `git -C <root> branch --show-current` names, adding "uncommitted changes" when `git -C <root> status --porcelain` lists any. Open it (`cmd /c start "" "<path>"` on Windows, `open` on macOS, `xdg-open` on Linux) and give the user its absolute path. Done when every area has its card, every journey its card, and every fact on the page is grounded.

5. **Offer the gaps.** Merge the reports' gaps, undocumented cross-repository dependencies and contradicted notes into one numbered list, one entry per item, in three groups: **terms** (with the definition the code implies), **decisions**, and **brain notes** (each dependency on another registered repository that no `contract` note records, and each contradicted note with its fix). Ask which terms and decisions to record, by number; the brain notes go to **Record** as drafts, and `/brain sync` lets the user pick from them.
   - A chosen term or decision changes the repository, so it needs it open: when it is not, ask the user to run `/add-dir <root>`, or to record it as a brain note instead. Invoke the `model-domain` skill to write each term where its DOMAIN-DOCS.md puts it. A decision becomes an ADR once the user gives its reason: the code shows what was decided, and only the user knows why.
   - Follow **Record** in [brain's SKILL.md](../brain/SKILL.md) for the chosen brain notes. A contradicted explored note is fixed by `/brain explore <slug>`: suggest it, as you do when the explored notes are behind or missing.

   Done when the user has chosen or declined every term and decision, each chosen one is written, and each brain note sits in a draft.
