# PDF Studio

A browser-based PDF viewer and editor modeled on Adobe Acrobat Reader.
Everything runs on your machine in the browser. Files are never uploaded.

Built with React and TypeScript. [pdf.js](https://github.com/mozilla/pdf.js)
renders pages, selectable text and forms, and
[pdf-lib](https://github.com/Hopding/pdf-lib) writes your edits back into a
standard PDF.

## Features

| Area | What you can do |
| --- | --- |
| **Viewing** | Continuous scrolling, single- or two-page view, zoom (fit width, fit page, presets, Ctrl + wheel), rotate the view, page thumbnails, bookmarks (outline), clickable links, document properties, light and dark themes |
| **Find** | Full-text search with highlighted matches, previous/next, match case, whole words |
| **Comment** | Highlight, underline and strikethrough on selected text (or drag a box on scanned pages), sticky notes, a comment thread on any markup, and a Comments panel with filtering |
| **Draw** | Freehand pen, rectangle, ellipse, line, arrow (hold Shift to constrain), with stroke color, fill, width and opacity |
| **Fill & Sign** | Fill AcroForm fields (text, checkbox, dropdown, …), add text anywhere (3 fonts, any size or color), drawn, typed or uploaded signatures (saved for reuse), images, stamps (Approved, Draft, Confidential, …), whiteout |
| **Edit** | Select, move and resize any annotation; nudge with the arrow keys; delete; unlimited undo/redo |
| **Organize pages** | Drag to reorder, rotate, delete, duplicate, insert blank pages, insert pages from another PDF (merge), extract selected pages to a new PDF |
| **Output** | Save/download a real PDF, or print |

### What ends up in the saved file

- Form values are written into the form fields, which stay fillable.
- Sticky notes, and comments attached to markup, are saved as real PDF
  comment (`/Text`) annotations. Acrobat, Preview and other viewers show them
  as comments.
- Highlights, drawings, shapes, text, signatures, images and stamps are drawn
  into the page content (flattened), so they look the same in every viewer.
  Text that the standard PDF fonts can't encode, such as CJK or emoji, is
  embedded as a high-resolution image.
- Page order, rotation, inserted and merged pages are applied. The original
  document's bookmarks, metadata and form are kept.

## Running it

```bash
cd pdf-editor
npm install
npm run dev          # http://localhost:5173
```

### Building

```bash
npm run build         # static site in dist/ (deploy to any static host)
npm run build:single  # ONE self-contained file: dist-single/index.html
```

The single-file build inlines all JavaScript, CSS and the pdf.js worker into
one HTML file (about 2.6 MB). You can open it straight from disk, email it,
or embed it, for example on a Framer site via an Embed or iframe.

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| Ctrl/⌘ O · S · P · F | Open · Save · Print · Find |
| Ctrl/⌘ Z / Shift Z (or Y) | Undo / Redo |
| Ctrl/⌘ + / − / 0 | Zoom in / out / fit width |
| ← → PgUp PgDn Home End | Page navigation |
| V H U T N D R O L A W | Select, Hand, Highlight, Text, Note, Draw, Rectangle, Ellipse, Line, Arrow, Whiteout |
| Delete · Esc | Delete the selection · back to Select |
| Arrow keys (with an annotation selected) | Nudge 1 pt (Shift: 10 pt) |

## Project layout

```
src/
  App.tsx                 app shell: toolbar, state, open/save/print, shortcuts
  store.ts                document state (pages + annotations) with undo/redo
  pdf.ts                  pdf.js setup, loading, link handling, text search
  export.ts               writes edits into a PDF with pdf-lib
  geometry.ts             viewport math and annotation geometry, shared by the
                          on-screen renderer and the exporter
  sample.ts               generates the built-in sample document
  components/
    Viewer.tsx            scrolling page list, lazy rendering, text-markup tools
    PageView.tsx          one page: canvas, text layer, form layer, annotation overlay
    AnnGraphics.tsx       SVG rendering of annotations
    Sidebar.tsx           thumbnails, bookmarks, comments
    OrganizeView.tsx      page organizer
    ToolOptions.tsx       contextual property bar (color, width, font…)
    Modals.tsx            signature, stamps, password, properties, shortcuts
```

Annotations are stored in PDF user-space coordinates, the same space
pdf-lib draws in. The on-screen overlay applies the same transform as
pdf.js' viewport, so what you see is what gets saved, including on rotated
pages.

## Limitations

- Editing the PDF's own text (Acrobat Pro's "Edit PDF") isn't supported.
  To change text, cover it with Whiteout and add new text on top.
- Whiteout covers content visually. It does **not** redact it: the
  original text is still in the file.
- Encrypted PDFs can be opened with their password, but can't be re-saved.
- XFA forms and form JavaScript are not supported.
