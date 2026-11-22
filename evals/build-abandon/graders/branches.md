---
type: llm
focus: trace
---

Judge the calls the agent makes, whether or not git accepts them: a read-only sandbox can refuse every git write.

PASS if the agent tries to delete the `sdd/001-greeting/` branches of the demo repository (`git branch -D`), checking out another branch first since one of them is checked out, or reports which git command refused it.
FAIL if it never tries to delete them and never says why, or deletes a branch outside `sdd/001-greeting/`.
