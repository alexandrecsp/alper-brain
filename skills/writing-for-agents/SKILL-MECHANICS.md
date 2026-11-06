# Skill mechanics

The skill-specific branch of [`writing-for-agents`](SKILL.md): what changes when the document is a skill (frontmatter, the invocation choice, shared reference, and router skills).

## Frontmatter

- `name`: the folder's name, and what the user types after the slash.
- `description` and `disable-model-invocation`: see Invocation.
- `argument-hint`: only when the skill takes arguments, written as the user types them (`"[spec-id]"`).
- `metadata.type`: `process` when the skill has steps, `reference` when it is all reference, by the content types in `SKILL.md`'s Information hierarchy.

## Invocation

Two choices, trading the two loads:

- A **model-invoked** skill keeps a `description`, so the agent can fire it autonomously, and other skills can reach it. You can still type its name: model-invocation always _includes_ user reach; a description only ever adds agent discovery, never removes the human's. The description is the skill's top-level context pointer, forced to stay loaded at all times: permanent context load in exchange for discoverability. Mechanics: omit `disable-model-invocation`, and write a model-facing description carrying the trigger branches (the pointer-writing rules in `SKILL.md` apply in full).
- A **user-invoked** skill strips the description from the agent's reach: only the human typing its name can invoke it, and no other skill can. Zero context load, but it spends cognitive load: you are the index that must remember it exists. Mechanics: set `disable-model-invocation: true`; the `description` becomes human-facing: a one-line summary, trigger lists stripped.

Pick model-invocation only when the agent must reach the skill on its own, or another skill must. If it only ever fires by hand, make it user-invoked and pay no context load.

## Splitting by invocation

The invocation cut of splitting (the sequence and context cuts live in `SKILL.md`): split off a model-invoked skill when you have a distinct leading word that should trigger it on its own (a trigger word you actually use in your prompts), or another skill must reach it. You pay context load for the new always-loaded description, so that independent reach has to be worth it.

## Shared reference

Reference several skills need lives once, at the narrowest place every reader can reach:

- **A reference file** beside the skill that owns it, which other skills point at by path. It loads only that material. A pointer into a SKILL.md loads that skill's whole process, whose steps compete with the reader's own, so when another skill needs a fragment of a SKILL.md, move the fragment into a reference file and point both skills there.
- **A model-invoked reference skill**, when the reference has its own trigger: any skill can invoke it, and the agent can reach it unprompted.
- **A plain file outside the skill system**, when only user-invoked skills need it: with no descriptions, neither can fire the other.
- **A brief**, when a sub-agent needs it: hand over its absolute path (see [`AGENT-MECHANICS.md`](AGENT-MECHANICS.md)).

## Router skills

When user-invoked skills multiply past what you can remember, that piled-up cognitive load is cured by a **router skill**: one user-invoked skill that names the others and when to reach for each, so the human has one skill to remember instead of many. It can only hint, never fire them: user-invoked skills have no description, so nothing but the human can reach them.
