---
name: research
description: Research an outside library, API, standard or tool against its primary sources, for the versions the repositories pin. Use when the user wants a topic researched, or docs and API facts gathered.
argument-hint: "[question]"
metadata:
  type: process
---

Research works in the active brain, by [FORMAT.md](../brain/references/FORMAT.md); when none is open, say so by FORMAT.md and stop.

## Process

1. **Frame the question.** Sharpen the user's question into the facts that would answer it, each one checkable. When the conversation shows what the answer is for (a `brainstorm` question, a ticket, a bug), carry that purpose along: it decides which facts matter. Name the registered repositories the question bears on, from their `REPO.md` cards and the conversation. Done when you can list the facts and the repositories.

2. **Read the pins.** For each linked repository picked, grep its manifest and lockfile (`package.json` with its lockfile, `go.mod`, `pyproject.toml` with `poetry.lock` or `uv.lock`, `Gemfile.lock`, …) for each library or tool the question names, and note the version it resolves to. A repository that is not linked has version **unknown**. Done when every picked repository has a version for each library, or unknown.

3. **Check what the brain knows.** Follow [RECALL.md](../brain/references/RECALL.md) for the repositories picked, and read each `.sdd/research/*.md` whose question bears on this one. A fact that a note or an earlier research file answers, for the versions pinned now, leaves the list; keep its source for the hand-over. A note the research may contradict goes into the brief as something to check. Done when every fact is marked known, with its source, or open. When none is open, hand over the known ones and stop.

4. **Pick the file.** `.sdd/research/<slug>.md` in the active brain, with `<slug>` a short kebab-case name for the question. When a file already holds that path, it is an earlier run: add a numeric suffix unless the user wants it replaced. Done when you hold the path.

5. **Dispatch.** Group the open facts by the source that owns them; one library's docs at one version is one source. Start one `alper-brain:researcher` agent per group in the background, in waves by BRIEF.md's **Fanning out**, each brief opening with the Context block by [BRIEF.md](../brain/references/BRIEF.md) (the linked repositories picked under **Works in** and **Also reads**, read only, **Notes** the notes to check, **Docs** the absolute path of [DIAGRAMS.md](../to-spec/references/DIAGRAMS.md), **Writes** its path: the research file with one group, `.sdd/research/<slug>/<group>.md` with several), with the question, its group's facts, the purpose, each repository's pinned versions, and this brief:

   > Answer these facts from primary sources: the official docs, source code, specs and first-party APIs that own each fact. Trace every claim back to the source that owns it; when only a secondary source states it, keep looking, and when the owner cannot be found, mark the claim **unverified**. Answer for the versions your brief lists for each repository: read that version's docs, or its source at that version's tag. A copy installed under a repository's root (`node_modules/<pkg>`, `vendor/`, the module cache) is that exact version's source. Where the repositories' versions behave differently, answer each version and say what differs. Name the version every source describes. Write the findings to your path as Markdown: the question, a short answer and its diagram by the **Findings** and **Syntax** sections of DIAGRAMS.md, then one section per fact with its source linked (a URL, or a file path and line), and an **Open questions** section for what the sources left unanswered. Done when every fact in your list has a section with its source, is marked **unverified**, or is listed under **Open questions**. Report the path, the short answer, each unverified claim and each open question.

   Done when every researcher is running; go back to the conversation.

6. **Join.** With several groups, once every researcher has reported, write the research file yourself: the question, one short answer joining theirs, its diagram by the **Findings** section of DIAGRAMS.md, a link to each group's file, and every unverified claim and open question from the reports. Done when every group's file is linked and every flag carried over.

7. **Hand over.** Give the user the path and the short answer, with the known facts from step 3 and their sources, and flag every **unverified** claim and open question. Then offer what the answer means for the repositories as notes, by **Record** in the brain's [SKILL.md](../brain/SKILL.md): for each repository, the consequence for its code at the version it pins, typed by FORMAT.md and citing the primary sources, since the research file stays on this machine. Leave out what the upstream docs state plainly. A fact that holds alike for several repositories goes in `shared/`, with their slugs in `repos`; one that differs by version goes in each repository's notes, naming its version. Done when the user has the answer, and has picked from the notes offered or none applied.
