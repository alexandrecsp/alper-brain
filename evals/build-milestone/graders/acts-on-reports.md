---
type: llm
focus: trace
---

PASS if, after each builder or fixer report, the main session acts on it: it dispatches the next ticket's builder, dispatches a fixer, closes the milestone, or reports the track blocked with what stopped it. The final reply says where the track stands.
FAIL if the main session ignores a report, builds or edits the repository's code itself, or ends without saying where the track stands.
