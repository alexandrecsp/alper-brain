# Briefing a sub-agent

Every sub-agent the skills dispatch starts in the brain, with no user, and sees nothing of this conversation. Open each brief with a **Context** block, filled from [FORMAT.md](FORMAT.md)'s working repository rules, then add the task's own inputs and instructions. Give paths, never pasted file contents: pass every file that exists on disk by its absolute path (the repository's docs, the brain's notes, this plugin's reference files such as SMELLS.md or DIAGRAMS.md), and paste only what you assembled yourself (an area list, a digest of ADRs, another agent's report).

Name files in the brief by what the agent works on: a ticket's path only for the agent building that ticket, its builder or the fixer finishing it, `review.md` only for the arbiter and the fixer of its findings, and the milestone's `milestone.md` or the spec folder for everyone else. The build pane files each agent under the ticket or job its brief's paths name.

## The Context block

Fill every line; write `none` where one does not apply.

```
## Context
- **Brain:** <brain's absolute path>
- **Works in:** <slug> at <root> (<open | linked | snapshot>), <changes it | reads it>
- **Also reads:** <slug> at <root> (<linked | open>), one entry per other repository the task reads, or none
- **Card:** <brain>/repos/<slug>/REPO.md
- **Docs:** <absolute paths: docs/STRUCTURE.md, the glossary or GLOSSARY-MAP.md, docs/adr/, and the plugin reference files the task needs>
- **Notes:** <absolute paths of the brain notes bearing on the task>, or none
- **Spec:** <absolute path of the spec.md, milestone.md or ticket the task serves>, or none
- **Branch:** <the branch the work belongs on>, or none
- **Writes:** <exactly what the agent may change: files under <root>, the ticket file at <path>, the file at <path>>, or nothing

Rules:
1. Read and write every file by absolute path. Each Bash call starts fresh in the brain, so on every call run git as `git -C <root>` and a suite or script as `cd <root> && <command>`. Bash in a read-only task is for reading: `git -C <root>` with `log`, `show`, `blame`, `diff`, `ls-files` or `grep`, and a tool's `--help`.
2. Change only what **Writes** names. Everything else listed is yours to read. The brain's notes come from **Notes**: read them without pulling, syncing or committing the brain.
3. You have no user to ask. Where a skill you follow says to ask, wait for or offer something to the user, settle it by this brief when the brief decides it; otherwise take the recommended or safest option and list it under **Needs the user**. When no option is safe, stop and report it as blocked.
4. When a read outside the brain is refused, report the path under **Needs the user**; a refused read is never "not found".
5. End your report with:
   - **Status:** done, partial or blocked, with what stopped you
   - **Needs the user:** each question you settled by default, with your pick, or none
   - **Changed:** each file changed and commit made, with its repository, or nothing
```

The **Works in** line's `<slug> at <root>` form is fixed: the build pane reads it to show each agent's repository. A sub-agent's **Needs the user** items reach the user through the dispatching skill's hand-over, beside its own decisions.

## Fanning out

A **fan-out** dispatches one sub-agent per area, repository or group. Run at most the **cap** at once, the `parallelAgents` setting by [FORMAT.md](FORMAT.md)'s **Settings**: dispatch a foreground fan-out in **waves** of the cap, each wave in one message, sending the next once every report of the one before has arrived; a background fan-out starts the next agent as each one reports. A fan-out no larger than the cap is one wave.

## After a sub-agent that changes a repository reports

Before acting on its report, check where it wrote: `git -C <root> rev-parse --abbrev-ref HEAD` is the brief's **Branch**, each commit it names exists there (`git -C <root> cat-file -e <sha>^{commit}`), `git -C <root> status --porcelain` is empty, and the brain's `HEAD` and `git -C <brain> status --porcelain -- . ':!.sdd'` are as they were before the dispatch. When a check fails, treat the agent as blocked, with what the check found.
