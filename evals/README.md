# Evals

Behaviour checks for the skills, run with `claude plugin eval`. Each case seeds its workspace with a Bash `fixture.sh`, so pass `--scaffold`, and grant the tools the skills write with:

```
claude plugin eval . --scaffold --allow-tools Bash Edit Write Agent
claude plugin eval . --scaffold --allow-tools Bash Edit Write Agent --tag build
```

`_fixtures/brain.sh` seeds a brain holding one repository, `demo`, cloned inside it at `clones/demo` so the session holds it open, and spec `001-greeting` with one built milestone. A case sets its `PHASE` and `REVIEW`, sources it, then moves the state to what it tests.

The build cases run many turns: run them before changing `build`, `LAND.md`, `commit` or the Context block, and again after.

## Where they run

Granting Bash needs Claude Code's sandbox, which native Windows lacks. Run them under WSL2 or Linux, with `bubblewrap` and `socat` installed, or in CI: `.github/workflows/evals.yml` runs every case once on demand from the Actions tab, given the repository secret `ANTHROPIC_API_KEY`, and uploads its `eval-report.html`. A run under WSL2 or Linux logged in to claude.ai uses that plan instead of API credits.

Under WSL2 (Claude Code 2.1.318), sandboxed Bash cannot write anywhere in the run, `.git` included, so `build-resume-squash` and `commit-no-brain` fail at their first git write there; `build-escalation-user` writes nothing to git and gives a real score.
