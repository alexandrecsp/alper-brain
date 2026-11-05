---
name: commit
description: Commit changes with a keyed message in the present tense. Use when committing work.
argument-hint: "[spec-id] [repository]"
metadata:
  type: process
---

A commit message describes the project's **new state**: its title completes the sentence "If applied, this commit…", in the present tense, third person: _Adds authentication_, _Fixes rounding in invoice totals_.

```
<key>: <Title>

- <detail>
- <detail>
```

- **Key**: the key step 1 finds, such as `FUNC-1234`. Without one, the first line is the title alone.
- **Title**: at most 72 characters, capitalised.
- **Details**: one to three bullets, each one line, carrying what the title cannot: the reason, or a consequence a reader of the log needs.

## Process

Commit in the **working repository**, by [FORMAT.md](../brain/FORMAT.md): the one the caller names, or the one its rules give. When the changes are the brain's own (notes, cards, `BRAIN.md`), commit in the active brain, its folder as the root, with no key. When the task changed several repositories, run these steps once per repository, each with its own key. When the repository is linked but not open, ask the user to run `/add-dir <root>`, and stop. The session and every sub-agent start in the brain, so run every git command as `git -C <root>`.

1. **Find the key**, by the first rule that gives one:
   1. The repository's card, `repos/<slug>/REPO.md` in the brain, holds a `null` `commitKeyPattern`: no key.
   2. A spec folder, from a `[spec-id]` argument by [SPEC-ID.md](../to-spec/SPEC-ID.md) or the one this conversation works in: its `spec.md` **Key** line's one key, or its entry for the repository's slug. `None` means no key.
   3. Ask the user for a key, or none.

   A key fully matches the card's `commitKeyPattern`; when it does not, ask the user for one that does. A sub-agent, with no user to ask, commits without a key and reports why. Done when you hold a matching key, or know there is none.

2. **Stage.** Commit what is staged. When `git -C <root> diff --staged` is empty, stage every change the current task made in this repository, path by path. Done when `git -C <root> diff --staged` holds what was staged, or else exactly the task's changes.

3. **Write the message** from `git -C <root> diff --staged`. Done when it meets every rule above: key, title and details.

4. **Commit.** Done when each repository's commit exists and you have reported its SHA (`git -C <root> rev-parse HEAD`).
