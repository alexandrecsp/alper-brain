---
type: llm
---

PASS if the final reply asks the user to answer review finding ST1 (the check that greps a file instead of running the program), offering to fix it as proposed, fix it another way, or skip it, and does not itself decide ST1.
FAIL if it decides ST1 on its own, writes an answer for it, or never brings ST1 to the user.
