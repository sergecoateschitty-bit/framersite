import type { PDFDocumentProxy } from "pdfjs-dist"

export type Pt = [number, number]
/** [x0, y0, x1, y1] in PDF user space (y up). */
export type Rect = [number, number, number, number]

export type Tool =
    | "select"
    | "hand"
    | "highlight"
    | "underline"
    | "strikeout"
    | "ink"
    | "text"
    | "note"
    | "rect"
    | "ellipse"
    | "line"
    | "arrow"
    | "whiteout"
    | "signature"
    | "image"
    | "stamp"

export type FontKey = "helvetica" | "times" | "courier"

interface AnnBase {
    id: string
    pageId: string
    created: number
    author: string
    /** Optional reply/comment text shown in the Comments panel. */
    comment?: string
}

export interface MarkupAnn extends AnnBase {
    type: "highlight" | "underline" | "strikeout"
    rects: Rect[]
    color: string
    opacity: number
    /** The text that was selected when the markup was created. */
    text?: string
}

export interface InkAnn extends AnnBase {
    type: "ink"
    paths: Pt[][]
    color: string
    width: number
    opacity: number
}

export interface ShapeAnn extends AnnBase {
    type: "rect" | "ellipse" | "whiteout"
    /** Bottom-left corner in PDF space. */
    x: number
    y: number
    w: number
    h: number
    color: string
    width: number
    fill: string | null
    opacity: number
}

export interface LineAnn extends AnnBase {
    type: "line" | "arrow"
    p1: Pt
    p2: Pt
    color: string
    width: number
    opacity: number
}

/**
 * Items placed "upright" relative to how the page was displayed when they
 * were created. `at` is the visual top-left corner (PDF space) and `rot` is
 * the counter-clockwise rotation (0/90/180/270) applied in PDF space.
 */
export interface TextAnn extends AnnBase {
    type: "text"
    at: Pt
    rot: number
    text: string
    fontSize: number
    font: FontKey
    color: string
}

export interface NoteAnn extends AnnBase {
    type: "note"
    at: Pt
    rot: number
    text: string
    color: string
}

export interface ImageAnn extends AnnBase {
    type: "image"
    at: Pt
    rot: number
    w: number
    h: number
    /** PNG or JPEG data URL. */
    src: string
    kind: "image" | "signature" | "stamp"
    label?: string
}

export type Ann = MarkupAnn | InkAnn | ShapeAnn | LineAnn | TextAnn | NoteAnn | ImageAnn
export type AnnType = Ann["type"]

export interface PageRef {
    id: string
    /** Source document id, or null for an inserted blank page. */
    srcId: string | null
    /** Zero-based page index inside the source document. */
    srcIndex: number
    /** Page view box (crop box) in PDF user space. */
    view: Rect
    /** The page's own /Rotate value. */
    baseRot: number
    /** Extra rotation applied by the user (saved into the file). */
    rot: number
}

export interface DocState {
    pages: PageRef[]
    annots: Ann[]
}

export interface SourceDoc {
    id: string
    name: string
    proxy: PDFDocumentProxy
    size: number
}

export interface ToolStyle {
    color: string
    width: number
    opacity: number
    fill: string | null
    fontSize: number
    font: FontKey
}

export interface PendingImage {
    src: string
    w: number
    h: number
    kind: ImageAnn["kind"]
    label?: string
}

export interface SearchMatch {
    pageId: string
    rects: Rect[]
}

export type ZoomMode = "fit-width" | "fit-page" | number
