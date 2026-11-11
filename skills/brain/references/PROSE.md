# Plain prose

The writing rules for what people read: brain notes, brainstorm rounds, and the narrative parts of specs and tickets. They adapt the writing rules of ASD-STE100 (Simplified Technical English), so a teammate reads each sentence once, in any first language. The glossary of the repository the text is about stands in for the STE dictionary. Its terms are the **technical names**, and every other word is the plainest common word that fits.

## Where it applies

Each surface's sentences are **procedural** (they tell the reader to do, check or decide something) or **descriptive** (they say what is):

| Surface | Procedural | Descriptive |
|---|---|---|
| Brain note or draft, authored or explored | the **How to apply:** line, and the list right after it | the `description`, the body, the **Why:** line, the **Rules:** list |
| Repository card | | the body |
| Brainstorm round | each question and each option | each recommendation's reason |
| `spec.md` | | Problem Statement, Solution, User Stories, Out of Scope, Further Notes |
| `milestone.md` | **Done when** | **Delivers** |
| Ticket | Acceptance criteria | What to build |

Every other part of these files (header lines, Implementation Decisions, Relies On, Testing Decisions, tables, diagrams, code, a ticket's Notes) takes only rule 1.

## Rules

1. **One name per thing.** Name each module, entity and interface by its glossary term, the same term every time, never by a term the glossary lists under _Avoid_. Give each word one meaning in a file.
2. **Common words.** Take the short word: _use_, _start_, _end_, _before_, _after_, _if_, _about_. Write the verb itself (_test the import_), not a noun made from it (_perform testing of the import_).
3. **Short sentences.** A procedural sentence holds at most 20 words, a descriptive one at most 25. A code span, path or `[[link]]` counts as one word, and an acceptance criterion's `, proven at <seam>` ending counts as none.
4. **One action per sentence.** Write an instruction in the imperative, with its condition first: _When the retry fails, log the key._ Write a check (a criterion, a **Done when**) as one result the reader can see, and a question as one decision. Two actions take two sentences.
5. **Active voice.** Name who does the action: _The provider rejects the charge._ Use the passive in a descriptive sentence only when nobody knows or needs the actor.
6. **Full stops between clauses.** End a clause with a full stop where a semicolon or dash would join it to the next. A colon only introduces a list or an example.
7. **Clear references.** Write _it_ or _this_ only when its noun is in the same or the previous sentence, and is the only noun it can mean. Otherwise repeat the noun.
8. **The small words.** Keep _the_, _a_, _is_ and _that_. A sentence without them reads as a telegram and loses its meaning.
9. **Short paragraphs.** Limit a paragraph to six sentences. Write three or more parallel items as a list, and steps in order as a numbered list.
10. **Command, then reason.** In a warning or a **How to apply:** line, write the action first and its reason after it.

## Check

Run `node <PROSE.md's folder>/../scripts/prose.mjs <path>...` on each file or folder you wrote. The script checks sentence length (rule 3), paragraph length (rule 9), semicolons and spaced dashes (rule 6) and nine wordy phrases (rule 2). It reads only the sentences the table names, by the file's shape: a note or draft, a card, a `spec.md`, a `milestone.md` or a ticket. It prints one `<path>:<line>` line per finding. When it finds no file of these shapes, it prints `prose: no note, card, …` and fails.

Rewrite each flagged sentence. Then run the script again. When it prints `prose: ok`, read each sentence once against rules 1, 4, 5, 7 and 10, which the script cannot check. A brainstorm round has no file: before you send it, check each sentence against rules 3 and 4 yourself. Done when the script prints `prose: ok` and each sentence passes those rules.
