# Record

The `remember` branch of [`brain`](../SKILL.md), and the way every skill drafts a note.

When you learn something the brain should hold, the user asks you to remember it (`remember <fact>`), or another skill hands you candidates, write each as a **draft** by FORMAT.md's **Drafts**, without stopping the work to ask:

1. **Find its home.** A term, or a decision that binds one repository, goes where [DOMAIN-DOCS.md](DOMAIN-DOCS.md) puts it, as a `term` note or a `decision` note. Look for a note or draft already covering it with [RECALL.md](RECALL.md)'s script, querying the fact's words, with `--type term` for a term. A draft already covering it takes the new fact into its own text. When an authored note covers it, the draft is its `update`; when only an explored note does, the draft is a new authored note holding only the reason or trap that note lacks, linking it. A note the fact makes untrue gets its draft by FORMAT.md's **When a note stops being true**. Its `repos` names every repository the fact holds for, and it links its related notes; its `target` is its home by that line: `notes/repos/<slug>/<name>.md` for one repository, else `notes/shared/<name>.md`, the folder `scripts/layout.mjs`'s `noteHome` gives.

   A `term` is the exception, and its `target` is `notes/domain/<name>.md` whatever its `repos` line says. Write it by DOMAIN-DOCS.md's **A term**, with the English name that DOMAIN-DOCS.md's **Name it in English** asks for and its other words as `aliases`:
   - When no term holds the word or its meaning, the draft is a new `record` of type `term`, with one pairing for each repository that uses a word for it.
   - When a term already has the meaning and a repository's word is missing, the draft is an `update` of that term. It holds the whole note and adds that repository's pairing line, with its degree, and its slug on `repos`.
   - When a term holds the word but means something else, the draft is a new term, and recall lists both under one `homonym:` line.

   A note on a repository the brain does not register waits for `/brain setup`: say so and leave it out. Done when each fact has its draft's `target` and `action`.
2. **Draft it.** Write each draft into `.local/drafts/` in plain prose, by [PROSE.md](PROSE.md), with its `aliases` by FORMAT.md, and check the drafts you wrote by its **Check** and by `node <the brain skill's folder>/scripts/schema.mjs <brain> <draft>...`, which holds each draft's frontmatter to FORMAT.md. Tell the user in one line per draft its name and description, then once that `/brain sync` consolidates and commits the drafts. Done when each fact sits in exactly one draft, the checks print `prose: ok` and `schema: ok`, and the user has been told.

Every draft, `remember`'s included, waits for `sync`: the brain's notes are committed there only. Record writes authored notes only; what the code does reaches the brain through `explore`.
