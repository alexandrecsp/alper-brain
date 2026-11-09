# View

The `view` branch of [`brain`](../SKILL.md): open the brain page, [brain.html](../brain.html), straight from this skill's folder. That folder's path changes with each plugin version, so this branch is how the user reaches the current page.

1. **Open it.** Build the page's URL from this skill's base directory: `file:///` followed by the absolute path to `brain.html`, with forward slashes (`file:///C:/Users/<user>/.claude/plugins/cache/.../brain/brain.html`). Open it with the OS's open command (`cmd /c start "" "<url>"` on Windows, `open` on macOS, `xdg-open` on Linux). Done when the command ran, or failed.

2. **Hand over.** Give the user the URL and the active brain's path, when one is open, and say:
   - The page needs Chrome or Edge. When the default browser is another one, paste the URL into Chrome or Edge.
   - To list a brain, click **Add brain** and pick its folder, the one holding `BRAIN.md`. Each knowledge base is one brain on the list.
   - A brain opens on its **Specs**: every spec across its repositories, with their milestones, tickets, reviews and diagrams, live while you view it. **Map** shows what each repository is being built into: the repositories on a ring (with **In flight**, only those the specs in flight name), each ringed by its milestones' status, the specs in flight at the centre, and each milestone between the two; with **Tickets** on, each milestone carries its tickets as dots in their status colour, an arrow running from a ticket to each one that depends on it. Click a hub or a spec to focus it, a milestone or a ticket to open it. **Notes** draws every note as a node and every `[[link]]` as an edge, clustered around repository hubs and the hexagons of `topic` notes; a node's shape gives its type, a dashed node is a note not written yet, a dotted one a draft only this machine holds, a faded one a superseded decision, and clicking a node opens it. Its slider shows the notes as they stood after any commit, and its **List** gives each note's status (a draft, a drafted change, superseded) and its last change, ordered by **Recent** or by **Name**. **Timeline** shows the drafts this machine has not shared yet, then the changes to the notes per week, from the brain's `timeline.json` (written by the first `/brain sync`), and each commit's changes; click a week to list only its commits.
   - After a browser restart, click **Reconnect** on the brain's card.

   Done when the user has the URL.
