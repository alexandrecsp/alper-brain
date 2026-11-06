# Link

The `link` branch of [`brain`](../SKILL.md): find this machine's clone of each repository the active brain registers, and record its path in the brain's `.sdd/links.json`, by [FORMAT.md](FORMAT.md). Linking opens nothing: it tells the pipeline where each clone is, so skills can read it and ask for it to be opened when they change it.

1. **Read the cards.** List every `repos/<slug>/REPO.md` with its `remote`, and the brain's `.sdd/links.json`. Drop an entry whose path no longer holds a clone matching its card. Done when every registered repository is marked linked or unlinked.

2. **Look for clones.** For each unlinked repository, look in order: the open folders; then the folder holding the brain, and the folders holding the linked clones, each two levels deep, for folders that hold a `.git`. A folder is the repository's clone when it matches the card by FORMAT.md. When two folders match, ask the user which one. Done when every unlinked repository has its clone, or none was found.

3. **Ask for the rest.** List the repositories still unlinked and ask the user for each clone's path, or to clone it now (`git clone <remote> <path>`), or to leave it unlinked. Check that each path given matches its card. Done when every registered repository is linked, or the user left it unlinked.

4. **Write the links.** Write `.sdd/links.json`, keeping the entries still valid. Done when the file reads back with every linked repository's path.

5. **Hand over.** Report each repository as linked, with its path, or unlinked. Say that a skill that changes a repository asks for it to be opened (`/add-dir <path>`), and that launching Claude with `--add-dir <path>` opens it from the start. Done when the user has the report.
