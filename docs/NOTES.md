# Notes: one folder for authored notes, and flow notes

**Status:** proposed, 2026-11-15, with its open decisions settled the same day; rollout step 1 built. Where it and the skills disagree, the skills win.

Today a note's folder carries its scope. `repos/<slug>/` holds the authored notes on one repository, and `shared/` holds the ones that span several. This proposal moves every authored note into one folder, `notes/authored/`, and has the `repos` field carry the scope for every note. Explored notes and cards stay per repository, under `notes/repos/<slug>/`. It also adds a `flow` note type: a path through the product that crosses repositories, stitching each repository's explored `feature` notes together.

## Why

| What is wrong | Where | What it costs |
|---|---|---|
| **Scope is decided once, by folder** | SKILL.md **Record** step 1: "in `repos/<slug>/`, or in `shared/` when it spans repositories" | The recording agent must judge whether a business concept (say, a subscription) belongs to its owner or is shared. Two agents judge it differently, and the brain splits one subject across both folders |
| **Widening a note means moving it** | FORMAT.md `repos`: "in `shared/` only" | When a second repository starts reading a concept, the note has to move from `repos/<slug>/` to `shared/` and gain a `repos` line. In practice it stays put, and recall with `--repo <the new one>` never finds it |
| **A feature that crosses repositories has no note** | FORMAT.md types: `feature` is "Explored only", and explored notes live in one repository | Checkout through `web-app`, `billing-api` and `notifier` becomes three unconnected `feature` notes. Nothing tells a product owner the order of the steps, or which repository runs each one |

The folder buys nothing the frontmatter cannot. A `name` is already unique across the whole brain (FORMAT.md **Notes**), links resolve by name, and one fact per file already keeps teammates' commits from conflicting. The one place a folder does real work is the explored notes: `/brain explore` deletes and rewrites one repository's explored notes, and checks its work with `git status -- repos/<slug>/`. There the folder is a safety boundary, so it stays.

## The model

```
<brain>/
├── BRAIN.md
├── timeline.json
├── notes/
│   ├── authored/<name>.md           ← every authored note; repos: [...] required
│   └── repos/<slug>/
│       ├── REPO.md                  ← the card
│       └── explored/<name>.md       ← explore's notes, one repository each
└── .brain/                          ← unchanged
```

- **`repos` is required on every authored note**, with one slug or several. Every slug in it must be registered. An explored note takes its repository from its folder and has no `repos` line, as today.
- **Scope rules move from folders onto `repos`:** a `contract` and a `flow` name at least two slugs, and any other type names one or more. "Shared" stops being a place: the brain page tags a note shared when its `repos` holds more than one slug.
- **A card sits at `notes/repos/<slug>/REPO.md`.** A repository is **registered** when the brain holds that file.
- **A draft's `target`** is `notes/authored/<name>.md`, or a path in a repository's `explored/` folder.
- **Obsidian** can open `notes/` as its vault, and everything that is not a note stays outside it.

## The flow type

| type | holds |
|---|---|
| `flow` | a path a user, operator or system takes that crosses repositories: its steps in order, each naming the repository that runs it and linking that repository's `feature` note, or the authored note when no feature covers it. Authored only; always `business`; `repos` names every repository a step runs in |

```markdown
---
name: checkout-flow
description: Checkout runs from the cart in web-app through the charge in billing-api to the receipt email from notifier
type: flow
layer: business
repos: [web-app, billing-api, notifier]
---

1. The customer confirms the cart in **web-app**: [[web-app-cart-checkout]].
2. **billing-api** charges the card and publishes `invoice.paid`: [[billing-api-charge]], over [[invoice-event-contract]].
3. **notifier** sends the receipt: [[notifier-receipt-email]].
```

A flow holds the order and the hand-offs, and links to everything else. The rules of each step stay in that step's feature note, and the shape of each hand-off stays in its `contract` note. So when explore rewrites a feature, the flow stays true as long as the steps still run in the same order.

**Who writes it.** Record writes one whenever the user describes a path that crosses repositories. Explore runs on one repository at a time, so it cannot see a whole flow. But when a scribe finds a feature that hands off to another registered repository, explore holds that candidate back, as it already does for contracts, and step 6 of EXPLORE.md writes it as a `flow` draft naming the two repositories it saw. Later runs on the other repositories extend the draft, or the note, by `update`.

## Sync and commits

**Find the keys** (SKILL.md **Sync** step 3) groups drafts by the repository their `target` names, and puts each `shared/` draft in its own group. Under this proposal it groups them by `repos` instead. A draft whose `repos` holds one slug joins that repository's group, and a draft with several forms a group over those slugs, matching the key of any of their cards, as a shared draft does today. Commit titles keep their forms: `Records <name> for <slug>`, or `for <slug>, <slug>` when the note spans several.

## Migration

The migration gets a new **Notes folder** section in MIGRATE.md, run by **Sync** before it consolidates, the same way **Note types** runs today. The migration rewrites every teammate's tree, so the user confirms it first, and it lands as one commit of its own, `Moves notes into notes/`:

1. `git mv repos/<slug>/explored/ notes/repos/<slug>/explored/` and `git mv repos/<slug>/REPO.md notes/repos/<slug>/REPO.md`, for each slug.
2. For each authored note straight under `repos/<slug>/`: `git mv` it to `notes/authored/<name>.md`, and add `repos: [<slug>]` to its frontmatter.
3. `git mv shared/<name>.md notes/authored/<name>.md` for each shared note. It keeps its `repos`.
4. Rewrite the `target` of every draft in `.brain/drafts/` that names an old path. Drafts are local, so each teammate's next sync does this for their own drafts.
5. Remove the empty `repos/` and `shared/` folders and their `.gitkeep` files, and add `notes/authored/.gitkeep` and `notes/repos/.gitkeep`.

