# Domain docs

A repository's **domain docs** are its terms and the decisions that bind it: the brain's notes on it, and the `GLOSSARY.md` and `docs/adr/` the repository **keeps**. [FORMAT.md](FORMAT.md) defines the note types, **registered**, **linked** and **open**.

## Where each fact lives

A repository **keeps** a glossary when a `GLOSSARY.md` or a `GLOSSARY-MAP.md` sits at its root, and keeps ADRs when a `docs/adr/` folder does. Look at its root when it is linked; when it is only registered, an explored note whose **Sources** name one of them tells. The brain holds everything the repository does not keep, so a repository gains no `GLOSSARY.md` or `docs/adr/` it did not already have.

| Fact | Lives in |
|---|---|
| a term, as one repository means it | its `GLOSSARY.md` when it keeps one (under a `GLOSSARY-MAP.md`, its context's, by [CONTEXTS.md](CONTEXTS.md)); else a **term note**, by **A term** |
| a decision that binds one repository | its `docs/adr/` when it keeps one (under a `GLOSSARY-MAP.md`, its context's, or the root's when it spans contexts, by CONTEXTS.md); else a `decision` note, its `repos` naming that repository |
| an interface between repositories, and the terms that cross it | a `contract` note, its `repos` naming each side, with each side's term where they differ |
| a decision that binds several repositories | a `decision` note, its `repos` naming each |

`/brain explore` mirrors a kept glossary and ADRs into explored notes, by [EXPLORE.md](EXPLORE.md)'s **Merge**, so recall reaches every term and decision, and a repository that is only registered has them too. To change a term or decision a repository keeps, edit its file; the next explore rewrites the mirror.

## Read them

A repository's **glossary** is its kept `GLOSSARY.md` (under a `GLOSSARY-MAP.md`, that of each context the work touches) when it is linked; otherwise its term notes and other `business` concepts. Its **ADRs** are its kept `docs/adr/` (each context's, and the root's) when it is linked, and its `decision` notes. For each repository the work touches, list its notes with `node <this file's folder>/../scripts/recall.mjs <brain> --repo <slug> --type concept --type decision`, which lists its `contract` notes too. Read the kept files and each listed note that bears on the work, skipping an explored note that mirrors a kept file you read, and recall the repository's other notes by [RECALL.md](RECALL.md) at the layer the calling skill names. Done when each repository's glossary, ADRs and contract notes are read.

As a sub-agent, read the kept files and only the notes your brief's Context block lists; run no script and write nothing. With no brain open, the domain docs are the kept files alone.

Name each repository's code in its own glossary's terms, never by a word the glossary avoids (its `_Avoid_` line, or a term note's `avoid`), and keep the work within the decisions its ADRs and `decision` notes record.

## A term

- **Be opinionated.** When several words name one concept, pick the best and list the others as avoided.
- **Keep it tight.** One or two sentences that say what the term is, not what it does.
- **Only this repository's domain.** Define its own entities and rules (an Invoice, a refund window), and leave general programming concepts such as timeouts or error types to the code, however much it uses them.
- **Terms only.** An implementation decision is a decision, or part of the spec.

In a kept glossary, write the entry in the shape its other entries take. Otherwise write a **term note**: a `concept` note, `layer: business`, named `<slug>-<term>` with the term in kebab-case, its description and body the definition, its avoided words in `avoid`, and its `repos` naming the repository:

```markdown
---
name: billing-api-invoice
description: An Invoice is a request for payment sent to a customer after delivery
type: concept
layer: business
repos: [billing-api]
avoid: [bill, payment request]
---

A request for payment sent to a customer after delivery.
```

## A decision

Record a decision only when all three hold:

1. **Hard to reverse**: changing your mind later costs something real.
2. **Surprising without context**: a future reader will ask why it was done this way.
3. **A real trade-off**: there were genuine alternatives, and this one won for specific reasons.

Beyond architecture and lock-in, decisions that pass include a boundary or scope, the explicit no-s included ("other contexts reference a Customer by ID only"); a deliberate departure from the obvious path ("hand-written SQL instead of an ORM, because…"); a constraint the code cannot show ("no AWS, for compliance"); and a rejected alternative whose rejection is not obvious, so nobody proposes it again in six months.

In a kept `docs/adr/`, number it one past the highest (`0007-<slug>.md`) and write it in the shape the folder's ADRs take: at least a title, then one to three sentences of context, decision and reason; a reversal is a new ADR, the old one marked superseded the way the folder marks it. As a `decision` note, write it by FORMAT.md, its reason on its **Why:** line; a reversal supersedes it by FORMAT.md's **When a note stops being true**. When the decision has a shape (an architecture, a boundary, an integration between contexts), draw it by [DIAGRAMS.md](../../write-spec/references/DIAGRAMS.md)'s **Decision**.

## Write it

When a term or decision settles, write it to its home by **Where each fact lives**:

- **A brain note** (a term note, a `decision`, a `contract`): draft it by [RECORD.md](RECORD.md).
- **A kept file** needs its repository **open**. Otherwise add the entry to a **pending** list, with the root it waits on, and keep the work moving. An entry for a repository that is only registered, with no explored note to tell whether it keeps the file, waits there too, on `/brain link`.
- Once the calling skill's work is done (in a brainstorm, once the user confirms the `How` summary), ask the user once to run `/brain link` and `/add-dir` for what the pending list waits on, then write its entries by the rows above, and offer one commit per repository by `commit`, since `/build` stops on a dirty tree. Tell the user each entry still unwritten, with its text.

When a settled term contradicts a note you read, draft that note's fix by RECORD.md when it is authored; an explored note, a mirror included, catches up at the next `/brain explore`.

Done when each settled term and decision is a draft, an entry in its repository's kept file, or a pending entry the user was told of.
