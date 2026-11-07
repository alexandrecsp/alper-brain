# Recording

Write `docs/STRUCTURE.md` at the working repository's root. Record what a reader cannot see by listing folders:

1. The dependency rules and departures every app shares.
2. One section per app or package, headed by its path (`apps/web`): its archetype and language, its tree as a pattern one module deep (`src/modules/<module>/domain/…`, with one real module as the example), the names table in its language's spelling, and its own departures.

Every departure carries its reason. In a repository with code, record the layout it already uses, mapped onto the vocabulary where it fits, and offer each move you would make as an `refactor` candidate in your reply. In one without code, record the archetype's layout. When `docs/STRUCTURE.md` already exists, show each section's archetype and ask whether to keep it.

Done when every app or package with a manifest has a section, and every top-level folder of its source root maps to a vocabulary term or stands as a departure with its reason.