Links resolve by name, so no note body changes. Names are already unique across the brain, so two notes cannot land on the same path. `schema.mjs` already reports a duplicate name, so the migration stops on any brain that has one.

**Readers accept both layouts until a brain migrates.** `loadBrain`, the brain page's walk and `timeline.mjs` each read `notes/` when it exists, and the old folders otherwise. A teammate who pulls the migration commit before running a sync of their own gets the new layout with no action on their part.

**The timeline must not show the move as activity.** `timeline.mjs` reads `git log -M --name-status -- repos shared`. After the migration it needs `-- notes repos shared`, so history from before the move stays visible. It must also skip a rename whose source and destination are both note paths and whose text changed only in the added `repos` line. Otherwise the migration commit lists every note in the brain as changed.

## What changes per file

| File | Change |
|---|---|
| `brain/references/FORMAT.md` | **Layout**, **registered**, the `repos` field (required on authored notes), the `flow` type, the `contract` row ("Lives in `shared/`" becomes "names at least two slugs"), **Timeline**'s path example |
| `brain/SKILL.md` | **Record** step 1 drops the folder choice; **Sync** step 3 groups by `repos` |
| `brain/references/MIGRATE.md` | New **Notes folder** section; **Explored notes** moves under the new paths |
| `brain/references/EXPLORE.md` | Steps 2, 3 and 6 read authored notes by `repos` instead of by folder; step 6 also writes held-back `flow` drafts; the commit check becomes `git status -- notes/repos/<slug>/` |
| `brain/references/ASK.md`, `BRIEF.md`, `LINK.md`, `SETUP.md`, `STATUS.md` | Card and note paths; SETUP creates `notes/authored/` and `notes/repos/`, and BRAIN.md's template describes the new layout |
| `brain/scripts/notes.mjs` | `loadBrain` walks `notes/`, with the old layout as a fallback; an authored note's `repos` comes from its frontmatter |
| `brain/scripts/schema.mjs` | Valid paths; `repos` required and registered on authored notes, and forbidden on explored ones; at least two slugs for `contract` and `flow`; `flow` authored only |
| `brain/scripts/recall.mjs` | The card path (l.162); `flow` notes are listed beside contracts when they touch a picked repository, so the ranking never cuts them |
| `brain/scripts/timeline.mjs` | The pathspec, `isNote`, `meta`, and skipping the migration's renames |
| `brain/brain.html` | The walk (l.1328), the path parser (l.1383–1388), the `shared` tag, and the draft form's `where` field, which goes away and leaves `repos` required (l.303) |
| `build/scripts/sdd.mjs` | The card path (l.653) |
| `commit/SKILL.md`, `build/references/LAND.md` | The card path, and where learned facts are recorded |
| `diagnose`, `prototype`, `design-patterns`, `research`, `open-pr` SKILL.md; `model-domain/SKILL.md` and `references/DOMAIN-DOCS.md`; `tdd/references/CONTRACTS.md` | "in `repos/<slug>/` or in `shared/`" becomes "with its `repos`"; "`shared/` contract notes" becomes "`contract` notes whose `repos` name …" |
| `evals/_fixtures/brain.sh` | The fixture brain uses the new layout |
| `README.md`, `docs/DESIGN.md` | Layout trees and the card path |

After the edits: `node scripts/check-refs.mjs` (the MIGRATE.md and FORMAT.md headings change), `node scripts/check-phases.mjs` (the brain page changes), and the evals by `evals/README.md` before and after, since `commit` and LAND.md change.

## What gets harder

- **Browsing by repository** in a file tree or on GitHub no longer shows a repository's authored notes. The brain page, recall with `--repo`, and an Obsidian search on `repos:` do.
- **A wrong `repos` line now hides a note**, where a wrong folder used to. The schema check catches an unregistered slug, but not a missing one. Explore's survey reads every authored note whose `repos` names the slug, so a scribe that finds a note whose subject is its area, while its `repos` leaves the area's slug out, reports it as an authored-note fix.
- **Readers handle two layouts** until every brain has migrated.

## Decisions

**Settled** (2026-11-15, in conversation):

1. Authored notes live in one folder, with `repos` required. Explored notes and cards stay per repository.
2. Everything the brain commits as notes sits under `notes/`.
3. The authored folder is `notes/authored/`, not `notes/shared/`: it holds notes on a single repository too, and the name should say what the folder holds, not how far each note reaches.
4. A cross-repository path through the product gets its own type, `flow`.
5. A `flow` names at least two slugs: a path inside one repository is a feature note.
6. Explore never changes a `flow` note itself. It drafts an `update` that the user confirms at sync, like every other authored change.

## Rollout

1. **Layout** (built). The `notes/` folder, `repos` required, both-layout readers, MIGRATE's **Notes folder**, the timeline fix, and every path in the table above. The `flow` type is not added yet. `notes.mjs`'s `placeOf`, mirrored in `brain.html`, is the one reader of both layouts. Sync asks before it moves a legacy brain. The brain page's draft form asks only for `repos`, and in a legacy brain it picks `repos/<slug>/` or `shared/` from them. Since the folder no longer shows a note's repository, a note naming one repository starts with its slug; `schema.mjs` warns, without failing, about a name that does not, so the notes written before the rule need no rename. Step 2 also draws a note naming several repositories between their clusters, in their colours, instead of in a grey cluster of its own.
2. **Flow notes.** The type in FORMAT.md and `schema.mjs`, its listing in recall, Record writing it, and explore's held-back flow drafts.

Step 1 changes no note's meaning and step 2 needs no migration, so each ships alone.
