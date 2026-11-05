# Agent mechanics

The sub-agent branch of [`writing-for-agents`](SKILL.md): what changes when the document is an agent definition (`agents/*.md`) or a **brief**, the text a step hands a sub-agent. Both are read across a **context boundary**: the child sees its definition's body, the brief, and the files it opens, and nothing of the parent's conversation, skills or loaded reference. What the child needs and the brief leaves out is missing, so every gap at the boundary is a variance bug.

## Agent definitions

A definition is the half of the child's context that every dispatch shares; the brief is the half that varies. Put each fact on its side, once.

- **`description`** is the agent's dispatch pointer, loaded in every session where the plugin is installed: context load on every turn, pruned as hard as a model-invoked skill's description. Front-load the job's verb, and give agents that could be confused distinct leading words (_Standards review_, _Requirements trace_). Name what its brief must carry ("the facts its brief asks for", "under the constraint its brief names"), so a parent writing a dispatch knows what to hand over. End with who dispatches it when that fence is stable; a list of every caller is a cache of a grep, so prefer "Dispatched by build." for a single caller and a general fence for many.
- **`tools`** is a guardrail the environment enforces, so it beats any sentence. List the fewest tools the job needs, for every agent: a definition without `tools` inherits every tool in the session, connectors and publishing included. An agent that must invoke a skill needs `Skill`.
- **`model`** pins how much judgement the role gets: the more completely the brief specifies the work, the smaller the model; `opus` for decisions made in the user's place; `inherit` when the role should follow the session. A role that differs from another only in its model gets its own definition, pinned in frontmatter, rather than an override every dispatching step must remember.
- **The body** holds the role in one sentence, with the description's verb, then its `Done when`: the bar every dispatch of the role shares ("every finding named has exactly one Answer"), with the brief supplying what to apply it to. Environment facts every agent shares (where it starts, how it reaches files, what Bash is for, what to do with no user) live once, in a block every brief opens with; the body points at that block and says what to do when it is missing.

## Briefs

A dispatching step has two parts, kept apart: the **hand-over** ("with the Context block, the paths of the ticket and `spec.md`, and this brief:") and the **brief** itself, quoted, holding the job.

- **Hand over by absolute path** what the child can read: the repository's docs, the notes, this plugin's own reference files. A link relative to a skill's folder resolves for the parent and means nothing to the child. Paste only what the parent assembled itself (each ADR's title and decision, an area list, another child's report).
- **Read the brief as the child**, with no conversation behind it: every noun ("the finding", "the spec", "the repository") resolves only when the hand-over names it.
- **Settle the user's part.** The child has no user. Where a skill it follows would ask, the brief either decides it or says how to default, and the report lists each default taken so the parent can surface it.
- **End on the report.** The report is the child's completion criterion, so write its shape into the brief: named fields, each fact with its `path:line`, "writing 'none' for an empty one", and a checkable demand ("every hunk checked against every rule", not "report every finding"). Shape it for the step that consumes it: a parent that merges reports needs the same fields from every child.
- **Pair the guardrail with the job.** A read-only child gets "Change nothing" after the job it does; a writing child gets exactly the paths it may write and the commit it makes.
- **Leading words cross only in the brief.** A role word (_outsider_, _a guide preparing a tour_) recruits a whole stance in the child; a term the parent's skill defined reaches the child only when the brief defines it or names the file that does.

The parent's step ends on its own criterion, over the reports: "Done when every report has every field, re-dispatching a child whose report is missing one." Check the report's shape, not the child's word that it is done; after a child that writes, check what it wrote.

Dispatch in the foreground when the next step consumes the report; in the background when the conversation goes on and a later step picks the result up.

## Fan-out

Parallel children go out in one message, each with one **partition** of the work.

- **Partitions cover the whole without overlap**: every file in exactly one area, every variant with a constraint no other shares. Make that the completion criterion of the step before the fan-out, so a gap or an overlap fails there, not inside the reports.
- **Give each child the partition list**, so it knows its edge: it reports what crosses into a neighbour ("what this one sends or expects, and where") and leaves the neighbour to its own child.
- **The parent owns the crossings**: it joins what one child saw leaving with what another saw arriving, and checks every meaning no single partition can see (an interface across two repositories, a duplication across two files).
- **Attempts that must differ** (variants, alternative designs) get distinct constraints. The parent checks they came out distinct, and re-dispatches one with a sharper constraint when two converge.
