# Recall

Read what the active brain knows about the repositories the work touches. The `brain` skill runs this, and so does every skill that reads the [domain docs](../../model-domain/references/DOMAIN-DOCS.md). [FORMAT.md](FORMAT.md) defines the active brain, **registered** and **Layers**. Recall only the repositories registered in the active brain. Run every git command in the brain as `git -C <brain>`.

As a sub-agent, read only the notes your brief's Context block lists, and skip the steps below: the skill that dispatched you recalled them, and you have no user to offer fixes to, so report a note the code contradicts instead.

`node <this file's folder>/../scripts/recall.mjs <brain> [--repo <slug>]... [--layer business|application] [--query "<words>"] [--top <n>]` lists the notes a step needs, so recall reads a short list instead of every description:

- **cards**, when no `--repo` is given: each registered repository with its summary.
- **contracts**: every `contract` note on those repositories, never ranked out.
- **notes**: the rest, drafts included, best match first, `--top` of them (15 by default). It leaves out a superseded decision and lists the decision that replaced it.

Write the **query** as the words the notes would use for the work: its domain terms, the modules and interfaces it names, and their synonyms, in the notes' language. Pass `--layer` when the skill that runs recall names one; a contract is listed under either layer. When the last notes listed still bear on the work, run the script again with the `--top` it suggests.

1. **Pull**, once per conversation: `git pull --rebase --quiet`. When it fails (offline, or no remote yet), work from the local copy and say so. Done when the pull ran or failed.
2. **Pick the repositories**, when the work has not named them all: a topic can reach repositories nobody has opened. Run the script with the query and no `--repo`, and put every registered repository in or out, from its card, the notes that match, and the `repos` of each contract that bears on the work. FORMAT.md's working repository rules pick the one repository a skill acts in; this step picks every repository the work reaches. Done when every registered repository is in or out, each with a one-line reason.
3. **Scan.** Run the script with one `--repo` per repository the work touches. Read every note listed whose description bears on the work, and the notes those link to. Read a superseded decision only when the work asks how a choice came to be. Done when each note bearing on the work is read, and the last notes listed no longer bear on it.
4. **Find the consumers.** For each contract the script lists, decide whether the work changes, or may change, its interface. Done when every listed contract is marked changed or untouched.

Report the absolute paths of the notes read, marking each draft as unconfirmed, and each changed contract with the other repositories its `repos` names. Those repositories call the interface from outside the one that changes, so changing it is a one-way door unless they change with it.

A note records what was true when it was written; an explored note names that commit in its `explored` line, and the files to check in its **Sources**. Check any file, function or flag a note names before acting on it. When the code contradicts an authored note, draft its fix or deletion by **Record** in [SKILL.md](../SKILL.md); when it contradicts an explored note, suggest `/brain explore <slug>`.
