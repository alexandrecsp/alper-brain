A **contract** is an interface one repository offers another (an API, an event, a queue, a shared schema), with a **producer** and **consumers**; the brain's `contract` notes in `shared/` name both. Each side tests its own half in its own suite, so each repository's suite runs without the other one running.

## In the producer

The seam is the interface itself, crossed the way a consumer crosses it: a request to the route, an event as the publisher emits it. Test every shape the milestone's **Delivers** leaves offered: in an expand milestone, the new shape and the old one beside it, asserting the fields the consumers read. The old shape's test going red means a deployed consumer breaks.

## In the consumer

Stand the producer in with a fake at a port, shaped by [MOCKING.md](MOCKING.md)'s SDK-style interface. Build each fake answer from the producer's code at the commit this milestone builds against, read by absolute path from the producer's root (your brief's **Also reads**, else the brain's `.sdd/links.json`), and name that file and commit in a comment beside the fixture, so the next contract change finds it. When the producer is not linked, build the fake from the `contract` note and report it as unverified against the code.

When the repositories already share a contract tool (consumer-driven contracts such as Pact, a published schema, a generated client, a shared fixtures package), use it in place of a hand-written fake: that tool is what carries the producer's change into the consumer's suite.
