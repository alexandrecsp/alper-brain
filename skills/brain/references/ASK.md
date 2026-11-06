# Ask

The `ask` branch of [`brain`](../SKILL.md): answer a question that crosses repositories, from the active brain's notes and the code of every repository registered in it that the question reaches, then offer what the notes lacked as new notes. [FORMAT.md](FORMAT.md) defines the active brain, registered and linked.

1. **Recall across the brain.** Pull once per conversation, as [RECALL.md](RECALL.md) does. Grep the `description:` lines of every note under `repos/` and `shared/`, and read each note that bears on the question, plus the notes those link to. Done when every note bearing on the question is read.

2. **Pick the repositories** the question reaches, by RECALL.md's **Pick the repositories**, from the notes read in step 1. Done when every registered repository is in or out, each with a one-line reason.

3. **Scout.** Take a snapshot of each linked repository picked, by FORMAT.md. Dispatch one `alper-brain:scout` agent per snapshot, in waves by BRIEF.md's **Fanning out**, each brief opening with the Context block by [BRIEF.md](BRIEF.md) (**Works in** the snapshot, read only, **Notes** the paths of the notes read, **Writes** nothing), with the repository's slug, the other picked slugs, the question and this brief:

   > Answer this question for this repository only. Read the code, docs and git history it needs, and check every file, function or flag the notes name. Report every field, writing "none" for an empty one:
   >
   > - **Facts**: each fact the answer needs, with its `path:line`.
   > - **Crossings**: each thing the question needs from another repository: what this one sends or expects, which way, the other repository's slug when it is one of the other picked slugs, and the `path:line` where it happens.
   > - **Contradicted**: each note the code contradicts, with what the code does instead.

   A picked repository that is not linked is answered from its notes alone, its explored notes standing in for its code. Done when every picked repository is marked notes-only or has a report with every field, re-dispatching a scout whose report is missing one; then remove each snapshot.

4. **Answer.** Join the reports at their crossings: what one repository sends, another receives. Lead with the answer itself, in the words the question was asked in: a question in product terms gets a product answer, with the paths kept to its citations. Then give the facts behind it, each citing its `path:line` or note path. When the answer crosses two or more repositories, draw the path it takes between them as a Mermaid `flowchart`. For each notes-only repository, say how old its part is, by FORMAT.md: when it was explored, and whether it is current, behind or unknown. When it has no explored notes, say that a teammate who has it linked can run `/brain explore <slug>`. Done when every part of the question is answered or named as open, and every fact cites its source.

5. **Keep what was learned.** Gather the facts the answer needed and no note held: each interface between repositories that no `contract` records, each trap or reason the code implies but no doc states. Drop whatever the code or its docs state plainly. Follow **Record** in [SKILL.md](../SKILL.md) for the rest, as one list of candidates, and for each contradicted authored note, propose its fix or deletion; for a contradicted explored note, suggest `/brain explore <slug>`. When the answer needed a feature or flow of a linked repository that no explored note holds, suggest `/brain explore <slug>`. Done when the user has picked from the list, or nothing was left to offer.
