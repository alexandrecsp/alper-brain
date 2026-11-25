---
name: research
description: Research an outside library, API, standard or tool against its primary sources, at the versions the repositories pin. Use when the user asks for a topic researched, or a question hinges on a fact no repository owns.
argument-hint: "[question]"
metadata:
  type: process
---

Research works in the active brain, by [FORMAT.md](../brain/references/FORMAT.md); when none is open, say so by FORMAT.md and stop.

## Process

1. **Frame the question.** Sharpen the user's question into the facts that would answer it, each one checkable. When the conversation shows what the answer is for (a `brainstorm` question, a ticket, a bug), carry that purpose along: it decides which facts matter. Name the registered repositories the question bears on, from their `REPO.md` cards and the conversation. Done when you can list the facts and the repositories.

2. **Read the pins.** For each linked repository picked, grep its manifest and lockfile for each library or tool the question names, and note the version it resolves to. A repository that is not linked has version **unknown**. Done when every picked repository has a version for each library, or unknown (n/a for a standard or API with no version).

3. **Check what the brain knows.** Follow [RECALL.md](../brain/references/RECALL.md) for the repositories picked, and read each `research/*.md` whose question bears on this one. A fact that a note or an earlier research file answers, for the versions pinned now, leaves the list; keep its source for the hand-over. A note the research may contradict goes into the brief as something to check. Done when every fact is marked known, with its source, or open. When none is open, go to step 7 with the known facts and no path.

4. **Pick the file.** `research/<slug>.md` in the active brain, with `<slug>` a short kebab-case name for the question. When a file already holds that path, it is an earlier run: add a numeric suffix unless the user wants it replaced. Done when you hold the path.

5. **Dispatch.** Group the open facts by the source that owns them; one library's docs at one version is one source. Start one `alper-brain:researcher` agent per group in the background, at most the cap at once by BRIEF.md's **Fanning out**, each brief opening with the Context block by [BRIEF.md](../brain/references/BRIEF.md) (the first linked repository picked under **Works in**, the rest under **Also reads**, all read only, both `none` when no linked repository is picked, **Notes** the notes to check, **Docs** the absolute path of [DIAGRAMS.md](../write-spec/references/DIAGRAMS.md), **Writes** its path: the research file with one group, `research/<slug>/<group>.md` with several), with the question, its group's facts, the purpose, each repository's pinned versions, and the other groups' sources.

   Done when every open fact sits in exactly one group, and every group has a researcher running or queued behind the cap; go back to the conversation, and start the next queued researcher as each one reports.

6. **Join.** Check each report: it names its path, short answer, unverified claims, open questions and contradicted notes, and the file at its path exists; re-dispatch a researcher whose report is missing one. With several groups, once every researcher has reported, write the research file yourself: the question, one short answer joining theirs, its diagram by the **Findings** section of DIAGRAMS.md, a link to each group's file, and every unverified claim and open question from the reports. Done when every report passes that check and, with several groups, every group's file is linked and every flag carried over.

7. **Hand over.** Give the user the path (none when step 3 left no open fact) and the short answer, with the known facts from step 3 and their sources, and flag every **unverified** claim, open question and note a researcher found contradicted. Then draft what the answer means for the repositories as notes, by the brain's [RECORD.md](../brain/references/RECORD.md): for each repository, the consequence for its code at the version it pins, typed by FORMAT.md and citing the primary sources, so the note stands without the research file. Leave out what the upstream docs state plainly. A fact that holds alike for several repositories goes in one note, with their slugs in `repos`; one that differs by version goes in one note per repository, naming its version. Done when the user has the answer, and each consequence sits in a draft, or none applied.
