# Tour

The `tour` branch of [`brain`](../SKILL.md): write a **tour** of one registered repository for a **newcomer**, someone who knows the stack but not this repository and will code in it. The tour is a guided path of **stops**, from the big picture down to where each thing lives, built on the **journeys** a request takes through the code. Every fact in it is **grounded**: it names the file it comes from, so the newcomer can go and look. [FORMAT.md](FORMAT.md) defines registered, linked, the working repository, the source, and current and behind.

The explored notes already tell what the repository does for its users. The tour adds how it is built, for whoever changes it, so it starts from those notes and spends its reads on the code they leave out.

1. **Pick the repository.** With an argument, the repository it names, by slug or by a path inside its clone; with none, the working repository by FORMAT.md. When it is not registered, tell the user to run `/brain setup`; when it is registered but not linked, `/brain link`; then stop. Read its card's `explored` line and say whether its explored notes are current, behind or missing, by FORMAT.md. When they are behind or missing, offer `/brain explore <slug>` first, recommending it: the tour then starts from notes that match the code. Given a yes, follow [EXPLORE.md](EXPLORE.md) for this repository, then come back here. Done when the repository is picked, linked, and its explored notes are current, or the user chose to tour without bringing them up to date.

2. **Pick the source.** Read the default branch, or, in an embedded or local brain, the host's current branch, from its source by FORMAT.md: in place, claimed as `tour`, or a snapshot. Its **target** is `git -C <source> rev-parse HEAD`. Every read from here on is from the source, so the tour describes committed code. Done when you hold the source, its branch and its target.

3. **Survey.** Read the source's README, manifests (`package.json`, `pyproject.toml`, `go.mod`, …), `docs/STRUCTURE.md`, `AGENTS.md` or `CLAUDE.md`, the card, and the terms and decisions by [DOMAIN-DOCS.md](DOMAIN-DOCS.md)'s **Read them**. Recall the repository by [RECALL.md](RECALL.md), reading every authored note whose `repos` names the slug and every note in `notes/repos/<slug>/`. Split the source's tracked files into **areas** by [AREAS.md](AREAS.md). Done when the split is done and every note on the repository is read.

4. **Fan out.** Dispatch one `alper-brain:explorer` agent per area, in waves by [BRIEF.md](BRIEF.md)'s **Fanning out**, each brief opening with the Context block by BRIEF.md: **Works in** the source, read only; **Docs** `docs/STRUCTURE.md`; **Notes** the notes whose **Sources** fall in its area or that name its files, and the repository's term notes; **Writes** nothing. Then give each its area's paths, the area list, each `decision` note's title and decision, the slug and card summary of every other registered repository, the `contract` notes naming this one, and this brief:

   > Walk this area as a guide preparing a tour of it for a newcomer who knows the stack but not this repo. The notes given to you tell what the area does for its users: read them first, take each as true until a file you read contradicts it, and spend your reads on how the area is built. Report each fact with the file it comes from:
   >
   > - **Purpose**: what the area does, in one sentence in the repository's terms.
   > - **Entry points**: every route, command, handler, job, page or exported function that the outside world or another area calls, with its kind and the other areas and repositories it calls into.
   > - **Key modules**: at most eight, each with its interface in one line.
   > - **Dependencies**: every other area, every other registered repository (by slug, naming the contract when one is given), and every external system it calls or is called by, and how (import, HTTP, queue, database).
   > - **Data**: the entities it owns and where they are stored.
   > - **Tests**: where they live, their kinds, and the command that runs only them.
   > - **Changes**: the three to five kinds of change `git log` shows most often in this area, each as "to change X, go to `path`", with a commit that made one.
   > - **Gaps**: terms the code uses that the map lacks or pairs differently, each with the definition the code implies; and decisions the code makes that are hard to reverse and surprising, but that no `decision` note records.
   > - **Contradicted**: each note given to you that the code contradicts, with what the code does instead.
   >
   > Report every field, writing "none" for an empty one.

   Done when every area's report has every field, re-dispatching an explorer whose report is missing one.

5. **Trace journeys.** Rank the entry points across all reports by how many areas and repositories they call into, counting each explored note (a `feature`, or a `concept` for a multi-step process) that starts at one as a tie-breaker. Pick the top two or three, preferring different kinds (a user request and a background job over two requests) and, when one exists, an entry point that crosses into another repository. Dispatch one explorer per journey, in waves by BRIEF.md's **Fanning out**, with the Context block (**Works in** the source, read only, **Also reads** the linked repositories its contracts name, **Notes** the `contract` notes naming this repository, **Writes** nothing), the entry point to trace (its kind, function, file and area), the area reports as its map, and this brief:

   > Trace this entry point end to end, from where it is called to its effect: data stored, response returned, event emitted. When it crosses into another repository your Context block names, follow it there to its effect. Report every **hop** in order, each with its function, its file, its repository and its area (for a hop in another repository, the folder it sits in), and name the contract at each crossing.

   Done when every journey is an ordered list of hops, each with its function, file, repository and area, and each crossing names its contract; then check and release the source when read in place, and remove it when a snapshot, by FORMAT.md.

6. **Write the tour.** Write the brain's `docs/repos/<slug>/<YYYY-MM-DD-HHmm>-tour.html` by [TOUR-HTML.md](TOUR-HTML.md), and hand it over by [THEME.md](THEME.md)'s **Hand-over**. Done when it is handed over and every area has its card, every journey its card, and every fact on the page is grounded.

7. **Offer the gaps.** Merge the reports' gaps, undocumented cross-repository dependencies and contradicted notes into one numbered list, one entry per item, in three groups: **terms** (with the definition the code implies), **decisions**, and **brain notes** (each dependency on another registered repository that no `contract` note records, and each contradicted note with its fix). Ask which terms and decisions to record, by number; the brain notes go to [RECORD.md](RECORD.md) as drafts, and `/brain sync` lets the user pick from them.
   - Write each chosen term and decision by [DOMAIN-DOCS.md](DOMAIN-DOCS.md)'s **Write it**, as a draft. Ask the user each chosen decision's reason first: the code shows what was decided, and only the user knows why.
   - Follow RECORD.md for the chosen brain notes. A contradicted explored note is fixed by `/brain explore <slug>`: suggest it.

   Done when the user has chosen or declined every term and decision, each chosen one is written or on the pending list, each brain note sits in a draft, and `/brain explore <slug>` is suggested for each contradicted explored note.
