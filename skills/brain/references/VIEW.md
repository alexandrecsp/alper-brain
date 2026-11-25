# View

The `view` branch of [`brain`](../SKILL.md): open the brain page, [brain.html](../brain.html), straight from this skill's folder. That folder's path changes with each plugin version, so this branch is how the user reaches the current page.

The brain page is served by a small local server at the plugin's root, which `server/main.mjs` starts or reuses. The Agent Watcher pane starts it with every session and it stays up, so this branch usually finds it running. When the server cannot start, the page opens by its `file:///` URL, which works as before.

1. **Start the server.** Run `node "<this skill's base directory>/../../server/main.mjs" --brain "<the active brain's path>"` and wait for it, at most about 5 seconds. Leave out `--brain` when no brain is open. The entry starts the server, or reuses the running one of this version, adds the brain to its list, prints one URL that opens that brain, and exits with code 0. Done when it printed a URL, or exited with a code other than 0, or the 5 seconds passed.

2. **Choose the URL.** When the entry exited with code 0 and printed a URL, that URL is the one. Otherwise take the `file:///` fallback: build the page's URL from this skill's base directory, `file:///` followed by the absolute path to `brain.html`, with forward slashes (`file:///C:/Users/<user>/.claude/plugins/cache/.../brain/brain.html`), and say why the server did not start: the entry's message (such as the port being held by another program), or that it printed no URL within 5 seconds. When the port is held, tell the user they can move the server to a free one with `{ "port": <n> }` in `~/.alper-brain/config.json`. Done when you hold the URL to open.

3. **Open it.** Open the URL with the OS's open command (`cmd /c start "" "<url>"` on Windows, `open` on macOS, `xdg-open` on Linux). Done when the command ran, or failed.

4. **Hand over.** Give the user the URL and the active brain's path, when one is open, and say:
   - From the server, the page works in any browser. Only the `file:///` fallback needs Chrome or Edge, asks for **Grant access** once per clone, and needs **Reconnect** after a browser restart: when the default browser is another one, paste the URL into Chrome or Edge.
   - To list another brain, click **Add brain** and give the path of its `.brain/` folder, or of the repository holding it. In the fallback, pick the same folder instead.
   - What needs Claude is a button that copies its command (`/build`, `/write-tickets`, `/brain sync`) to paste into Claude Code.

   Done when the user has the URL.
