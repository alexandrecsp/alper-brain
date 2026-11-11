# A milestone stopped at ask: reviewed, one escalated finding left unanswered for the user, who decides escalations.
PHASE=ask
REVIEW='## Summary

1 finding, 1 escalated. Worst: ST1.

## Standards

ST1. test.sh: the check greps a file instead of running the program. Judgement call, **escalate**: the fix changes the interface the spec names as its seam.

## Spec

None.'
. "$(dirname "$0")/../_fixtures/brain.sh"
