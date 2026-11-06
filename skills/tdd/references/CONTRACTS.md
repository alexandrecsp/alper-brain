A **contract** is an interface one repository offers another (an API, an event, a queue, a shared schema), with a **producer** and **consumers**; the brain's `contract` notes in `shared/` name both. Each side tests its own half in its own suite, so each repository's suite runs without the other one running.

## In the producer

The seam is the interface itself, crossed the way a consumer crosses it: a request to the route, an event as the publisher emits it. Test every shape the milestone's **Delivers** leaves offered: in an expand milestone, the new shape and the old one beside it, asserting the fields the consumers read. The old shape's test going red means a deployed consumer breaks.

## In the consumer

Stand the producer in with a fake at a port, shaped by [MOCKING.md](MOCKING.md)'s SDK-style interface. When the repositories already share a contract tool (consumer-driven contracts such as Pact, a published schema, a generated client, a shared fixtures package) that already carries this milestone's shape, use it in place of a hand-written fake: that tool is what carries the producer's change into the consumer's suite.

Otherwise build each fake answer from the first source below that applies, and name that source in a comment beside the fixture, so the next contract change finds it. Read the producer's code only with `git -C <root> show <commit>:<path>`, `<root>` from your brief's **Also reads**, else the brain's `.sdd/links.json`: its working tree may hold another branch mid-build.

1. Your ticket's **Depends on** names a ticket in the producer's track: the producer's code at that ticket's **Commit**. Name the file and commit.
2. `spec.md`'s API contracts entry for this interface pins its new shape (the route, event, queue message or schema, and each field with its type and whether it is optional), as a migrate building beside its producer's expand has it: that entry alone, even with the producer under **Also reads**, since its side may not be built yet. Name `spec.md` and the entry.
3. The producer is linked: its code on its base branch, the producer's entry in `spec.md`'s **Base** line, else its remote's default (`git -C <root> symbolic-ref --short refs/remotes/origin/HEAD`, without `origin/`). Name the file and commit.
4. Otherwise: the `contract` note. Report the fake as unverified against the code.
