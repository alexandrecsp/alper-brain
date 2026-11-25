# Evals

Behaviour checks for the skills, run with `claude plugin eval`. Each case seeds its workspace with a Bash `fixture.sh`, so pass `--scaffold`, and grant the tools the skills write with:

```
claude plugin eval . --scaffold --allow-tools Bash Edit Write Agent
claude plugin eval . --scaffold --allow-tools Bash Edit Write Agent --tag build
```

`_fixtures/brain.sh` seeds the workspace as a git repository holding a standalone brain in its `.brain/`: `BRAIN.md` with its `kind` line, the `.gitignore` of FORMAT.md's **Layout**, the card `repos/demo/REPO.md` and `repos/repos.json` linking `demo`, whose clone sits in the workspace at `clones/demo` so the session holds it open. The spec `001-greeting`, with one built milestone, sits in `.brain/specs/`, which the brain's `.gitignore` keeps out of git. A case sets its `PHASE` and `REVIEW`, sources it, then moves the state to what it tests.

The build cases run many turns: run them before changing `build`, `LAND.md`, `commit` or the Context block, and again after.

## Measuring a sub-agent's tokens

`build-ticket` is the one case that dispatches a builder. Run it with `--keep-temp`, then pass each run's `tracePath` from the `--json` output to `node scripts/agent-tokens.mjs <trace.jsonl>...`: it prints each sub-agent's first-turn context, its turns and input, and which tool results it re-read most. Run it before changing an agent definition or a brief, and again after, over at least two runs each, since one run's cost moves by as much as a change saves. Without arguments it reads every transcript under `~/.claude/projects`, the real builds.

## Weighing how builders are dispatched

`build-milestone` builds a milestone of three tickets, each on the one before, where the third changes both scripts the first two wrote. As a case it checks that the first builder plans its tests and that the main session acts on each report; its `compare.sh` runs the same fixture once per **variant** and compares them: `ticket`, today's fresh builder per ticket; `continue`, by `variants/continue.patch`, the same builder carrying on to the next ticket by SendMessage, up to three; and `milestone`, by `variants/milestone.patch`, one builder per milestone. A variant written `continue@sonnet:high` runs the orchestrator on that model and effort. It runs `claude -p` unsandboxed, outside `claude plugin eval`, so every commit lands under WSL2 too, and its `measure.mjs` prints, per run and per variant, the cost, time and tokens by agent, and what was built: tickets done, the suite on the spec branch, test-plan rows, copies of the missing-file handling and the review's findings. Rebuild a patch when `build` or `builder.md` moves under it: `compare.sh` stops when one no longer applies.

## Where they run

Granting Bash needs Claude Code's sandbox, which native Windows lacks. Run them under WSL2 or Linux, with `bubblewrap` and `socat` installed, or in CI: `.github/workflows/evals.yml` runs every case once on demand from the Actions tab, given the repository secret `ANTHROPIC_API_KEY`, and uploads its `eval-report.html`. A run under WSL2 or Linux logged in to claude.ai uses that plan instead of API credits.

Under WSL2, sandboxed Bash cannot write anywhere in the run, `.git` included, so every commit, squash and landing fails there. The graders grade what the agent does instead: the calls it makes, the files it writes with Edit, and the message it gives `git commit`. Grade the same way in a new case: a grader that reads a commit SHA, a squash or a landing scores the sandbox, not the skill. What a build leaves in git is checked by `build-milestone`'s `compare.sh`, which runs unsandboxed, and by `skills/build/scripts/sdd.test.mjs`.
