# Domain lens

What the **domain lens** adds to the rounds of [SKILL.md](../SKILL.md): each term is challenged and sharpened round by round, and each term and decision is written down as it settles. [DOMAIN-DOCS.md](../../brain/references/DOMAIN-DOCS.md) says where each lives and how to read it. The brainstorm drives: its rounds and phases stay as written, and the lens feeds them.

## Read the domain docs

Alongside `What · Round 1`, or in the round the lens joins, read the domain docs of every repository the topic touches, picked by [RECALL.md](../../brain/references/RECALL.md)'s **Pick the repositories**, by DOMAIN-DOCS.md's **Read them**, recalling at the `business` layer; a repository an earlier recall already covered is not read again. That read stands in for the round's first recall; in a feature, FEATURE.md's `application` scan when the `How` opens still runs. When the lens joins after a phase summary was confirmed, the next summary carries that phase's **Domain docs** too. Done when you have read the glossary, the ADRs and the contract notes of each repository.

## Each round

Each challenge below enters the round you are writing as a frontier question; a finding from an explorer enters the round after its report arrives. Done, each round, when every domain term in the user's latest answers has been checked against its repository's glossary, and each conflict, vague term, edge case and claim about the code is a question of the round.

- **Challenge against the glossary.** When the user uses a term that conflicts with the glossary of the repository it belongs to, or a word the glossary avoids, call it out, quoting the glossary exactly: "Your glossary defines 'cancellation' as X, but you seem to mean Y. Which is it?" Across repositories, one word defined two ways is two contexts, not a conflict: challenge it only where the design carries the concept across that boundary, and ask the contract question below.
- **Sharpen fuzzy language.** When the user uses a vague or overloaded term, propose a precise canonical one: "You're saying 'account': do you mean the Customer or the User? Those are different things." When the term crosses an interface a `contract` note records, a new name changes the contract: ask [FEATURE.md](FEATURE.md)'s **Second brain** question for a changed contract (do its other repositories change with it, or does the interface keep the old name?), and record each side's term in the contract note, by DOMAIN-DOCS.md's **Where each fact lives**.
- **Probe with scenarios.** When domain relationships are discussed, invent a concrete scenario at the edge between two concepts and ask what happens: "A customer cancels one Order line after the Shipment is booked: is that a cancellation or a return?" Each answer forces a precise boundary.
- **Check against the code.** A claim about how the code works is a fact, checked by [SKILL.md](../SKILL.md)'s **Facts and Decisions** in each repository it involves, put to the explorer in both the glossary's term and the user's word, so it finds the code under either name. A repository that is only registered is checked against its explored notes, with the hint `/brain link`. Each contradiction is a frontier question: "Your code cancels entire Orders, but you just said partial cancellation is possible. Which is right?"

## As it settles

Write each settled term by DOMAIN-DOCS.md's **Write it**, following its **A term**. A settled decision that passes DOMAIN-DOCS.md's **A decision** tests enters the next round as a frontier question naming its home, with your recommendation, yes or no; write each accepted one by **Write it**. In a **decision** brainstorm the choice itself is that decision, recorded by the `How` summary's next step, so the lens offers only the others.

The **Domain docs** list, placed by [SKILL.md](../SKILL.md)'s **Summaries**, holds per repository in scope the terms written, the decisions written or declined, and the pending writes with what each waits on; then the terms and decisions spanning repositories, under the brain; each part written `none` when empty.

## Done

Once the user confirms the `How` summary, finish the pending list by DOMAIN-DOCS.md's **Write it**, before the brainstorm offers its next step. Done when every settled decision of the session was checked against the **A decision** tests and each one that passed was offered, and each term and accepted decision on the **Domain docs** list is written, drafted, or told to the user as unwritten.
