# Multi-Column Text Box (Framer code component)

A Framer code component for long-form copy that reflows into columns and
stays readable as you resize the layer — no manual breakpoints needed.

**File:** [`components/MultiColumnTextBox.tsx`](components/MultiColumnTextBox.tsx)

## How it's responsive when scaled

- **Column count adapts to width.** In "Auto" mode it uses CSS
  `column-width`, so the browser fits as many columns as the box is wide
  enough for — resize the layer and columns are added or removed on their
  own. "Fixed Count" mode is available when you want an exact number of
  columns regardless of size.
- **Font size scales with the box, not the viewport.** A `ResizeObserver`
  measures the component's own rendered width and, when "Fluid Type" is on,
  scales the font size proportionally between a Min and Max bound (relative
  to a "Reference Width"). A hero-sized instance and a sidebar-sized
  instance of the same component both look proportioned correctly.
- **Paragraphs flow like print.** Content is split on blank lines into
  `<p>` tags with `break-inside: avoid`, `column-fill: auto`, and optional
  hyphenation, so text reads top-to-bottom within a column before
  continuing in the next one — like a newspaper or magazine layout.

## Using it in Framer

1. In a Framer project, open the **Assets** panel → **Code** → **New Code
   File**, and paste in the contents of `components/MultiColumnTextBox.tsx`
   (or connect this repo via Framer's GitHub code sync, if enabled on your
   plan).
2. Drag the component from the Assets panel onto the canvas.
3. Resize the layer — the column count and (optionally) type size will
   adjust live in the canvas preview.
4. Configure copy and styling in the **Properties** panel:
   - **Content** — the text (blank line = new paragraph)
   - **Font / Color / Align**
   - **Fluid Type** — toggle proportional font scaling, plus its
     Reference Width / Min / Max bounds
   - **Columns** — Auto (responsive `column-width`) or Fixed Count
   - **Column Gap / Divider** — spacing and an optional rule between
     columns
   - **Padding / Hyphenate / Overflow**

## Local type-checking

```bash
npm install
npm run typecheck
```

This only checks types against the `framer` package's type definitions —
the component itself only runs inside Framer (or any React host that
provides the same `framer` runtime exports).
