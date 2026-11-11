# View

The `view` branch of [`brain`](../SKILL.md): open the brain page, [brain.html](../brain.html), straight from this skill's folder. That folder's path changes with each plugin version, so this branch is how the user reaches the current page.

1. **Open it.** Build the page's URL from this skill's base directory: `file:///` followed by the absolute path to `brain.html`, with forward slashes (`file:///C:/Users/<user>/.claude/plugins/cache/.../brain/brain.html`). Open it with the OS's open command (`cmd /c start "" "<url>"` on Windows, `open` on macOS, `xdg-open` on Linux). Done when the command ran, or failed.

2. **Hand over.** Give the user the URL and the active brain's path, when one is open, and say:
   - The page needs Chrome or Edge. When the default browser is another one, paste the URL into Chrome or Edge.
   - To list a brain, click **Add brain** and pick its folder, the one holding `BRAIN.md`. Each knowledge base is one brain on the list.
   - A brain has two views, live while you view it. Each has filters on the left and, on the right, the document you select (drag its edge to widen it, or press `E` to read it wide).
   - **Brain** draws every note as a dot and every `[[link]]` as a line, laid out by relevance: the most linked notes in the middle, the least linked at the rim. **Colour by** paints the dots by type, by layer or by repository. A ring is a draft only this machine holds, a faded dot a superseded decision, a grey speck a note not written yet. Hover a note to light its neighbours. Its **Timeline** mode shows the changes per week from the brain's `timeline.json` (written by the first `/brain sync`): pick a week or a commit, or press ▶, to see the graph as it stood, each change ringed in its action's colour.
   - **Specs** lays the specs in flight (or **All**) on a pipeline: a column per stage, from needing tickets to landed, a band per repository. Select a spec to unfold its milestones and tickets. Grey lines join a spec to its parts; arrows run from what must happen first to what waits on it, solid while it still blocks.
   - After a browser restart, click **Reconnect** on the brain's card.

   Done when the user has the URL.
