# View

The `view` branch of [`brain`](../SKILL.md): open the brain page, [brain.html](../brain.html), straight from this skill's folder. That folder's path changes with each plugin version, so this branch is how the user reaches the current page.

1. **Open it.** Build the page's URL from this skill's base directory: `file:///` followed by the absolute path to `brain.html`, with forward slashes (`file:///C:/Users/<user>/.claude/plugins/cache/.../brain/brain.html`). Open it with the OS's open command (`cmd /c start "" "<url>"` on Windows, `open` on macOS, `xdg-open` on Linux). Done when the command ran, or failed.

2. **Hand over.** Give the user the URL and the active brain's path, when one is open, and say:
   - The page needs Chrome or Edge. When the default browser is another one, paste the URL into Chrome or Edge.
   - To list a brain, click **Add brain** and pick its folder, the one holding `BRAIN.md`. Each knowledge base is one brain on the list.
   - A brain opens on four screens, live while you view it. The rail on the left switches screens and filters every one by repository; selecting anything opens its document in a panel over the screen (drag its edge to widen it, or press `E` to read it wide). Colour is status everywhere; a repository keeps its dot.
   - **Overview**: counts on top, a heatmap of every ticket grouped by spec, the specs as cards in dependency waves (or a table), what needs you, recent activity, and a card per repository. **In flight** shows every spec not landed or abandoned (or **To-do**, or **All**). Click a spec to open its page: its milestones as a pipeline, one lane per repository, with arrows for **Builds after**.
   - **Board**: the specs, or their milestones, as a kanban from **Needs tickets** to **Landed**.
   - **Notes graph**: every note as a square in its repository's box, every `[[link]]` as a line. A dashed square is a note not written yet; a dashed outline a draft only this machine holds. Hover a note to light its neighbours.
   - **Activity**: the brain's commits from its `timeline.json` (written by the first `/brain sync`), on a calendar and by day, and the drafts not shared yet.
   - After a browser restart, click **Reconnect** on the brain's card.

   Done when the user has the URL.
