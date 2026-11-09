---
name: write-tickets
description: Break a spec, a plan, or the current conversation into milestones of tracer-bullet tickets, one track of milestones per repository, saved in the spec's folder in the brain's .sdd/specs/.
argument-hint: "[spec-id]"
disable-model-invocation: true
metadata:
  type: process
---

Break the work into **milestones**, each a group of **tickets**, in one **track** per repository the work changes, by [FORMAT.md](../brain/references/FORMAT.md)'s **Specs**. A milestone is an increment that leaves the code working and tested once its last ticket lands, and it builds in its track's repository, since it is built, checked and squashed inside one git history with one suite. The tracks build side by side, a milestone starting once it is ready, by `build`'s **Tracks**. A ticket is a **tracer bullet**. A track's tickets are built one at a time in number order, so each builds only on its track's tickets numbered before it and on the other tracks' tickets its **Depends on** names, and that line names exactly which ones.

The spec folder lives in the active brain's `.sdd/specs/`, by FORMAT.md. When no brain is open, say so by FORMAT.md and stop.

## Process

1. **Gather context.** With a `[spec-id]` argument, find its spec folder by [SPEC-ID.md](../write-spec/references/SPEC-ID.md) and read its `spec.md`; without one, use the spec written in this conversation or, failing that, the conversation itself (then each behaviour discussed stands in for a user story, and you propose the seams for the user to confirm in step 4). When the spec folder already holds a `milestones/` folder, report that and stop, unless the user asked for a rewrite, which replaces the whole `milestones/` folder. The work's repositories are the spec's **Repos**; without a spec, name them by [RECALL.md](../brain/references/RECALL.md)'s **Pick the repositories**, each registered. Each must be linked, since the cut reads its code: when one is not, ask the user to run `/brain link`, and stop. Read each one's [domain docs](../model-domain/references/DOMAIN-DOCS.md). Then dispatch one `alper-brain:scout` per repository, all in one message, its brief opening with the Context block by [BRIEF.md](../brain/references/BRIEF.md) (**Works in** its repository, read only, **Spec** the spec folder, **Writes** nothing), with the modules the work changes in it, the interfaces the work changes between repositories, and this brief: "For each module named, report: the tests already at or near the seams the spec names, as prior art for acceptance criteria; every call site in this repository of each interface named, grouped by package or directory; any change that would make the later work easier (**prefactoring**); and any module too large or tangled for one agent to change in one fresh context. Cite the `path:line` for each fact." When the work is in one repository whose code this conversation already read, read what is missing yourself instead. When the spec's Further Notes leave a question open that a ticket would build on, ask the user to settle it, and write the answer into Further Notes. Without a spec, follow [IN-FLIGHT.md](../write-spec/references/IN-FLIGHT.md) for the modules the work changes, unless the conversation already ran it; when it reports an overlapping spec, recommend `/write-spec`, which records the dependency, and stop. Done when you can name the modules the work changes, each with its repository, every scout's report answers all four items for every module named, or says none, re-dispatching a scout whose report leaves one out, and no open question a ticket builds on is left.

