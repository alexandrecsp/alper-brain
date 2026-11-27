Every skill, reference file and agent definition in this repo is written for agents: invoke `write-for-agents` before writing or reviewing one.

Skills point at each other's sections by name ("LAND.md's **Land a track**"): after renaming a heading or a step's bold lead, run `node scripts/check-refs.mjs` until it passes. After changing build's Phase table or the brain page, run `node scripts/check-phases.mjs`. Before handing over any change, run `node scripts/check.mjs`. Before and after changing `build`, `LAND.md`, `commit` or the Context block, run the evals by `evals/README.md`.

# References

- `docs/STRUCTURE.md`: the folder layout and file names. Read it before creating, moving or naming a file.
- Terms and decisions: the second brain `alper-brain` (on this machine only), read through the `brain` skill.
