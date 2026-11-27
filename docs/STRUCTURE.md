# Structure

alper-brain is a Claude Code plugin, not an app. Most of it is Markdown written for agents, plus small Node scripts, one browser page and one pane. It is recorded as it is laid out, since the hexagon fits only real application code, and a plugin's folders are fixed by what Claude Code loads.

## Rules every folder shares

- **Claude Code fixes the top level.** `skills/`, `agents/`, `hooks/` and `.claude-plugin/plugin.json` sit where the plugin loader looks for them. Do not move or rename them.
- **A skill owns its folder.** Everything one skill needs sits in `skills/<skill>/`, so it ships and reads as one unit. A skill reaches another skill's file by a relative path (`../brain/references/FORMAT.md`), never by copying it.
- **Scripts are zero-dependency Node.** They run from the installed plugin's cache folder, where nothing is ever installed, so they import only `node:` modules. There is no `package.json`.
- **Tests sit beside the file they test**, as `<name>.test.mjs`, run by `node --test`. `scripts/check.mjs` finds every one under `skills/` and `server/`.
- **Agent-facing files follow `write-for-agents`.** Skills, references and agent definitions point at each other's sections by name, which `scripts/check-refs.mjs` checks.

## Folders

```
.claude-plugin/plugin.json      ← the plugin's manifest and version
skills/<skill>/
├── SKILL.md                    ← the skill: its trigger, then its steps
├── references/<TOPIC>.md       ← one branch or rule set the skill reads when it needs it
├── references/<topic>/<TOPIC>.md ← in a hub skill (code-design), one folder per topic: its entry reference, named for the topic, and the deeper files only it points to
├── scripts/<name>.mjs          ← a Node script the skill runs, its test beside it; the brain skill's `layout.mjs` is the one home of the brain's paths, and `migrate-layout.mjs` moves an old brain into the layout of `references/FORMAT.md`, its one-folder step in `move-to-clusters.mjs`, and the removal of leftover snapshots through their clones in `remove-snapshots.mjs`
└── <page>.html                 ← a page the skill opens (skills/brain/brain.html)
server/                         ← the brain page's server, a module by the default backend layout: main.mjs is its entry, which starts server.mjs, the composition root of the server process, detached; the Agent Watcher pane runs main.mjs at every session start, and the server stays up until stopped, on the port of the user's `~/.alper-brain/config.json` when it names one; domain/ (ports and errors), application/ and infrastructure/ sit beside, its tests beside the files they test; the note history is `application/services/brain-history.service.mjs` behind the driven port `domain/ports/brain-history.port.mjs`, with its git adapter in `infrastructure/driven/`
agents/<agent>.md               ← a sub-agent definition, dispatched by a skill
hooks/                          ← the Agent Watcher pane: register.tsx wires it, brain.ts reads the brain, draw.ts draws
types/index.d.ts                ← the types the pane shares, named by plugin.json
scripts/<check>.mjs             ← the repository's own checks, run by check.mjs and CI
evals/<case>/                   ← one paid eval case, its graders/ beside it, by evals/README.md
docs/                           ← design notes on the plugin itself
```

## Names

| Kind | Spelling | Example |
|---|---|---|
| Skill folder, agent file | kebab-case | `write-tickets/`, `spec-reviewer.md` |
| Skill entry | fixed by Claude Code | `SKILL.md` |
| Reference | UPPER-KEBAB `.md`; a hub's topic folder kebab-case | `IN-FLIGHT.md`, `FORMAT.md`, `module-design/DEEPENING.md` |
| Script | kebab-case `.mjs` | `git-read.test.mjs`, `notes.mjs` |
| Server file | kebab-case `<name>.<kind>.mjs`, the kind one of `use-case`, `service`, `port`, `adapter`, `controller`, `error`, `config`, `support` | `add-brain.use-case.mjs`, `http.controller.mjs`, `port-held.error.mjs` |
| Pane module | camel or lower `.ts` / `.tsx` | `register.tsx`, `brain.ts` |
| Eval case | `<skill>-<scenario>` | `build-resume-squash/` |

## Departures

- **No hexagon in scripts.** Each script is a few hundred lines with one job (rank notes, check prose, find a brain's paths). Layers would add files without adding a seam a test needs. A script that grows several driven technologies, such as a server reading files and running git, splits into a module by `code-design`'s default backend layout (`references/BACKEND.md`). The brain page's server is one, at the plugin root since the pane starts it as well as `/brain view`.
- **`brain.html` is one file.** The page opens straight from the plugin's folder by `file:///`, with no build step, so its script, styles and markup stay inline. Its sections are separated by `// ----------` banners.
