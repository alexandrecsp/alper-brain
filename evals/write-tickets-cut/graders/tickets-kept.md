---
type: llm
focus: trace
---

Judge the ticket files the agent writes under `.brain/specs/002-demo-cli/milestones/demo/`.

PASS if each of the spec's five user stories is covered by the acceptance criteria of at least one ticket, each ticket is a tracer bullet a builder can finish in one fresh context, and no milestone holds more than 8 tickets.
FAIL if a story has no ticket, if stories are packed into one oversized ticket so that the ticket count falls below five, or if a milestone holds more than 8 tickets.
