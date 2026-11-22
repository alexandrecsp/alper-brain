# Release branches

A branch named `rlse/vX.Y.Z`, three whole numbers, is a **release branch**: its name carries the software's version. A spec builds from its repository's default branch or from a release branch, and the user says which. From a release branch, build offers the next version too, and an accepted one becomes the base, with the version raised in the branch's name and in the software's **version files** alike.

## Offer

Build's step 1, for each repository with a `repo.releases`, which `state` gives while the base is still to be defined: the default branch when it is itself a release branch, then the most recent one, the highest version among the local and `origin`'s branches as last fetched. Each has its `branch`, its `version` and its `next` patch, minor and major. A release branch the user names, or that a dependency's **Base** names for this repository, is offered the same way: derive its three by raising one number and zeroing those to its right.

Ask both choices in one question per repository:

- **The base**: the default branch (`repo.base`; when that is missing, ask which branch it is), or a release branch. Recommend the one a dependency's **Base** names for this repository, else the default.
- **The version**, should the base be a release branch: each of the three next branches, marked **exists** when `git -C <root> branch -a --list '<branch>' 'origin/<branch>'` prints it, or the release branch as it is. Recommend one from the spec: major when it breaks what a consumer uses, minor when it adds behaviour, patch otherwise.

The pick is the user's alone: a recommendation is never taken for an answer. What the call's arguments or this conversation already answered stands, and only the rest is asked: the default branch needs no version, and a version alone picks the one release branch offered, or asks which when there are several.

Done when each such repository has a base picked and, for a release branch, its version or the branch as it is.

## Set the base

Build's step 2, once the dependencies hold, for each repository the user picked for. `<from>` is the branch picked and `<new>` the next version's branch, when the user accepted one. The default branch takes steps 2 and 5 alone, a release branch kept as it is steps 1, 2 and 5.

1. **Check out the start**: `<new>` when it exists, else `<from>`. When only `origin` has it, create it with `git -C <root> checkout --no-track -b <branch> refs/remotes/origin/<branch>`. When both have it, check out the local one and run `git -C <root> merge --ff-only refs/remotes/origin/<branch>`, since a release branch nobody works on here is often behind; when that refuses, the two diverged: show the user and stop. Done when `HEAD` is on the start and holds what `origin` had at the last fetch.
2. **Check it holds the dependencies.** Each dependency's **Landed** SHA for this repository must be an ancestor of the start, the default branch's tip when that was picked (`git -C <root> merge-base --is-ancestor <SHA> <start>`). When one is not, name the branch that dependency's **Base** gives and ask the user to pick again, or to confirm that the start holds it under another commit, as after a squash merge. Done when the start holds every dependency.
3. **Raise the version.** When `<new>` does not exist, create it with `git -C <root> checkout -b <new>`. Then, on it, edit every tracked **version file**, one that declares this software's own version, found from the ecosystem's manifests and from `git -C <root> grep -n -F <old version>`:
   - manifests such as `package.json`, `pom.xml`, `build.gradle` or `gradle.properties`, `pyproject.toml`, `Cargo.toml`, `*.csproj` or `Directory.Build.props`, and a version constant or file of the project's own;
   - the same version where it repeats: each module of a monorepo that shares it, a child pom's `<parent>` when that parent is this project's, the project's own entries in a lockfile.

   Change only that value, where it is defined (a property such as `${revision}` at its definition), keeping a suffix such as `-SNAPSHOT`. A dependency that happens to have the same number keeps it, and a file already at the new version stays. When the main manifest holds neither version, show the user what it holds and ask before editing it. When no file declares one, as when it comes from git tags, say so and go on. Done when every line the grep still prints is something other than this software's version, and the diff holds version values alone.
4. **Commit** what changed through the `commit` skill, in this repository with the spec's key, titled `Bumps the version to <new version>`. Done when the tree is clean.
5. **Record the base**: write `<slug>@<branch>` into the **Base** line by build's **Branches**, the branch being `<new>`, else `<from>`. It goes last, so a call that stopped earlier asks again and finds `<new>` to finish. Report the base and, for a new version, `<from>` → `<new>`, the files raised and the commit. Done when the **Base** line holds the entry.
