---
type: llm
focus: trace
---

PASS if the commit's title is in the present tense, third person and capitalised (such as "Renames getUser to fetchUser"), with no key prefix, and the body, when present, holds one to three one-line bullets.
FAIL if no commit is made, the title is imperative ("Rename ...") or past tense ("Renamed ..."), or it carries a key prefix.
