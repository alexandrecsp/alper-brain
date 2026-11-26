---
name: html
description: Render any output as an HTML page kept in the brain and opened locally. Use when the user asks for something as HTML, a page or a visual report.
argument-hint: "[what to show]"
metadata:
  type: process
---

Turn what the user asked for (findings, an audit, a comparison, a plan) into one **page**: a self-contained HTML file in the active brain, built on the [report theme](../brain/references/THEME.md). A tour, refactor candidates and a logic prototype have pages of their own, written by `/brain tour`, `/refactor` and `/prototype`: when the ask is one of those, tell the user to run it, and stop. This skill gives a page to every other output.

The page lives in the brain, by [FORMAT.md](../brain/references/FORMAT.md); when no brain is open, follow FORMAT.md's **The open session**. It is also published elsewhere, such as a hosted page or a shared doc, only when the user asks to share it; the brain's copy stays.

## Process

1. **Do the work.** When the user asks for work and its page together ("audit the auth flow, as HTML"), do the work first, by whatever skill it calls for: the page shows a result. Done when every fact the page will show is in hand, each with its **source**: a file, a command's output, a note, a URL.

2. **Place it.** A page on one linked repository goes to `repos/<slug>/pages/<YYYY-MM-DD-HHmm>-<topic>.html`, its slug as `repos/repos.json` names it; any other page to `pages/<YYYY-MM-DD-HHmm>-<topic>.html`, `<topic>` the subject in at most five kebab-case words. Done when you can name the path.

3. **Lay it out.** Fill the theme's scaffold, its **Report name** the subject in a few words, by the content's shape:

   - **Hero**, always: its headline the answer in one sentence; stat tiles for what the content counts, none when it counts nothing; a **Start here** row when one item matters most; a legend row naming each card colour's meaning when the page has cards.
   - **Cards**, for a set of items read one at a time (findings, options, endpoints): one card each, coloured by status.
   - **Tables**, for items compared field by field: one row each, headers in `.eyebrow`.
   - **Diagrams**, for structure or flow: a Mermaid `flowchart` or `sequenceDiagram` on a diagram canvas, drawn by [DIAGRAMS.md](../write-spec/references/DIAGRAMS.md)'s smallest-view rule.

   Lead every section with its answer, in the terms of the repository's glossary when it has one. Done when every fact from step 1 has its place beside its source.

4. **Hand over** by [THEME.md](../brain/references/THEME.md)'s **Hand-over**. Done when the file sits at step 2's path, stamped when it is in a repository's folder, and the user has its absolute path.
