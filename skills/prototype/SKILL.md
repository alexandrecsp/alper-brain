---
name: prototype
description: Build a throwaway prototype that answers one design question. Use when the user wants to feel out whether logic, a state model or a contract between repositories is right, or explore what a UI should look like.
argument-hint: "[question]"
metadata:
  type: process
---

A prototype is **throwaway** code that answers one question. The question decides its shape, and the **verdict** (the answer, with the question it settled) is the only part that ships.

## Pick the branch

Name the question from the user's prompt and the code around it, then its branch:

- **"Does this logic or state model feel right?"** → [LOGIC.md](references/LOGIC.md): one shareable HTML file with free-play buttons and guided walkthroughs that push a pure state module through the cases that are hard to reason about on paper.
- **"What should this look like?"** → [UI.md](references/UI.md): several structurally different variants on one route, switched by a `?variant=` search param and a floating bar.

When the question is unclear, ask the user; when they are away, follow the code around it (a backend module or a contract → logic, a page or component → UI) and state that assumption at the top of the prototype. Done when you hold the question in one sentence, and its branch.

## Where it lives

- **A logic prototype** lives in the active brain, at `.sdd/prototypes/<slug>.html` ([FORMAT.md](../brain/references/FORMAT.md)), with `<slug>` the question in kebab-case. It changes no repository, so it needs none open, and it can model a contract between several. Read the code it models by each repository's root; linked is enough.
- **A UI prototype** lives in the **working repository** that serves the page, by FORMAT.md's rules; inside a spec, the **Repos** entry that owns the page. It must be open. Check its tree is clean (`git -C <root> status --porcelain` prints nothing; otherwise ask the user to commit or stash, and stop), then create and check out `prototype/<slug>` from its base: the spec's **Base** entry for that slug, else the branch checked out. Write every prototype file on that branch, by absolute path under the root.

Done when you hold the prototype's path, and for a UI prototype its branch is checked out on a clean tree.

## Rules for both branches

- **Throwaway, and named so.** `prototype` is in every file, route and branch name it adds.
- **Speed over polish.** Write only the code that makes it runnable: tests, error handling and abstractions belong to the real build.

## Capture

The prototype is done when its question has a **verdict**: the answer, the question it settled, and what the prototype showed that decided it. Then:

1. **Keep the prototype.** A UI prototype: commit every variant, the switcher and the bar on `prototype/<slug>` (`git -C <root>`), then check its base back out. A logic prototype stays at its `.sdd/prototypes/` path.
2. **Hand over the verdict**, by where the work lives:
   - **Inside a spec**, when an in-flight spec under the brain's `.sdd/specs/` covers the work: write the verdict under its Implementation Decisions, with the prototype's branch or path, and delete the open question it settles from Further Notes. When the spec already has milestones, also add the verdict to the Notes of every ticket not yet `done` that builds on it.
   - **Standalone**: give the user the verdict and the prototype's branch or path, and offer to apply it. On a yes, rebuild the decision in the working repository, with `tdd` where that code has tests.
3. **Record the decision.** When the repositories it bears on are registered, invoke the `brain` skill to record the verdict as a `decision`: in `repos/<slug>/`, or in `shared/` with its `repos` when it settles a contract, linked to that contract's note. Its **Why** is what the prototype showed, written so a teammate who never ran the prototype can follow it.

Done when the prototype is kept, the verdict is in the spec or with the user, and the decision sits in a draft, or its repositories are not registered.
