---
type: regex
target:
  source: file
  path: .brain/.local/specs/001-greeting/demo/001-greeting/002-greet-by-name.md
pattern: '\|-{3}\|-{3}\|-{3}\|-{3}\|\r?\n\|[^\n]*[A-Za-z]'
---

The builder fills the ticket's Test plan before it builds. It grades the builder's process, not its commit, since a read-only sandbox refuses the commit.
