# Ticket 002 is blocked; the user then built it by hand as the last commit on the milestone's branch.
PHASE=none
REVIEW=''
. "$(dirname "$0")/../_fixtures/brain.sh"
ms=.brain/specs/001-greeting/milestones/demo/001-greeting
rm "$ms/review.md"
cat > "$ms/002-greet-by-name.md" <<'TICKET'
# Ticket 002: Greet by name

**Milestone:** 001 Print the greeting

**Status:** blocked

**Depends on:** 001

**Commit:** none

## What to build

`sh greet.sh <name>` prints `hello, <name>`.

## Acceptance criteria

- [ ] `sh greet.sh Ana` prints `hello, Ana`, proven at `test.sh`

## Notes

- Blocked: the builder and the fixer could not make `test.sh` call `greet.sh`.
TICKET
cd clones/demo
printf 'echo "$(cat greeting.txt), $1"\n' > greet.sh
printf 'grep -q hello greeting.txt && test "$(sh greet.sh Ana)" = "hello, Ana" && echo ok\n' > test.sh
git add -A && git commit -q -m "Greets by name"
