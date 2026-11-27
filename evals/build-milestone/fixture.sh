# A milestone of four tickets: 001 is built and committed, 002 to 004 are todo, each building on the one before.
# 003 calls for what 002 built (reading greeting.txt), and 004 changes both scripts 002 and 003 wrote, so whether a
# builder reuses its predecessors' code, or writes a second copy, shows in greet.sh, shout.sh and the review.
# Used to compare how the builders are dispatched: one per ticket, one continued across tickets, one per milestone.
PHASE=none
REVIEW=''
. "$(dirname "$0")/../_fixtures/brain.sh"
spec=.brain/.local/specs/001-greeting
ms=$spec/demo/001-greeting
rm "$ms/review.md"

sed -i 's/^None$/- `greeting.txt` holds the greeting text; nothing else reads it yet.\n- `test.sh` is the unit suite: each check prints `ok` or exits non-zero./' "$ms/001-print-hello.md"
sed -i 's/^\*\*Done when:\*\*.*/**Done when:** `sh test.sh` prints only `ok` lines, and covers greet.sh, shout.sh and a missing `greeting.txt`./' "$ms/milestone.md"
sed -i 's/^\*\*Delivers:\*\*.*/**Delivers:** the demo greets by name, shouts the greeting, and fails cleanly without its greeting file./' "$ms/milestone.md"

ticket() { # <number> <slug> <title> <depends on> <what to build> <criterion>...
  local n=$1 slug=$2 title=$3 dep=$4 what=$5; shift 5
  {
    printf '# Ticket %s: %s\n\n**Milestone:** 001 Print the greeting\n\n**Status:** todo\n\n' "$n" "$title"
    printf '**Depends on:** %s\n\n**Commit:** none\n\n## What to build\n\n%s\n\n## Design patterns\n\nNone\n\n' "$dep" "$what"
    printf '## Acceptance criteria\n\n'
    for c in "$@"; do printf -- '- [ ] %s\n' "$c"; done
    printf '\n## Test plan\n\n| Clause | Seam | Test | Assertion |\n|---|---|---|---|\n\n'
    printf 'Left empty; the agent that builds this ticket fills it, one row per clause of each acceptance criterion.\n\n'
    printf '## Notes\n\nLeft empty; the agent that builds this ticket fills it.\n'
  } > "$ms/$n-$slug.md"
}

ticket 002 greet-by-name 'Greet by name' 001 \
  '`sh greet.sh <name>` prints the greeting from `greeting.txt` followed by the name, as `hello, Ana`. Without a name it prints the greeting alone.' \
  '`sh greet.sh Ana` prints `hello, Ana`, proven at `test.sh`' \
  '`sh greet.sh` prints `hello`, proven at `test.sh`'
ticket 003 shout 'Shout the greeting' 002 \
  '`sh shout.sh [name]` prints what `greet.sh` would print for the same name, in capitals, as `HELLO, ANA`.' \
  '`sh shout.sh Ana` prints `HELLO, ANA`, proven at `test.sh`' \
  '`sh shout.sh` prints `HELLO`, proven at `test.sh`' \
  'changing `greeting.txt` to `hi` makes `sh shout.sh Ana` print `HI, ANA`, proven at `test.sh`'
ticket 004 missing-greeting 'Fail without the greeting file' 003 \
  'When `greeting.txt` is missing, `greet.sh` and `shout.sh` each print `greeting.txt missing` to standard error, print nothing to standard output, and exit 1.' \
  '`sh greet.sh Ana` without `greeting.txt` prints `greeting.txt missing` on standard error and exits 1, proven at `test.sh`' \
  '`sh shout.sh Ana` without `greeting.txt` prints `greeting.txt missing` on standard error and exits 1, proven at `test.sh`' \
  'neither prints anything to standard output then, proven at `test.sh`'

cat >> "$spec/spec.md" <<'SPEC'
2. As a user, I want the demo to greet me by name, so that the greeting feels personal.
3. As a user, I want to shout the greeting, so that it stands out.
4. As a maintainer, I want the greeting text kept in one file, so that changing it needs no code change.
5. As a user, I want a clear error when the greeting file is gone, so that I know what to restore.

## Implementation Decisions

- The greeting text lives in `greeting.txt`, read at run time; no script hard-codes it.
- `greet.sh` takes the name as its first argument and prints `<greeting>, <name>`; with no argument it prints the greeting alone.
- `shout.sh` prints `greet.sh`'s line in capitals, for the same argument.
- Output goes to standard output, one line, with no trailing spaces.
- A missing `greeting.txt` prints `greeting.txt missing` to standard error and exits 1, from every script.

## Module map

| Module | Repo | Interface |
|---|---|---|
| Greeting text | demo | `greeting.txt`, one line |
| Greeter | demo | `sh greet.sh [name]` |
| Shouter | demo | `sh shout.sh [name]` |
| Suite | demo | `sh test.sh`, prints `ok` per check |

## Testing Decisions

- `test.sh` is the only seam: each check runs a script and compares its output and exit code.
- No mocks: the checks read the real `greeting.txt`, moving it aside for the missing-file checks and restoring it.

## Out of Scope

- Translations of the greeting.
- Reading the name from the environment or standard input.
- Any output format other than one line of text.

## Further Notes

The demo stays a set of shell scripts so it runs anywhere with `sh`.
SPEC
