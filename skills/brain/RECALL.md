# Recall

Read what the active brain knows about the repositories the work touches. The `brain` skill runs this, and so does every skill that reads the [domain docs](../domain-modeling/DOMAIN-DOCS.md). [FORMAT.md](FORMAT.md) defines the active brain and **registered**. Recall only the repositories registered in the active brain. Run every git command in the brain as `git -C <brain>`.

1. **Pull**, once per conversation: `git pull --rebase --quiet`. When it fails (offline, or no remote yet), work from the local copy and say so. Done when the pull ran or failed.
2. **Scan.** For each repository the work touches, grep the `description:` lines of `repos/<slug>/`, and of the `shared/` notes whose `repos` names the slug. Read every note whose description bears on the work, and the notes those link to. Done when each note bearing on the work is read.
3. **Find the consumers.** For each `contract` note whose `repos` names one of those slugs, decide whether the work changes, or may change, its interface. Done when every such contract is marked changed or untouched.

Report the absolute paths of the notes read, and each changed contract with the other repositories its `repos` names. Those repositories call the interface from outside the one that changes, so changing it is a one-way door unless they change with it.

A note records what was true when it was written. Check any file, function or flag it names before acting on it, and offer to fix or delete a note the code contradicts.
