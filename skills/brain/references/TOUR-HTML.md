# Tour HTML

Built on the [report theme](THEME.md): its scaffold, hero, card and diagram canvas, filled as below. The tour reads top to bottom as its stops, each a `<section>` headed by its name in `h text-2xl`. Diagrams carry the big picture and the journeys; the cards and tables carry the detail.

Every file path is the theme's **File link**, under the clone's root, never under a snapshot, which [TOUR.md](TOUR.md) removes before the page is written.

## Scaffold

- **Report name**: "Tour".
- **Nav**: one anchor per stop: Big picture, Journeys, Areas, Where things live, Vocabulary, Run and test.
- **Sections**: the six stops below, in order.

## Hero

- **Eyebrow**: the theme's, its stamp taken from TOUR.md's source: the branch read and the target's short SHA.
- **Headline**: what the system does, in one sentence, and under it a line naming the stack.
- **Stat tiles**: Areas, Journeys, Entry points, Terms.
- **Start here** row: the first journey's title, linking to its card.

## Big picture

A **context map** on a diagram canvas: a Mermaid `flowchart LR` with one node per area, labelled in the map's terms, an edge per dependency labelled with how it calls (`HTTP`, `queue`, `import`), and each external system as a cylinder (`[(Postgres)]`) or a subroutine node (`[[Stripe]]`). Draw it by [DIAGRAMS.md](../../write-spec/references/DIAGRAMS.md)'s smallest-view rule, with its nodes unmarked: the tour describes the code as it stands. With more than a dozen areas, group them in `subgraph`s by app or context. Around the areas, draw one node per other registered repository this one produces for or consumes from, as a stadium (`([web-app])`), each edge labelled with its `contract` note's name: draw them from the contract notes and the cards. Under the map, one line per area: its name linking to its card, and its purpose.

## Journeys

One card per journey, its top edge `var(--sky)`:

- **Meta row**: the entry point's kind as a chip.
- **Title**: "What happens when…", in the map's terms ("What happens when a customer places an Order").
- **Sequence diagram**: a Mermaid `sequenceDiagram` on a canvas, one participant per area the journey crosses, prefixed with its repository's slug when the journey leaves this one, one message per hop.
- **Hops**: an ordered list, each hop its function in `mono`, its file link, and its area as a chip linking to the area's card.

## Areas

One `<article id="area-{{slug}}">` card per area, its top edge `var(--green)`, in the context map's left-to-right order:

- **Meta row**: the kinds of its entry points as chips.
- **Title**: the area's name, and its purpose under it.
- **Key modules**: a two-column `dl`, the module's name in `mono` with its file link, beside its interface in one line.
- **Entry points**: each with its kind and file link.
- **Talks to**: the areas and external systems it depends on as chips, each area chip linking to that area's card, with how it calls.
- **Data**: the entities it owns and where they are stored.
- **Tests**: where they live and their kinds, and the command that runs only them in a `<pre>` block.

## Where things live

A table with one row per change from the reports, grouped by area: **To change**, **Go to** (a file link), **Area** (a chip linking to its card).

## Vocabulary

- **Terms**: a `dl` of every term whose pairings name the repository, with its definition and the repository's word. Terms the code uses beside them that the map lacks carry an amber (`var(--amber)`) `not in map` pill, with the definition the code implies.
- **Decisions**: one row per `decision` note on the repository: its title and decision in one line, linking to its note. Undocumented decisions follow, each in a callout naming the decision and its file.

## Run and test

The commands from the manifests and the repository's card (`repos/<slug>.md`), each in a `<pre>` block under a one-line label: install, run, the unit suite, the e2e suite, and one area's tests.

## Voice

Write for the newcomer: plain sentences, domain words from the map used exactly, and each claim beside the file link that grounds it.

- "Checkout places an Order, then charges it through Stripe."
- "Pricing rules live in one module: `pricing/rules.ts`."
- "Jobs run on the queue; nothing in web waits for them."
