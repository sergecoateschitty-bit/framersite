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

---

# Scroll Snap (Framer code component)

A scrolling container that snaps section-by-section, with a custom
scrollbar — for presentations, product showcases and full-screen
one-page sites.

**File:** [`components/ScrollSnap.tsx`](components/ScrollSnap.tsx)

## How it works

- Connect any number of layers to **Sections**. Each one is stretched to
  the full size of the component, so you control the size of the
  container (set it to fill the viewport for a full-screen experience).
- Scrolling inside the component snaps to the next / previous section
  (native CSS scroll snap, so touch devices get momentum snapping).
- **One Per Scroll** takes over the mouse wheel / trackpad so a single
  flick moves exactly one section, with an eased transition of
  configurable **Duration**. At the first/last section the page keeps
  scrolling normally.
- A custom **scrollbar** (native one hidden) shows your position:
  adjustable color, track color, width, inset, radius and side.
- **Keyboard**: Arrow keys, Page Up/Down, Space, Home/End.
- **Direction**: vertical (default) or horizontal.
- **Align**: where each section settles when it snaps — Top / Center /
  Bottom when vertical, Left / Center / Right when horizontal. Use it with
  **Section Size** (% of the container) below 100% and an optional
  **Gap** so neighbouring sections peek in; every section, including the
  first and last, can reach the chosen alignment.
- **Content Width / Content Height**: size of the layer *inside* each
  section, with the same options as a layer in a Framer auto layout:
  **Fixed** (px), **Relative** (% of the section), **Fill** (the whole
  section) or **Fit Content** (the layer keeps its own size). Position it
  with **Content X** (Left / Center / Right) and **Content Y** (Top /
  Center / Bottom). E.g. a full-width, 100vh component with a Relative
  60% × 70% image centered in each section.
- **Padding**: space inside each section around its content (all sides
  or per side, like a frame's padding). Fill and Relative sizes are
  measured inside the padding.

## Using it in Framer

1. Assets → Code → New Code File, paste `components/ScrollSnap.tsx`.
2. Drag **Scroll Snap** onto the canvas and size it (e.g. 100vw × 100vh).
3. Design each section as its own frame (off-canvas is fine), then add
   them to **Sections** in the properties panel.
4. Preview — scrolling only snaps in Preview / on the published site.
