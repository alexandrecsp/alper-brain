# Seeds the workspace as a brain holding one registered, linked and open repository,
# `demo`, and spec 001-greeting with one milestone whose one ticket is built.
# Source it from a case's fixture.sh after setting:
#   PHASE   the milestone's Phase line (squash, decide, ...)
#   REVIEW  the body of the milestone's review.md findings (after its Head line)
# The clone sits inside the brain at clones/demo, so the session holds it open.
set -euo pipefail

git config --global user.name "Eval"
git config --global user.email "eval@example.com"
git config --global init.defaultBranch main
git config --global core.autocrlf false

brain="$(pwd -W 2>/dev/null || pwd)"
spec=".sdd/specs/001-greeting"
ms="$spec/milestones/demo/001-greeting"

# The brain.
printf '# Second brain\n\nEval brain.\n\n## Repositories\n\n- demo: prints a greeting\n' > BRAIN.md
printf '.sdd/\nclones/\n' > .gitignore
mkdir -p repos/demo shared
cat > repos/demo/REPO.md <<'EOF'
---
slug: demo
remote: local only
commitKeyPattern: null
unit: sh test.sh
e2e: none
---

Prints a greeting.
EOF
git init -q . && git add -A && git commit -q -m "Creates the second brain"

# The repository: main, its spec branch holding the milestone's squash, and the milestone's branch.
mkdir -p clones/demo && cd clones/demo
git init -q .
printf 'grep -q hello greeting.txt && echo ok\n' > test.sh
printf 'placeholder\n' > greeting.txt
git add -A && git commit -q -m "Starts the demo"
git checkout -q -b sdd/001-greeting/spec
git checkout -q -b sdd/001-greeting/M001
printf 'hello\n' > greeting.txt
git commit -q -am "Prints hello" -m "- The greeting the spec asks for"
ticket_sha="$(git rev-parse HEAD)"
head_sha="$ticket_sha"
fixed_sha="$(git rev-parse sdd/001-greeting/spec)"
git checkout -q sdd/001-greeting/M001
cd ../..

# This machine's pipeline work.
mkdir -p "$ms"
printf '{ "demo": "%s/clones/demo" }\n' "$brain" > .sdd/links.json
cat > "$spec/spec.md" <<'EOF'
# Greeting

**Repos:** demo

**Key:** None

**Depends on:** None

**Brain notes:** None

**Base:** demo@main

## Problem Statement

The demo prints nothing useful.

## Solution

It prints hello.

## User Stories

1. As a user, I want the demo to say hello, so that I know it works.
EOF
cat > "$ms/milestone.md" <<EOF
# Milestone 001: Print the greeting

**Delivers:** the demo says hello.

**Done when:** \`sh test.sh\` prints \`ok\`.

**Builds after:** None

**Lands after:** None

**Phase:** $PHASE

**Squash:** none

**Landed:** none
EOF
cat > "$ms/001-print-hello.md" <<EOF
# Ticket 001: Print hello

**Milestone:** 001 Print the greeting

**Status:** done

**Depends on:** None

**Commit:** $ticket_sha

## What to build

The greeting file says hello.

## Acceptance criteria

- [x] \`sh test.sh\` prints ok, proven at the test script

## Notes

None
EOF
printf '# Review: Print the greeting\n\n**Fixed point:** %s\n\n**Head:** %s\n\n%s\n' "$fixed_sha" "$head_sha" "$REVIEW" > "$ms/review.md"
