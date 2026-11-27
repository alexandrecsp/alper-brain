# Feature brainstorm

What a **feature** brainstorm adds to the rounds of [SKILL.md](../SKILL.md): a change to code in the brain's repositories, so its summary feeds `/write-spec`.

## Second brain

Follow [RECALL.md](../../brain/references/RECALL.md) alongside `What · Round 1` with the `business` layer ([DOMAIN.md](DOMAIN.md)'s read of the domain docs stands in for it), picking every repository the topic reaches by its **Pick the repositories**: a design can span several, and its notes are facts, so you look them up rather than ask. When the `How` opens, run its **Scan** again with the `application` layer, over the repositories the `What` put in scope. Each in-or-out call the notes leave open enters the round as a scope question. Each changed contract enters the `What` as a scope question (do its consumers change with it, or does the interface stay compatible?), and its mechanism is parked for the `How`, by [CONTRACT-CHANGE.md](../../write-tickets/references/CONTRACT-CHANGE.md): expand–contract, a change every consumer already tolerates, or the old shape kept. A repository that is registered but not linked is designed from its notes alone, its explored notes standing in for its code, with the hint `/brain link`.

## In-flight specs

When the brain's `.local/specs/` holds specs, other specs may be planned or mid-build in the modules or contracts this design touches, in any repository. Follow [IN-FLIGHT.md](../../write-spec/references/IN-FLIGHT.md) alongside `What · Round 1`, and again when the `How` opens, since the `How` names new modules. Each overlap, and each possible overlap, with an in-flight spec enters the next round as a frontier question: build on its planned state, or revise it separately.

## The How

When the `How` opens, read `code-design`'s [DESIGN-PATTERNS.md](../../code-design/references/design-patterns/DESIGN-PATTERNS.md). Each module and contract DESIGN-PATTERNS.md says to weigh is then a frontier question: recommend a pattern with its Where and Why, or no pattern when the problem doesn't call for one.

When a `How` question is a module's interface, or a contract other repositories consume, and the user has not named its shape, **design it twice**: run `code-design`'s [DESIGN-IT-TWICE.md](../../code-design/references/module-design/DESIGN-IT-TWICE.md). Its architects report in the background like an explorer, the question waits for them, and its comparison becomes that question's options, with its recommendation marked.

## Summaries

- The `What` summary opens with **Repositories**: each slug in scope with its one-line reason, plus any that need `/brain setup` or `/brain link`.
- The `How` summary closes with four lists, which `/write-spec` reads, each written `none` when empty:
  - **Contracts**: each changed contract with its consumers, its settled shape, and the path settled by [CONTRACT-CHANGE.md](../../write-tickets/references/CONTRACT-CHANGE.md).
  - **Builds on**: each overlapping in-flight spec and what it shares.
  - **Patterns**: as Pattern, Where and Why, by DESIGN-PATTERNS.md's **Recording**.
  - **Notes read**: the absolute paths of the brain notes the session relied on.
