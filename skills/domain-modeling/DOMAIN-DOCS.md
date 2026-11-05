The **domain docs** are each repository's glossary and ADRs, plus the brain's notes on it. Read the ones present, in the root of each repository the work touches ([FORMAT.md](../brain/FORMAT.md)):

- **One context**: the root `GLOSSARY.md` and the ADRs in `docs/adr/`.
- **Several contexts**, marked by a root `GLOSSARY-MAP.md`: the root ADRs, plus the `GLOSSARY.md` and `docs/adr/` of each context the work touches, where the map says each one lives.
- **Second brain**: the notes bearing on the work and the contracts each repository shares with others, by [RECALL.md](../brain/RECALL.md).

Name things in the glossary's terms, keep the work within the ADRs' decisions, and count the repositories a contract names among the callers of its interface.
