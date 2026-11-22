---
type: llm
focus: trace
---

Judge the message in the `git commit` command the agent runs, whether or not git accepts the commit: a read-only sandbox can refuse it.

PASS if the commit's title is in the present tense, third person and capitalised (such as "Renames getUser to fetchUser"), with no key prefix, and the body, when present, holds one to three one-line bullets.
FAIL if the agent never runs `git commit`, the title is imperative ("Rename ...") or past tense ("Renamed ..."), or it carries a key prefix.
