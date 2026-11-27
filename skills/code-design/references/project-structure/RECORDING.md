# Recording

Write `docs/STRUCTURE.md` at the working repository's root. Record what a reader cannot see by listing folders:

1. The dependency rules and departures every app shares.
2. One section per app or package, headed by its path (`apps/web`): its archetype and language, its tree as a pattern one module deep (`src/modules/<module>/domain/…`, with one real module as the example), the names table in its language's spelling, and its own departures.

Every departure carries its reason.

Before writing, detect each app's archetype and ask the user, in one message, which layout to record for each app or package, listing:

- **Keep**, only when `docs/STRUCTURE.md` already has its section: the section as written, its archetype shown.
- **As-is**, only when it has code: the layout the code already uses, mapped onto the vocabulary where it fits. Offer each move you would make as a `refactor` candidate in your reply.
- **Default**, always: [PROJECT-STRUCTURE.md](PROJECT-STRUCTURE.md)'s layout for its archetype, in its language's spelling. Each existing folder that does not fit it becomes a `refactor` candidate in your reply, naming where its files move.

Recommend keep when the section exists, else as-is when the app has code, else default. One answer for all of them is fine.

Done when every app or package with a manifest has a section in the layout the user picked, and every top-level folder of its source root maps to a vocabulary term, stands as a departure with its reason, or, under default, is a `refactor` candidate.
