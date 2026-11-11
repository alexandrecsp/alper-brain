# Status

The `status` branch of [`brain`](../SKILL.md): report the active brain's whole ecosystem, every repository registered in it and every in-flight spec in its `.sdd/`, with what needs the user first. It changes nothing but the brain's pull. [FORMAT.md](FORMAT.md) defines the active brain, registered, linked, open, landed and in flight.

1. **Pull**, by [RECALL.md](RECALL.md)'s step 1.

2. **Read the work.** For each in-flight spec under `.sdd/specs/`, take its **Repos** and **Depends on**, and give it the first state that holds:

   | State | Holds when |
   |---|---|
   | `blocked` | a ticket's **Status** is `blocked`, a milestone's **Phase** is `failed`, or it is `ask` with an escalated finding in its `review.md` that has no **Answer** line |
   | `waiting` | a spec its **Depends on** names is not landed |
   | `landing` | every milestone has a **Squash**, and some milestone's **Landed** names no commit |
   | `building` | some ticket has left `todo` |
   | `ticketed` | it has a `milestones/` folder |
   | `drafted` | none of the above |

   A `building` spec also names each track's first open milestone, with its **Phase**. For each spec not yet `landing`, take every track holding an open milestone. Done when every in-flight spec has its state and repositories.

3. **Find the risks.** As soon as step 2 lists the in-flight specs, dispatch one `alper-brain:scout` agent in the background, its brief opening with the Context block by [BRIEF.md](BRIEF.md) (**Works in** the brain, read only, **Writes** nothing), with the paths of every `contract` note in `shared/` and of every in-flight `spec.md`, and this brief: "For each contract note, list each spec whose Implementation Decisions or Design Patterns rows change the interface it records, and for each, the slugs in the note's `repos` missing from that spec's **Repos** line. Report every contract, writing 'untouched' for one no spec changes." Map the repositories while it runs. Done when the report marks every contract untouched, covered or uncovered, with the specs that change it.

4. **Map the repositories.** Read each `repos/<slug>/REPO.md` and the brain's `.sdd/links.json`, and mark each repository linked when its path exists, and open when that path is open. For each linked repository, run `git -C <path>` with `status --porcelain`, `branch --list 'sdd/*'`, and `log --oneline @{u}..` on its current branch when it has an upstream. For each repository whose card has an `explored` line, mark it current, behind or unknown by FORMAT.md. Mark the repository of each track from step 2 unregistered, unlinked, linked or open. Done when every registered repository is marked unlinked, linked or open, and explored (current, behind or unknown) or never explored, and each linked one has its tree state and its `sdd/*` branches.

5. **Report**, needs-attention first:
   - **Needs you:** `blocked` specs with the ticket or check that stopped them; `waiting` specs with what they wait on; specs with an open milestone in a repository that is unregistered (`/brain setup`), unlinked (`/brain link`) or not open (`/add-dir <path>`); uncovered contract changes with the consumers left out; linked repositories with a dirty tree on an `sdd/*` branch.
   - **In flight:** the other specs, one line each: spec id, state, repositories, and for `building` each track's first open milestone, with its repository and its phase.
   - **Repositories:** one line each: slug, unlinked, linked or open, unpushed commits, and its explored state. Unlinked repositories end with the hint `/brain link`, and linked ones that are behind or never explored with `/brain explore <slug>`.
   - **Brain:** the brain's unpushed commits (`git log --oneline @{u}..`), or that it is local only, or has never been pushed, and the drafts waiting in `.sdd/drafts/`, each by name, with the hint `/brain sync` when there are any of either.

   Done when the user has the report, and every in-flight spec and every registered repository appears in it once. The page `/brain view` opens shows the same specs, live.
