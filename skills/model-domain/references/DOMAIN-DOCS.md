The **domain docs** are each repository's glossary and ADRs, plus the brain's notes on it. Each repository is its own context, or holds several under a root `GLOSSARY-MAP.md` ([CONTEXTS.md](CONTEXTS.md)). Read the ones present in each repository the work touches, by its root ([FORMAT.md](../../brain/references/FORMAT.md)). A repository that is registered but not linked has only its notes.

| Fact | Lives in |
|---|---|
| a term, as one repository means it | its root `GLOSSARY.md`, or its context's under a `GLOSSARY-MAP.md` |
| a decision that binds one repository | its `docs/adr/`: its context's, or the root's when it spans contexts |
| an interface between repositories, and the terms that cross it | a `contract` note in the brain's `shared/`, naming each side's term where they differ |
| a decision that binds several repositories | a `decision` note in the brain's `shared/`, its `repos` naming each |
| anything else the brain knows of a repository | its notes, by [RECALL.md](../../brain/references/RECALL.md) |

Name each repository's code in its own glossary's terms, keep the work within the decisions its ADRs and the `decision` notes record, and count the repositories a contract names among the callers of its interface.
