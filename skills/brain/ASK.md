# Ask

The `ask` branch of [`brain`](SKILL.md): answer a question that crosses repositories, from the active brain's notes and the code of every repository registered in it that the question reaches, then offer what the notes lacked as new notes. [FORMAT.md](FORMAT.md) defines the active brain, registered and linked.

1. **Recall across the brain.** Pull once per conversation, as [RECALL.md](RECALL.md) does. Grep the `description:` lines of every note under `repos/` and `shared/`, and read each note that bears on the question, plus the notes those link to. Done when every note bearing on the question is read.

2. **Pick the repositories.** Decide which registered repositories the question reaches, from the notes read, the contracts' `repos`, and each `REPO.md`'s summary. Done when every registered repository is in or out, each with a one-line reason.

3. **Scout.** Dispatch one `alper-brain:scout` agent per linked repository picked, in parallel, with the repository's path, the question, the paths of the notes read, and this brief:

   > Answer this question for this repository only. Read the code, docs and git history it needs, and check every file, function or flag the notes name. Report each fact with its `path:line`, each note the code contradicts with what the code does instead, and each thing the question needs from another repository: what this one sends or expects, and where. Change nothing.

   A picked repository that is not linked is answered from its notes alone. Done when every picked repository has a report or is marked notes-only.

4. **Answer.** Join the reports at their crossings: what one repository sends, another receives. Lead with the answer itself, then the facts behind it, each citing its `path:line` or note path. When the answer crosses two or more repositories, draw the path it takes between them as a Mermaid `flowchart`. Name the notes-only repositories, since their part of the answer is unchecked. Done when every part of the question is answered or named as open, and every fact cites its source.

5. **Keep what was learned.** Gather the facts the answer needed and no note held: each interface between repositories that no `contract` records, each trap or reason the code implies but no doc states. Drop whatever the code or its docs state plainly. Follow **Record** in [SKILL.md](SKILL.md) for the rest, as one list of candidates, and for each contradicted note, propose its fix or deletion. Done when the user has picked from the list, or nothing was left to offer.
