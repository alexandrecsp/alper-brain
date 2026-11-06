Replace each guidance line with its content. Use the terms of the glossary of the milestone's repository, and name an interface between repositories in its producer's terms. Describe behaviour and modules by name; file paths and code snippets go stale.

## milestone.md

```markdown
# Milestone NNN: <Milestone title>

**Delivers:** the increment this milestone makes work, from the user's perspective; for a milestone that changes an interface between repositories, from its caller's perspective, naming the shapes it leaves offered or called.

**Done when:** a check the builder can run that proves the increment works once its last ticket lands: a test at a seam the spec names, or a command and its expected output.

**Lands after:** the milestones of other tracks this one reaches its base after, by [CONTRACT-CHANGE.md](CONTRACT-CHANGE.md), as `<slug>/NNN, <slug>/NNN`; or "None".

**Phase:** none

**Squash:** none

**Landed:** none

## Shape

The **milestone shape**, by [DIAGRAMS.md](../../to-spec/references/DIAGRAMS.md).
```

## NNN-<ticket-slug>.md

```markdown
# Ticket NNN: <Ticket title>

**Milestone:** NNN <Milestone title>

**Status:** todo

**Depends on:** the tickets this one builds on directly: lower-numbered ones in its own track as `NNN`, ones in another track as `<slug>/NNN`, such as `003, web-app/002`; or "None".

**Commit:** none

## What to build

The end-to-end behaviour this ticket makes work, from the user's perspective, rather than a layer-by-layer implementation list. When its path calls or offers an interface that a milestone in another repository changes, name that interface's shape as that milestone leaves it, and the milestone as `<slug>/NNN`. Then its **tracer bullet**, by [DIAGRAMS.md](../../to-spec/references/DIAGRAMS.md).

## Design patterns

The spec's Design Patterns rows this ticket implements, copied as they are, or "None".

## Acceptance criteria

- [ ] <behaviour>, proven at <seam>
- [ ] ...

## Notes

Left empty; the agent that builds this ticket fills it.
```
