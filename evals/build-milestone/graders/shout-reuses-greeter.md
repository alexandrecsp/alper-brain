---
type: regex
target:
  source: file
  path: clones/demo/shout.sh
pattern: 'greeting\.txt'
match: not_contains
---

shout.sh reaches the greeting through greet.sh or a shared helper rather than reading greeting.txt itself, so the missing-file check of ticket 004 lives in one place.
