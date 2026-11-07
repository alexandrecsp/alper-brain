---
name: design-patterns
description: Design patterns and the rules for choosing one. Use when deciding whether a problem calls for a pattern, or recording a pattern choice.
user-invocable: false
metadata:
  type: reference
---

Each pattern name below is used exactly as written: the name alone carries its structure, so this catalogue says only when to choose each one.

## Choosing

- **Weigh every module the design builds or changes, and every contract between repositories it changes** (the module map's nodes and the arrows crossing its subgraphs). Each ends with a pattern and its Why, or with none needed.
- **Choose a pattern only for a problem the code has.** Name that problem as the pattern's "Why". Code that has no such problem gets no pattern; an unneeded pattern is Speculative Generality.
- **The layout's patterns come with it.** The repository's `docs/STRUCTURE.md`, or `project-structure` when it has none, already places Ports and Adapters, a Repository per aggregate, Dependency Injection at the composition root, and an adapter per driven port. Give them a row only where the design departs from the layout.
- **Prefer what is already in play.** For each problem, find the pattern its repository already uses for the same problem in the area touched, read by the repository's root ([FORMAT.md](../brain/references/FORMAT.md)), and in the brain's `decision` notes on it; choose the same one. Across repositories, what is in play is what the contract's `contract` note and its producer already use. Done when each problem names the pattern in play, or that none is.
- **A pattern from outside this catalogue** may be chosen when a well-known source names it. Give it the same "Why".

## Recording

Wherever a pattern choice is written down, record it as Pattern, Where and Why, one row per choice per repository. "Where" names the repository's slug, then the module in that repository's glossary terms, never a file path. A choice that spans repositories (an Outbox in the producer, an Idempotent Consumer in each consumer) takes one row per repository, so each milestone's tickets copy only their own.

| Pattern | Where | Why |
|---|---|---|
| Strategy | `billing-api` · pricing rules in the Order intake module | Three pricing schemes vary per Customer |

A spec's rows stay on this machine. A choice the next change must repeat outlives it as a brain note, recorded through the `brain` skill: in the `contract` note when it is about one contract (how it is versioned, delivered or deduplicated), as a `decision` note in `shared/` with its `repos` when it spans repositories otherwise, and in the repository's ADR, linked from a `decision` note, when it stays inside one repository that keeps ADRs.

## Catalogue

**Creation**: Abstract Factory, by its textbook intent, plus:
- **Factory Method**: callers need an object whose concrete type depends on runtime input. Skip when one concrete type exists.
- **Builder**: an object has many optional parts or must be assembled in steps. Skip when a constructor or an options object reads clearly.
- **Singleton**: choose only for a resource that is genuinely one per process and cannot be injected. Prefer Dependency Injection.

**Structure**: Composite, Proxy and Decorator, by their textbook intent, plus:
- **Adapter**: an existing or third-party interface must be translated into the one your code expects. A driven adapter that merely implements a port is the layout, not this choice.
- **Facade**: callers need one simple entry into a tangle of collaborators. Often the shape a deepened module takes (`codebase-design`).

**Behaviour**: Observer and Chain of Responsibility, by their textbook intent, plus:
- **Strategy**: one step has interchangeable algorithms chosen per call or per configuration.
- **State**: an object's behaviour changes with an explicit state, and the legal transitions matter.
- **Command**: actions must be queued, logged, undone or retried as values, each carrying its own execution. A use case's input, which `project-structure` also calls a command, is data only and is not this pattern.
- **Template Method**: several variants share a fixed sequence and differ in a few steps. Prefer Strategy when the steps vary independently.

**Application**: Repository, Unit of Work and Pipeline, by their textbook intent, plus:
- **Value Object**: a domain concept is defined by its values and needs validation in one place (Money, Email). The cure for Primitive Obsession.
- **Domain Event**: one part of the domain must react to something that happened in another part of the same repository, without a direct call. When the reacting part is in another repository, the event is a contract: see **Across repositories**.
- **Result type**: expected failures must be returned as values the caller handles, not thrown.

**Across repositories**: each sits on a contract, so its `contract` note names the choice, and a change to the contract is cut by `write-tickets`' [CONTRACT-CHANGE.md](../write-tickets/references/CONTRACT-CHANGE.md).
- **Transactional Outbox**: a repository must commit its own change and publish the event or call another repository relies on, and neither may happen without the other.
- **Idempotent Consumer**: a consumer can receive the same message twice (at-least-once delivery, retries, an outbox relay). Key it on the id the contract note names.
- **Tolerant Reader**: a consumer must keep working through the producer's expand step: it reads only the fields it uses and ignores the rest. Choose it where a consumer would break on a field it does not use.
- **Anti-Corruption Layer**: a consumer's glossary names the producer's concepts differently. Translate in its driven adapter, so the producer's terms stop at its edge.
- **Consumer-Driven Contract**: the producer must know a change breaks no consumer before it lands, since each repository lands and deploys alone. Each consumer's expectations run in the producer's suite; name that seam in the spec's Testing Decisions.
