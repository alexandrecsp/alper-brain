# Check the dependencies

Build's step 2, for a spec whose **Depends on** names other specs, on the call that starts it. `sdd` and `state` are build's, by its **State**.

For each of `state`'s `dependencies`, stop at the first of these that holds:

- `found` is false: report it;
- `abandoned` is set: report that this spec must be revised to drop it, with `/write-tickets <spec-id> --amend`;
- an `onBase` entry is `unlinked`: ask the user to run `/brain link`;
- an `onBase` entry is `not merged`: report that this spec waits for the dependency's PR to merge in that repository, and that `/open-pr <the dependency> --merged` records the merge;
- `landed` is missing, or an `onBase` entry is not `true`: report that this spec waits on it.

Then dispatch one `alper-brain:spec-reviewer` agent per dependency, in waves by [BRIEF.md](../../brain/references/BRIEF.md)'s **Fanning out**, with the Context block (the repositories the dependency's **Landed** line names under **Works in** and **Also reads**, read only, and **Writes** nothing), the paths of both `spec.md` files, and this brief:

> Check whether the dependency was built as this spec assumes. For each bullet of this spec's **Relies On** section that names the dependency, read the code it touches as it stands on the branch the dependency's **Base** line names for that repository, with `git -C <root> show <base>:<path>` (the working tree may hold another branch), and the Notes of the dependency's tickets, and report the bullet as **holds** or **drifted**, with what the code does instead. Change nothing. Done when every such bullet has its verdict, or you report that no bullet names the dependency.

When any bullet drifted, show the user the report and stop: revising the spec is the user's call. Done when every dependency has landed and every Relies On bullet has a verdict from its reviewer and holds, or the spec has none.