2. **Cut the tracks.** Give each repository the work changes its track, and number the track's milestones `001` upwards, in order. Each milestone delivers one increment you can verify with a check the builder can run in its repository, and builds only on its track's earlier milestones and on the other tracks' milestones its tickets' **Depends on** reach. Prefactoring goes in the first milestone of its track. When the work changes an interface one repository offers another (an API, event, queue or shared schema), sequence it by [CONTRACT-CHANGE.md](references/CONTRACT-CHANGE.md). Done when every user story is finished by exactly one milestone (the one whose landing makes it work end to end), every repository the work changes has its track, and every interface the work changes between repositories (each API contract in the spec's Implementation Decisions, each contract note the domain docs surfaced) is cut by CONTRACT-CHANGE.md: a migrate milestone for every consumer the spec or the note names, each with a **Lands after** naming the expand, and the contract milestone, when kept, with a **Lands after** naming every migrate. A consumer missing from the spec's **Repos** is a question for step 4: add it, or keep the interface compatible.

3. **Draft tickets.** Split each milestone into tracer bullets:

   - Each ticket is a tracer bullet through every layer it needs in its milestone's repository (schema, API, UI, tests). Where its path crosses into another repository, it stops at that interface, which is its seam.
   - Each ticket is verifiable when it lands, through a confirmed seam: one the spec names, or one the user confirms in step 4.
   - Each ticket fits one fresh context window.
   - Prefactoring tickets come first.

   A mechanical change that breaks call sites across the codebase at once cannot land as a tracer bullet; sequence it by [WIDE-REFACTOR.md](references/WIDE-REFACTOR.md).

   Number each track's tickets `001` upwards, continuing across its milestones rather than restarting. Give each ticket its **Depends on**: the tickets it builds on directly, by number in its own track and as `<slug>/NNN` in another. Name a ticket in another track only where this one builds on it: every such link holds this ticket's milestone back until the other one squashes, so its track idles meanwhile. Done when every user story is covered by some ticket's acceptance criteria, every row of the spec's Design Patterns is copied into the ticket that builds its Where, every criterion names its seam, every **Depends on** names only lower-numbered tickets of its own track or tickets of other tracks, and no two milestones wait on each other, directly or through others.

4. **Quiz the user.** Present the breakdown grouped by track, each track's milestones in order: each milestone's increment, check and **Lands after**, then its tickets in order, each with its title, what it delivers, and its **Depends on**. Then how the tracks run, by [`build`'s **Tracks**](../build/SKILL.md): which milestones wait on another track's, through a cross-track **Depends on**, and the order the bases take them in, by **Lands after**. Then one coverage line per user story and Design Patterns row, naming the tickets that build it. Without a spec, lead with the seams you proposed, each with what it catches. Ask:

   - Without a spec: are these the right seams, and, when a repository's card sets a `commitKeyPattern`, which key do this work's commits carry, shaped as [FORMAT.md](../brain/references/FORMAT.md)'s **Key** line holds it, or none?
   - Does each milestone boundary mark a meaningful increment, and does each leave every repository working, including the ones that call a changed interface, in whatever order the repositories deploy? For each contract change: the questions [CONTRACT-CHANGE.md](references/CONTRACT-CHANGE.md) sets (its unpinned shapes, and whether its contract milestone stays in this spec).
   - Should any ticket or milestone be merged (too fine) or split (too coarse)?
   - Do the dependencies hold: does each ticket need exactly the tickets its **Depends on** names?

   Iterate until the user approves. Done when the user approves the breakdown, seams included, every changed contract's shape is pinned or the user has said why it cannot be, and, without a spec, the user has given the key or none.

5. **Write the files.** Write into the spec folder in the brain, `.sdd/specs/NNN-<slug>/`; without a spec, create one with `NNN` one past the highest spec folder number already there and a slug of the work's name, holding a `spec.md` with only the title and the **Repos** and **Key** lines of [SPEC-TEMPLATE.md](../write-spec/references/SPEC-TEMPLATE.md), plus, for a contract change, an Implementation Decisions section holding its API contracts entries. Fill the files from [TEMPLATES.md](references/TEMPLATES.md):

   ```
   .sdd/specs/NNN-<slug>/
   ├── spec.md
   └── milestones/
       └── <repo-slug>/                  ← one track per repository
           └── NNN-<milestone-slug>/
               ├── milestone.md
               └── NNN-<ticket-slug>.md   ← one per ticket
   ```

   Write the files in plain prose, by [PROSE.md](../brain/references/PROSE.md), and check the `milestones/` folder by its **Check**. Done when every milestone folder has its `milestone.md` and at least one ticket, every diagram slot holds its diagram, the check prints `prose: ok`, and the user has the spec folder's path, `/add-dir <root>` for each repository in **Repos** not open in this session, and the next step, `/build <spec-id>` to build every milestone and land the spec.
