# A milestone of two tickets: 001 is built and committed, 002 is still todo and builds on it. The milestone's branch
# is checked out, so a sandbox that cannot write git (WSL2) still reaches the builder; the spec is long enough that
# reading all of it shows in scripts/agent-tokens.mjs.
PHASE=none
REVIEW=''
. "$(dirname "$0")/../_fixtures/brain.sh"
ms=.sdd/specs/001-greeting/milestones/demo/001-greeting
rm "$ms/review.md"

# Ticket 001 is built: its Notes say what the next ticket needs.
sed -i 's/^None$/- `greeting.txt` holds the greeting text; nothing else reads it yet.\n- `test.sh` is the unit suite: each check prints `ok` or exits non-zero./' "$ms/001-print-hello.md"

cat > "$ms/002-greet-by-name.md" <<'TICKET'
# Ticket 002: Greet by name

**Milestone:** 001 Print the greeting

**Status:** todo

**Depends on:** 001

**Commit:** none

## What to build

`sh greet.sh <name>` prints the greeting from `greeting.txt` followed by the name, as `hello, Ana`. Without a name it prints the greeting alone.

## Design patterns

None

## Acceptance criteria

- [ ] `sh greet.sh Ana` prints `hello, Ana`, proven at `test.sh`
- [ ] `sh greet.sh` prints `hello`, proven at `test.sh`

## Notes

Left empty; the agent that builds this ticket fills it.
TICKET

cat >> .sdd/specs/001-greeting/spec.md <<'SPEC'
2. As a user, I want the demo to greet me by name, so that the greeting feels personal.
3. As a maintainer, I want the greeting text kept in one file, so that changing it needs no code change.

## Implementation Decisions

- The greeting text lives in `greeting.txt`, read at run time; `greet.sh` never hard-codes it.
- `greet.sh` takes the name as its first argument and prints `<greeting>, <name>`; with no argument it prints the greeting alone.
- Output goes to standard output, one line, with no trailing spaces.
- Errors (a missing `greeting.txt`) print one line to standard error and exit 1.

## Module map

| Module | Repo | Interface |
|---|---|---|
| Greeting text | demo | `greeting.txt`, one line |
| Greeter | demo | `sh greet.sh [name]` |
| Suite | demo | `sh test.sh`, prints `ok` per check |

## Testing Decisions

- `test.sh` is the only seam: each check runs `greet.sh` and compares its output.
- No mocks: the checks read the real `greeting.txt`.

## Out of Scope

- Translations of the greeting.
- Reading the name from the environment or standard input.
- Any output format other than one line of text.

## Further Notes

The demo stays a shell script so it runs anywhere with `sh`.
SPEC
