# Domain docs

A repository's **domain docs** are its terms and the decisions that bind it: the brain's notes on it. [FORMAT.md](FORMAT.md) defines the note types, **registered**, **linked** and **open**.

## Where each fact lives

The brain holds every term and decision, so a repository needs no file of its own for them.

| Fact | Lives in |
|---|---|
| a term, as one repository means it | a pairing of a **term note**, by **A term** |
| a decision that binds one repository | a `decision` note, its `repos` naming that repository |
| an interface between repositories, and the terms that cross it | a `contract` note, its `repos` naming each side, with each side's term where they differ |
| a decision that binds several repositories | a `decision` note, its `repos` naming each |

[ABSORB.md](ABSORB.md) drafts these notes from a repository's old glossary and ADRs, so recall reaches them even for a registered repository. Change a term or decision in the brain.

## Read them

A repository's **terms** are the term notes whose `repos` names it, with their pairings. Its **decisions** are its `decision` notes. For each repository the work touches, list its notes with `node <this file's folder>/../scripts/recall.mjs <brain> --repo <slug> --type term --type concept --type decision`, which lists its `contract` notes too. Read each listed note that bears on the work, and recall the repository's other notes by [RECALL.md](RECALL.md) at the layer the calling skill names. Done when each repository's terms, decisions and contract notes are read.

As a sub-agent, read only the notes your brief's Context block lists; run no script and write nothing. With no brain open, there are no domain docs: tell the user to open the brain when the work touches the domain.

Name each repository's code in the words of its own pairings. Never use a word a pairing avoids (its `Avoid:` line, or the term note's `avoid`). Keep the work within the decisions its `decision` notes record.

## A term

- **One meaning.** A term has one meaning in every repository. When two repositories use one word for two things, write two terms, and let each term's pairing name the word.
- **Name it in English.** Give the term an English name in kebab-case, with no repository prefix: `customer`, not `billing-api-customer`. List the other words for it, in any language, as `aliases`, so a search in those words finds the term.
- **Give each pairing a degree.** Add one pairing line for each repository, or each context of it, that has a word for the term. Give the line the repository's word and a degree. Use `same` when the word is the term, `narrower` when it covers only part of the term, and `broader` when it covers more than the term.
- **Be opinionated.** When several words name one concept, pick the best and list the others as avoided: on the pairing line when one repository avoids them, in `avoid` when the domain does.
- **Keep it tight.** One or two sentences that say what the term is, not what it does.
- **Only the business's domain.** Define its own entities and rules (an Invoice, a refund window), and leave general programming concepts such as timeouts or error types to the code, however much it uses them.
- **Terms only.** An implementation decision is a decision, or part of the spec.

Write a **term note** by FORMAT.md's **The term note**: a `term` note in `notes/domain/`, named for the term, its description and body the definition, its `repos` naming every repository its pairings name:

```markdown
---
name: customer
description: A Customer is a person or company that pays for what the shop delivers
type: term
repos: [billing-api, web-app]
aliases: [cliente, buyer, shopper]
avoid: [client]
---

A person or company that pays for what the shop delivers. It starts as a visitor and becomes a customer at its first payment.

## Pairings
- billing-api: `Customer`, narrower. Only who has paid at least once. Avoid: `buyer`.
- web-app · checkout: `User`, broader. Anyone signed up.

## Relations
- places [[order]]
```

## A decision

Record a decision only when all three hold:

1. **Hard to reverse**: changing your mind later costs something real.
2. **Surprising without context**: a future reader will ask why it was done this way.
3. **A real trade-off**: there were genuine alternatives, and this one won for specific reasons.

Beyond architecture and lock-in, decisions that pass include a boundary or scope, the explicit no-s included ("other contexts reference a Customer by ID only"); a deliberate departure from the obvious path ("hand-written SQL instead of an ORM, because…"); a constraint the code cannot show ("no AWS, for compliance"); and a rejected alternative whose rejection is not obvious, so nobody proposes it again in six months.

Write it as a `decision` note by FORMAT.md, its reason on its **Why:** line; a reversal supersedes it by FORMAT.md's **When a note stops being true**. When the decision has a shape (an architecture, a boundary, an integration between contexts), draw it by [DIAGRAMS.md](../../write-spec/references/DIAGRAMS.md)'s **Decision**.

## Write it

When a term or decision settles, draft it by [RECORD.md](RECORD.md) as a note by **Where each fact lives**: a term note, a `decision` or a `contract`. A draft needs no repository open, so nothing waits.

When a settled term contradicts a note you read, draft that note's fix by RECORD.md when it is authored; an explored note catches up at the next `/brain explore`.

Done when each settled term and decision is a draft.
