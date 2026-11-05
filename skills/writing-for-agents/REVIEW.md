# Review

The review branch of [`writing-for-agents`](SKILL.md): check a document against the reference in a fresh context, so it is read the way its consumer reads it, cold, without the intent its author carries. Review in place only a change of a sentence or two to a document you did not write in this conversation.

1. **Gather the parts.** The document; every file it points to; and every pointer to it: its description, the lines of `AGENTS.md` or `CLAUDE.md` that name it, and every step that invokes it or dispatches to it (grep its name). For an agent definition, also every brief its callers hand it. Done when you hold the absolute path of every part.

2. **Dispatch.** Dispatch one sub-agent per document, all in one message, in the foreground, each brief opening with the Context block your plugin's briefs use (in alper-brain, `alper-brain:reviewer` by [BRIEF.md](../brain/BRIEF.md), with the document's repository under **Works in** and **Writes** nothing). Hand each one the absolute paths of `SKILL.md` and of each mechanics file whose branch applies (`SKILL-MECHANICS.md` for a skill, `AGENT-MECHANICS.md` for an agent definition or a brief), its document's parts, the list of every document under review, the model that runs the document (its agent's `model`, else the session's), and this brief:

   > Review this document against the reference, reading it cold, as the agent that runs it will. For every section of the reference and of each mechanics file given, and for every part, report a finding or `holds`. Report each finding with its `file:line`, the lever, the problem in one or two sentences, and the exact replacement text, ranked by how much it changes behaviour; skip any you are not confident changes it. Grade no-ops against the model given. Report each meaning you see repeated in a document outside yours. Done when every section and part has a finding or `holds`.

   Done when every report covers every section and part, re-dispatching a reviewer with the missing pairs named.

3. **Settle.** Open each cited line and drop any finding the file does not bear out. Join the repeated meanings the reports name across documents into findings of their own. When you and a reviewer disagree on whether a sentence is a no-op, run it: dispatch a fresh agent on the model given, with the document and a task that reaches the sentence, once with it and once without. Done when every finding is kept or dropped with its reason.
