---
name: to-tickets
description: Break a spec, a plan, or the current conversation into milestones of tracer-bullet tickets, each milestone in one repository, saved in the spec's folder in the brain's .sdd/specs/.
argument-hint: "[spec-id]"
disable-model-invocation: true
metadata:
  type: process
---

Break the work into **milestones**, each a group of **tickets**. A milestone is an increment that leaves the code working and tested once its last ticket lands, and it builds in exactly one repository, named on its **Repo** line, since it is built, checked and squashed inside one git history with one suite. A milestone starts once the milestones it waits on are squashed, by `build`'s **Waves**: a milestone waits on the earlier ones in its repository and on those its tickets' **Depends on** reach, so milestones in different repositories with nothing between them build side by side. A ticket is a **tracer bullet**. Tickets are built one at a time in number order, so each ticket builds only on tickets numbered before it, and its **Depends on** line names exactly which ones.

The spec folder lives in the active brain's `.sdd/specs/`, by [FORMAT.md](../brain/FORMAT.md). When no brain is open, say so by FORMAT.md and stop.

## Process

1. **Gather context.** With a `[spec-id]` argument, find its spec folder by [SPEC-ID.md](../to-spec/SPEC-ID.md) and read its `spec.md`; without one, use the spec written in this conversation or, failing that, the conversation itself (then each behaviour discussed stands in for a user story, and you propose the seams for the user to confirm in step 4). When the spec folder already holds a `milestones/` folder, report that and stop, unless the user asked for a rewrite. The work's repositories are the spec's **Repos**; without a spec, name them by [RECALL.md](../brain/RECALL.md)'s **Pick the repositories**, each registered. Each must be linked, since the cut reads its code: when one is not, ask the user to run `/brain link`, and stop. Read each one's [domain docs](../domain-modeling/DOMAIN-DOCS.md). Then dispatch one `alper-brain:scout` per repository, all in one message, its brief opening with the Context block by [BRIEF.md](../brain/BRIEF.md) (**Spec** the spec folder, **Writes** nothing), with the modules the work changes in it, the interfaces the work changes between repositories, and this brief: "For each module named, report: the tests already at or near the seams the spec names, as prior art for acceptance criteria; every call site in this repository of each interface named, grouped by package or directory; any change that would make the later work easier (**prefactoring**); and any module too large or tangled for one agent to change in one fresh context. Cite the `path:line` for each fact." When the work is in one repository whose code this conversation already read, read what is missing yourself instead. When the spec's Further Notes leave a question open that a ticket would build on, ask the user to settle it, and write the answer into Further Notes. Without a spec, follow [IN-FLIGHT.md](../to-spec/IN-FLIGHT.md) for the modules the work changes, unless the conversation already ran it; when it reports an overlapping spec, recommend `/to-spec`, which records the dependency, and stop. Done when you can name the modules the work changes, each with its repository, every scout has reported, and no open question a ticket builds on is left.

2. **Cut milestones.** Number them `001` upwards, in order. Each delivers one increment you can verify with a check the builder can run in its repository, builds in one repository, and builds only on earlier milestones. `build` lands its repositories each time a wave moves on to another repository, which asks the user, rebases and runs each one's full suite: keep a repository's milestones together unless a milestone in another repository must come between them, as a contract change's migrate must, and give a ticket a **Depends on** in another milestone only where it builds on that ticket, since every such link holds its milestone out of the wave. Prefactoring goes in the first milestone of its repository. When the work changes an interface one repository offers another (an API, event, queue or shared schema), sequence it by [CONTRACT-CHANGE.md](CONTRACT-CHANGE.md). Done when every user story is finished by exactly one milestone (the one whose landing makes it work end to end), every milestone names its repository, and every interface the work changes between repositories (each API contract in the spec's Implementation Decisions, each contract note the domain docs surfaced) is cut by CONTRACT-CHANGE.md, with a migrate milestone for every consumer the spec or the note names. A consumer missing from the spec's **Repos** is a question for step 4: add it, or keep the interface compatible.

3. **Draft tickets.** Split each milestone into tracer bullets:

   - Each ticket is a tracer bullet through every layer it needs in its milestone's repository (schema, API, UI, tests). Where its path crosses into another repository, it stops at that interface, which is its seam.
   - Each ticket is verifiable when it lands, through a confirmed seam: one the spec names, or one the user confirms in step 4.
   - Each ticket fits one fresh context window.
   - Prefactoring tickets come first.

   A mechanical change that breaks call sites across the codebase at once cannot land as a tracer bullet; sequence it by [WIDE-REFACTOR.md](WIDE-REFACTOR.md).

   Number the tickets `001` upwards, continuing across milestones rather than restarting. Give each ticket its **Depends on**: the tickets it builds on directly, in any milestone. Done when every user story is covered by some ticket's acceptance criteria, every row of the spec's Design Patterns is copied into the ticket that builds its Where, every criterion names its seam, and every **Depends on** names only lower-numbered tickets.

4. **Quiz the user.** Present the breakdown grouped by milestone: each milestone's repository, increment and check, and the waves: which milestones build side by side, and where the build lands its repositories before moving on; then its tickets in order, each with its title, what it delivers, and its **Depends on**. Then one coverage line per user story and Design Patterns row, naming the tickets that build it. Without a spec, lead with the seams you proposed, each with what it catches. Ask:

   - Without a spec: are these the right seams, and, when a repository's card sets a `commitKeyPattern`, which key do this work's commits carry, shaped as [FORMAT.md](../brain/FORMAT.md)'s **Key** line holds it, or none?
   - Does each milestone boundary mark a meaningful increment, and does each leave every repository working, including the ones that call a changed interface, in whatever order the repositories deploy? For each contract change: keep its contract milestone in this spec, or leave it for a follow-up?
   - Should any ticket or milestone be merged (too fine) or split (too coarse)?
   - Do the dependencies hold: does each ticket need exactly the tickets its **Depends on** names?

   Iterate until the user approves. Done when the user approves the breakdown, seams included, and, without a spec, has given the key or none.

5. **Write the files.** Write into the spec folder in the brain, `.sdd/specs/NNN-<slug>/`; without a spec, create one with `NNN` one past the highest spec folder number already there and a slug of the work's name, holding a `spec.md` with only the title and the **Repos** and **Key** lines of [SPEC-TEMPLATE.md](../to-spec/SPEC-TEMPLATE.md). Fill the files from [TEMPLATES.md](TEMPLATES.md):

   ```
   .sdd/specs/NNN-<slug>/
   ├── spec.md
   └── milestones/
       └── NNN-<milestone-slug>/
           ├── milestone.md
           └── NNN-<ticket-slug>.md   ← one per ticket
   ```

   Done when every milestone folder has its `milestone.md` and at least one ticket, every diagram slot holds its diagram, and the user has the spec folder's path, `/add-dir <root>` for each repository in **Repos** not open in this session, and the next step, `/build <spec-id>` to build every milestone and land the spec, or `/build <spec-id> m01` to build only the first milestone.
