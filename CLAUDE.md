Every skill, reference file and agent definition in this repo is written for agents: invoke `agent-writing` before writing or reviewing one.

Skills point at each other's sections by name ("LAND.md's **Land a track**"): after renaming a heading or a step's bold lead, run `node scripts/check-refs.mjs` until it passes. After changing build's Phase table, the build pane (`hooks/sdd.ts`) or the brain page, run `node scripts/check-phases.mjs`. Before and after changing `build`, `LAND.md`, `commit` or the Context block, run the evals by `evals/README.md`.
