# Report theme

The look shared by every HTML report a skill writes into `.sdd/`, the brain page's ([brain.html](../brain.html)): neutral grey surfaces, dark only, **sharp edges** (no rounded corners), **light headers** (weight 300), mono uppercase eyebrows, and colour that means something (a status, a strength, a leak), never decoration. This file holds the reports' components; when it and the brain page disagree, the page wins.

A report is one self-contained file. Tailwind, the fonts and Mermaid come from CDNs; everything else is inline and static. The report's own reference fills each `{{slot}}` below, and names colours by the tokens in the scaffold's `:root`.

## Scaffold

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{report name}} · {{repo name}}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com/3.4.16"></script>
<script type="module">
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs";
  mermaid.initialize({ startOnLoad: true, theme: "dark", themeVariables: { fontFamily: "Inter, sans-serif" } });
</script>
<style>
  :root {
    --bg: #141414; --rail: #181818; --panel: #1c1c1c; --panel-2: #222222; --line: #2d2d2d; --line-2: #3a3a3a;
    --text: #e8e8e8; --muted: #9b9b9b; --faint: #6a6a6a;
    --green: #34d399; --amber: #fbbf24; --red: #f87171; --sky: #38bdf8; --violet: #a78bfa; --grey: #6a6a6a;
  }
  html, body { background: var(--bg); color: var(--text); }
  body { font-family: Inter, ui-sans-serif, system-ui, sans-serif; font-size: 13.5px; -webkit-font-smoothing: antialiased; }
  body *, body *::before, body *::after { border-radius: 0 !important; }
  .mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
  .eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
  .h { font-weight: 300; letter-spacing: -.01em; }
  .muted { color: var(--muted); } .faint { color: var(--faint); }
  .panel { background: var(--panel); border: 1px solid var(--line); }
  .panel-2 { background: var(--panel-2); border: 1px solid var(--line); }
  .edge { box-shadow: inset 0 2px 0 var(--c, var(--line-2)); }
  .chip { display: inline-flex; align-items: center; gap: 5px; padding: 1px 7px; font-size: 11px; background: var(--panel-2); border: 1px solid var(--line); font-family: 'JetBrains Mono', monospace; }
  .pill { display: inline-flex; padding: 2px 8px; font-size: 11px; font-weight: 500; background: color-mix(in srgb, var(--c) 16%, transparent); color: color-mix(in srgb, var(--c) 80%, white); }
  .dots { background-image: radial-gradient(#262626 1px, transparent 1px); background-size: 18px 18px; }
  a { color: var(--text); border-bottom: 1px dotted var(--muted); }
  ::-webkit-scrollbar { width: 8px; height: 8px; } ::-webkit-scrollbar-thumb { background: #2f2f2f; } ::-webkit-scrollbar-track { background: transparent; }
  {{the report's own classes}}
</style>
</head>
<body>
  <header class="sticky top-0 z-20 border-b" style="border-color:var(--line);background:var(--rail)">
    <div class="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 text-[13px]">
      <span class="flex items-center gap-2 font-medium"><span class="grid h-7 w-7 place-items-center text-xs font-semibold" style="background:#2a2a2a">B</span>Brain</span>
      <span class="faint">/</span><span class="muted">{{report name}}</span>
      <nav class="mono ml-auto hidden gap-3 text-xs sm:flex">{{one anchor per section or item}}</nav>
    </div>
  </header>
  <main class="mx-auto max-w-7xl space-y-10 px-4 py-6">
    <section id="hero">...</section>
    {{the report's sections}}
  </main>
</body>
</html>
```

Surfaces, text and borders take the tokens, never a raw hex: `.panel` for a card, `.panel-2` for what sits inside one, `.muted` and `.faint` for secondary text, `var(--line)` for every border.

## Hero

A hero panel, `panel p-6 sm:p-8`. Inside, in order:

- **Eyebrow**: repo name and date, in `.eyebrow`.
- **Headline**: `h text-3xl`, with one `.muted` line under it.
- **Stat tiles**: a `dl` grid of `panel-2 px-4 py-3` tiles, label in `.eyebrow`, value `h text-2xl tabular-nums`; a tile that counts a coloured class takes that colour on its value (`style="color:var(--green)"`).
- **Rows**: below a `border-t` divider (`border-color:var(--line)`), the report's own rows, each under an `.eyebrow` label.

## Card

One `<article>` per item, built like the brain page's brain card: `panel edge p-6`, its top edge in the colour the report names (`style="--c:var(--green)"`). Its parts:

- **Meta row**: `.chip`s, and a `.pill` pushed right (`ml-auto`, `style="--c:var(--amber)"`).
- **Title**: `h text-xl`, a leading handle in `mono faint`.
- **Files**: a `mono text-xs muted` list.
- **Checks**: bullets marked with a green square tick, `✓` in `var(--green)`.
- **Callout**: one line in an amber box, `border px-3 py-2` with `border-color:color-mix(in srgb, var(--amber) 40%, transparent);background:color-mix(in srgb, var(--amber) 8%, transparent)`.

## Diagrams

A diagram sits on a canvas, `dots panel-2`, under an `.eyebrow` label. A hand-built diagram draws:

- **Module**: `border px-3 py-2` on `var(--panel)`, border `var(--line-2)`.
- **Arrow**: inline SVG with `stroke-width="1.5"` in `var(--muted)`, and a filled arrowhead marker.

Label modules inside diagrams in `.eyebrow`, so they read as schematic rather than UI.
