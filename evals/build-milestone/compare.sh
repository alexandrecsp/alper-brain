#!/usr/bin/env bash
# Weighs how build dispatches builders, on this case's fixture: `ticket` (today: a fresh builder per ticket),
# `continue` (variants/continue.patch: the same builder carries on, by SendMessage) and `milestone`
# (variants/milestone.patch: one builder per milestone). Each variant runs in its own clone of this repository,
# HEAD plus the working tree's changes plus its patch, so uncommitted work is compared as it stands.
#
#   evals/build-milestone/compare.sh [--runs N] [--budget USD] [variant...]
#     defaults: --runs 2, no budget, all three variants. With a budget, no run starts once the runs so far cost that
#     much at list price; a run costs about $1.5 to $2.
#
# Runs `claude -p` outside `claude plugin eval`, whose Bash sandbox cannot write git under WSL2, so every builder
# can commit: it runs unsandboxed, with permissions bypassed, in a scratch folder under $OUT (default
# ~/build-milestone-compare/<time>). Run it under WSL2 or Linux, logged in to claude. Each run is a whole build of a
# 3-ticket milestone, review and squash included. When it ends, measure.mjs prints the comparison.
#
# A variant may name the orchestrator's model and effort, as `continue@sonnet:high`: the session runs with
# `--model sonnet --effort high`, and its runs are labelled `continue_sonnet_high`. Without one, the session takes
# claude's default model; sub-agents keep the models their definitions pin.
set -euo pipefail
[ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ] && . "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
here="$(cd "$(dirname "$0")" && pwd)"
src="$(cd "$here/../.." && pwd)"
runs=2
budget=
spent=0
while [ $# -gt 0 ]; do
  case "$1" in
    --runs) runs=$2; shift 2 ;;
    --budget) budget=$2; shift 2 ;;
    *) break ;;
  esac
done
variants=("$@")
[ ${#variants[@]} -eq 0 ] && variants=(ticket continue milestone)
out="${OUT:-$HOME/build-milestone-compare/$(date +%Y%m%dT%H%M%S)}"
mkdir -p "$out"

for spec in "${variants[@]}"; do
  v="${spec%%@*}"
  flags=()
  if [ "$spec" != "$v" ]; then
    m="${spec#*@}"
    flags+=(--model "${m%%:*}")
    [ "$m" != "${m%%:*}" ] && flags+=(--effort "${m#*:}")
  fi
  label="$(printf %s "$spec" | tr "@:" "__")"
  plugin="$out/plugin-$label"
  git clone -q "$src" "$plugin"
  # The working tree's changes, with Windows line ends stripped: a CRLF fixture breaks under bash.
  (cd "$src" && git diff HEAD --binary) | sed 's/\r$//' > "$out/worktree-$label.patch"
  [ -s "$out/worktree-$label.patch" ] && git -C "$plugin" apply "$out/worktree-$label.patch"
  (cd "$src" && git ls-files --others --exclude-standard) | while read -r f; do
    mkdir -p "$plugin/$(dirname "$f")" && sed 's/\r$//' "$src/$f" > "$plugin/$f"
  done
  [ "$v" = ticket ] || git -C "$plugin" apply "$here/variants/$v.patch"
  prompt="$(cat "$plugin/evals/build-milestone/prompt.md")"

  for i in $(seq 1 "$runs"); do
    if [ -n "$budget" ] && awk -v s="$spent" -v b="$budget" 'BEGIN { exit !(s >= b) }'; then
      echo "the budget of \$$budget is spent (\$$spent): stopping before $spec run $i"
      break 2
    fi
    run="$out/$label-$i"
    mkdir -p "$run/ws"
    export GIT_CONFIG_GLOBAL="$run/gitconfig"
    (cd "$run/ws" && bash "$plugin/evals/build-milestone/fixture.sh")
    echo "$(date +%T) $spec run $i: $run"
    start=$(date +%s)
    (cd "$run/ws" && timeout 3600 claude -p "$prompt" --plugin-dir "$plugin" --output-format stream-json --verbose \
      --permission-mode bypassPermissions --max-turns 200 "${flags[@]}" </dev/null >"$run/trace.jsonl" 2>"$run/stderr.log") ||
      echo "  claude exited $?, see $run/stderr.log"
    echo $(( $(date +%s) - start )) > "$run/wall-seconds"
    unset GIT_CONFIG_GLOBAL
    if grep -q '"status":"rejected"' "$run/trace.jsonl"; then
      echo "  the usage limit refused this run: stopping; rerun the variants left once it resets"
      rm -rf "$run"; break 2
    fi
    cost=$(grep '"type":"result"' "$run/trace.jsonl" | tail -1 | grep -o '"total_cost_usd":[0-9.e-]*' | cut -d: -f2)
    spent=$(awk -v s="$spent" -v c="${cost:-0}" 'BEGIN { printf "%.2f", s + c }')
    echo "  cost \$${cost:-0}, \$$spent so far"
  done
done

node "$here/measure.mjs" "$out" | tee "$out/summary.txt"
