# Spec 002 ready to ticket: five small stories in one repository, demo, none waiting on another track.
# Cut one milestone per story, they make five; the cut should group them into one or two.
PHASE=none
REVIEW=''
. "$(dirname "$0")/../_fixtures/brain.sh"
spec2=".brain/.local/specs/002-demo-cli"
mkdir -p "$spec2"
cat > "$spec2/spec.md" <<'EOF'
# Demo command line

**Repos:** demo

**Key:** None

**Depends on:** None

**Brain notes:** None

**Base:** demo@main

## Problem Statement

The demo only holds a greeting file. Nobody can run it.

## Solution

A `demo.sh` script with five commands, each checked by `test.sh`.

## User Stories

1. As a user, I want `sh demo.sh greet <name>` to print `hello <name>`, so that I am greeted.
2. As a user, I want `sh demo.sh bye <name>` to print `bye <name>`, so that I am seen off.
3. As a user, I want `--upper` before any command to print its output in capitals, so that I can shout.
4. As a user, I want `sh demo.sh count` to print how many greetings were made, so that I can see the demo's use.
5. As a user, I want `sh demo.sh help` to list the commands, and an unknown command to exit 2 with that list, so that I can find my way.

## Out of Scope

Anything beyond these five commands.

## Implementation Decisions

- `demo.sh` reads its command as the first argument after an optional `--upper`, and runs one shell function per command.
- `greet` appends one line to `greetings.log`; `count` prints its line count, or 0 when the file is missing.

## Relies On

None

## Testing Decisions

- `test.sh` runs each command and compares its output, printing `ok` when every check passes. The seam is the command line: each check runs `sh demo.sh ...`.

## Design Patterns

None

## Further Notes

None.
EOF
