A **contract change** changes an interface one repository offers another: an API, an event, a queue or a shared schema, with a **producer** that offers it and **consumers** that call it. Each repository lands on its own base and deploys on its own schedule, so no moment exists when every side switches at once. Sequence it as **expand–contract across repositories**, each step its own milestone that leaves every repository working with every other one as it stands:

1. **Expand**, in the producer: offer the new shape beside the old one (a new field the old consumers ignore, a `v2` route or event next to `v1`), so every consumer keeps working.
2. **Migrate**, one milestone per consumer: move it onto the new shape. The old shape still exists, so each consumer lands and deploys alone.
3. **Contract**, in the producer, after every migrate milestone: remove the old shape.

`build` lands a repository each time the build moves on to a milestone in another one, so the milestone order is also the order the repositories land in: the producer's expand, then each consumer, then the producer's contract. Each **Delivers** names the shapes it leaves offered or called.

A change every consumer already tolerates, such as an optional field added, needs only its producer milestone. When the user wants the old shape kept for consumers outside the brain, leave the contract step out and record why in the spec's Further Notes.
