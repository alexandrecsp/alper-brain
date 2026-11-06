# A build that stopped right after committing the milestone's squash, before recording it.
# The squash carries no Sdd-Milestone trailer, as one from before the trailer existed.
PHASE=squash
REVIEW='## Summary

0 findings.

## Standards

None.

## Spec

None.'
. "$(dirname "$0")/../_fixtures/brain.sh"
git -C clones/demo checkout -q sdd/001-greeting/spec
git -C clones/demo merge -q --squash sdd/001-greeting/M001
git -C clones/demo commit -q -m "Prints the greeting" -m "- Says hello"
