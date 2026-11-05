Explore alternative interfaces for a module with parallel sub-agents. Based on "Design It Twice" (Ousterhout): your first idea is unlikely to be the best.

## Process

1. **Frame the problem space.** Write the user a short explanation of the problem: the constraints any new interface must satisfy, the dependencies it relies on with their categories from [DEEPENING.md](DEEPENING.md), and a rough code sketch that makes the constraints concrete (an illustration, not a proposal). When the interface is a contract other repositories consume (the brain's `contract` notes name them, by [RECALL.md](../brain/RECALL.md)), frame it from the consumers' side too: before the architects, dispatch one `alper-brain:scout` per linked consumer, in parallel, each brief opening with the Context block by [BRIEF.md](../brain/BRIEF.md) (**Works in** the consumer, read only, **Notes** the contract note, **Writes** nothing), then "Find every place this repository calls the interface the contract note records. Report each call site with its `path:line`, what it sends, which fields, orderings and error modes of the reply it relies on, and the tests that pin them. Done when every call site is reported, or you report that there are none, with the searches you ran." Frame a consumer that is not linked from its notes alone, and skip the scouts for one whose call sites this conversation has already read. What each consumer relies on is a constraint every design must meet or name as a change. Show it, then go straight to step 2: the user reads while the sub-agents work. Done when the user has the explanation.

2. **Spawn sub-agents.** Spawn one `alper-brain:architect` agent per constraint below that applies, in parallel in one message, each with the same technical brief, opening with the Context block by [BRIEF.md](../brain/BRIEF.md) (**Docs** the glossaries and the absolute path of [DEEPENING.md](DEEPENING.md), **Writes** nothing), then file paths, coupling details, dependency categories, what sits behind the seam and step 1's constraints, and a different design constraint:

   - Agent 1: "Minimise the interface: 1 to 3 entry points, maximum leverage per entry point."
   - Agent 2: "Maximise flexibility: support many use cases and extension."
   - Agent 3: "Optimise for the most common caller: make the default case trivial."
   - Agent 4, when a dependency is remote but owned or true external: "Put each remote dependency behind a port the module declares, with an in-memory adapter for tests and the network adapter for production."
   - Agent 5, when the interface is a contract other repositories consume: "Keep every current consumer working unchanged: only add to the contract."

   Every brief's **Docs** line also names the absolute path of [SKILL.md](SKILL.md), for its vocabulary, and the glossaries of the [domain docs](../domain-modeling/DOMAIN-DOCS.md) when present, so each design names things in the same terms. Each sub-agent returns:

   1. The interface (types, methods, parameters, plus invariants, ordering, error modes)
   2. A usage example from a caller
   3. What the implementation hides behind the seam
   4. Its dependency strategy and adapters
   5. Trade-offs: where leverage is high, where it's thin
   6. For a contract: which consumers must change, and how

   Done when every sub-agent has returned every part its brief asks for; send a design missing a part back to its agent.

3. **Compare and recommend.** Present the designs one at a time, then compare them in prose by **depth**, **locality** and **seam placement**, and, for a contract, by **contract cost**: which consumers change, and whether expand–contract by [CONTRACT-CHANGE.md](../to-tickets/CONTRACT-CHANGE.md) can carry the change. Recommend the strongest, or a hybrid when parts of several combine well: the user wants a strong read, not a menu. Done when the user has your recommendation.
