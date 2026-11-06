# Recall

Read what the active brain knows about the repositories the work touches. The `brain` skill runs this, and so does every skill that reads the [domain docs](../../domain-modeling/references/DOMAIN-DOCS.md). [FORMAT.md](FORMAT.md) defines the active brain and **registered**. Recall only the repositories registered in the active brain. Run every git command in the brain as `git -C <brain>`.

As a sub-agent, read only the notes your brief's Context block lists, and skip the steps below: the skill that dispatched you recalled them, and you have no user to offer fixes to, so report a note the code contradicts instead.

1. **Pull**, once per conversation: `git pull --rebase --quiet`. When it fails (offline, or no remote yet), work from the local copy and say so. Done when the pull ran or failed.
2. **Pick the repositories**, when the work has not named them all: a topic can reach repositories nobody has opened. Grep the `description:` lines of every note under `repos/` and `shared/`, read each `REPO.md` summary and the `repos` of each `contract` note that bears on the work, and put every registered repository in or out. FORMAT.md's working repository rules pick the one repository a skill acts in; this step picks every repository the work reaches. Done when every registered repository is in or out, each with a one-line reason.
3. **Scan.** For each repository the work touches, grep the `description:` lines of `repos/<slug>/`, and of the `shared/` notes whose `repos` names the slug. Read every note whose description bears on the work, and the notes those link to. Done when each note bearing on the work is read.
4. **Find the consumers.** For each `contract` note whose `repos` names one of those slugs, decide whether the work changes, or may change, its interface. Done when every such contract is marked changed or untouched.

Report the absolute paths of the notes read, and each changed contract with the other repositories its `repos` names. Those repositories call the interface from outside the one that changes, so changing it is a one-way door unless they change with it.

A note records what was true when it was written; an explored note names that commit in its `explored` line, and the files to check in its **Sources**. Check any file, function or flag a note names before acting on it. When the code contradicts an authored note, offer its fix or deletion by **Record** in [SKILL.md](../SKILL.md); when it contradicts an explored note, suggest `/brain explore <slug>`.
