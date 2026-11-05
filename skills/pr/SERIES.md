# PR series

A spec with more than one landing opens a **series**: one PR per landing, merged in milestone order. That is the order [CONTRACT-CHANGE.md](../to-tickets/CONTRACT-CHANGE.md) cut them in (the producer's expand, each consumer's migrate, the producer's contract), so every repository keeps working with the others as each PR merges and deploys.

- **Stacked within a repository.** A repository's later landing builds on its earlier one, so its PR's base is the earlier landing's head branch, and it opens as a draft (`gh pr create --draft`). GitHub retargets it onto the repository's base when the earlier PR merges and its branch is deleted.
- **Merge Order.** Every body in the series ends with the same section, marking its own PR **This PR**:

  ```markdown
  ## Merge Order

  Part of <spec title> (<key>). Merge and deploy each before the next:

  1. <owner>/<repo>#<n>: <repo slug>, <the landing's Delivers, in a few words>
  2. **This PR**: <repo slug>, <…>
  ```

- **Two passes.** Open every PR first, with the Merge Order naming slugs only. Then fill in each number and update every body with `gh pr edit <n> --repo <owner>/<name> --body-file -`, so each body lists all its siblings.
- **Doors in a series.** An expand or migrate landing is two-way by **Merge Danger**; the contract landing is one-way. Its blast radius names every consumer the contract note lists: "migrates in #<n>" for those in the series, and by the consumer check for those outside it.

Done when every PR in the series is open or updated, and every body's Merge Order lists all of them with their numbers.
