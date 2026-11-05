# Status

The `status` branch of [`brain`](SKILL.md): report the active brain's whole ecosystem, every repository registered in it and every in-flight spec in its `.sdd/`, with what needs the user first. It reads and changes nothing. [FORMAT.md](FORMAT.md) defines the active brain, registered, linked, open and landed.

1. **Pull**, once per conversation: `git pull --rebase --quiet`. When it fails (offline, or no remote yet), work from the local copy and say so. Done when the pull ran or failed.

2. **Map the repositories.** Read each `repos/<slug>/REPO.md` and the brain's `.sdd/links.json`, and mark each repository linked when its path exists, and open when that path is open. For each linked repository, run `git -C <path>` with `status --porcelain`, `branch --list 'sdd/*'`, and `log --oneline @{u}..` on its current branch when it has an upstream. Done when every registered repository is marked unlinked, linked or open, and each linked one has its tree state and its `sdd/*` branches.

3. **Read the work.** A spec is **in flight** until it is landed or its `spec.md` has an **Abandoned** line. For each in-flight spec under `.sdd/specs/`, take its **Repos** and **Depends on**, and give it the first state that holds:

   | State | Holds when |
   |---|---|
   | `blocked` | a ticket's **Status** is `blocked`, or a milestone's **Phase** is `failed` |
   | `waiting` | a spec its **Depends on** names is not landed |
   | `landing` | every milestone has a **Squash**, and some milestone has no **Landed** line |
   | `building` | some ticket has left `todo` |
   | `ticketed` | it has a `milestones/` folder |
   | `drafted` | none of the above |

   A `building` spec also names its open milestone, that milestone's **Repo** and its **Phase**. Done when every in-flight spec has its state and repositories.

4. **Find the risks.** For each `contract` note in `shared/`, find the in-flight specs whose Implementation Decisions change the interface it records. A change is **uncovered** when a consumer the note's `repos` names is missing from that spec's **Repos**. Done when every contract is marked untouched, covered or uncovered, with the specs that change it.

5. **Report**, needs-attention first:
   - **Needs you:** `blocked` specs with the ticket or check that stopped them; `waiting` specs with what they wait on; uncovered contract changes with the consumers left out; linked repositories with a dirty tree on an `sdd/*` branch.
   - **In flight:** the other specs, one line each: spec id, state, repositories, and for `building` the milestone, its repository and its phase.
   - **Repositories:** one line each: slug, unlinked, linked or open, and unpushed commits. Unlinked repositories end with the hint `/brain link`.
   - **Brain:** the brain's unpushed commits (`git log --oneline @{u}..`), with the hint `/brain sync` when there are any.

   Done when the user has the report, and every in-flight spec and every registered repository appears in it once. The page `/brain view` opens shows the same specs, live.
