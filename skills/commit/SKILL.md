---
name: commit
description: Commit work with a keyed, present-tense message. Use when committing a repository's changes or the brain's.
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
- **First line**: the key and title together at most 72 characters; the title capitalised.
- **Details**: one to three bullets, each one line, carrying what the title cannot: the reason, or a consequence a reader of the log needs.

## Process

Commit in the **working repository**, by [FORMAT.md](../brain/references/FORMAT.md): the `[repository]` argument or the one the caller names, or the one its rules give; with no brain open, its **With no brain open** gives the root, and step 1's last rule the key; when the task touches the domain (a term or a decision), tell the user to open the brain, since a session without it reads no terms or decisions. When the changes are the brain's own (notes, cards, `BRAIN.md`), commit in the active brain, its folder as the root; in an embedded brain, commit in its host, naming the brain's paths, by FORMAT.md's **Embedded brain**. When the task changed several repositories, run these steps once per repository, each with its own key. When the repository is linked but not open, ask the user to run `/add-dir <root>`, and stop. Done when you hold the root of each repository to commit.

1. **Find the key**, by the first rule that gives one:
   1. The changes are the brain's notes: no key, except for the notes [SYNC.md](../brain/references/SYNC.md)'s **Consolidate** commits, which take the key its **Find the keys** asks for, per repository.
   2. The repository's card, `repos/<slug>.md` in the brain, holds a `null` `commitKeyPattern`: no key.
   3. A spec folder, from a `[spec-id]` argument by [SPEC-ID.md](../write-spec/references/SPEC-ID.md) or the one this conversation works in: its `spec.md` **Key** line's one key, or its entry for the repository's slug. `None` means no key.
   4. Ask the user for a key, or none.

   A key fully matches the card's `commitKeyPattern` (with no card, any key the user gives); when it does not, ask the user for one that does. A sub-agent, with no user to ask, commits without a key and reports why. Done when you hold a matching key, or know there is none.

2. **Stage.** Commit what is staged. When `git -C <root> diff --staged` is empty, stage every change the current task made in this repository, path by path. For the brain's own changes in an embedded brain, stage nothing: the commit names the brain's paths (`-- <path>...`), so the host's staged work stays staged. Done when `git -C <root> diff --staged` holds what was staged, or else exactly the task's changes.

3. **Write the message** from the diff step 2 settled (`git -C <root> diff --staged`, or `git -C <root> diff HEAD -- <paths>` with the new files for named paths) and what the task was for. Done when it meets every rule above: key, first line and details.

4. **Commit.** Run `git -C <root> commit`, the message given as one `-m` per paragraph, with step 2's `-- <paths>` when it named them. Done when each repository's commit exists and you have reported its SHA (`git -C <root> rev-parse HEAD`).
