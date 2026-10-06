import type { Ann, FontKey, Pt, Rect, TextAnn } from "./types"

/** Affine matrix [a, b, c, d, e, f] mapping PDF user space to screen pixels. */
export type Matrix = [number, number, number, number, number, number]

export interface Viewport {
    m: Matrix
    inv: Matrix
    width: number
    height: number
    scale: number
    rotation: number
}

/** Same math as pdf.js' PageViewport, so overlays line up with the canvas. */
export function viewportFor(view: Rect, scale: number, rotation: number): Viewport {
    rotation = ((rotation % 360) + 360) % 360
    const cx = (view[2] + view[0]) / 2
    const cy = (view[3] + view[1]) / 2
    let a: number, b: number, c: number, d: number
    switch (rotation) {
        case 90:
            ;[a, b, c, d] = [0, 1, 1, 0]
            break
        case 180:
            ;[a, b, c, d] = [-1, 0, 0, 1]
            break
        case 270:
            ;[a, b, c, d] = [0, -1, -1, 0]
            break
        default:
            ;[a, b, c, d] = [1, 0, 0, -1]
    }
    let ox: number, oy: number, width: number, height: number
    if (a === 0) {
        ox = Math.abs(cy - view[1]) * scale
        oy = Math.abs(cx - view[0]) * scale
        width = (view[3] - view[1]) * scale
        height = (view[2] - view[0]) * scale
    } else {
        ox = Math.abs(cx - view[0]) * scale
        oy = Math.abs(cy - view[1]) * scale
        width = (view[2] - view[0]) * scale
        height = (view[3] - view[1]) * scale
    }
    const m: Matrix = [
        a * scale,
        b * scale,
        c * scale,
        d * scale,
        ox - a * scale * cx - c * scale * cy,
        oy - b * scale * cx - d * scale * cy,
    ]
    return { m, inv: invert(m), width, height, scale, rotation }
}

export function apply(m: Matrix, p: Pt): Pt {
    return [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]]
}

export function invert(m: Matrix): Matrix {
    const det = m[0] * m[3] - m[1] * m[2]
    return [
        m[3] / det,
        -m[1] / det,
        -m[2] / det,
        m[0] / det,
        (m[2] * m[5] - m[3] * m[4]) / det,
        (m[1] * m[4] - m[0] * m[5]) / det,
    ]
}

export function pageSize(view: Rect, rotation: number): [number, number] {
    const w = view[2] - view[0]
    const h = view[3] - view[1]
    return rotation % 180 === 0 ? [w, h] : [h, w]
}

/** Rotate a vector counter-clockwise by a multiple of 90 degrees. */
export function rotVec(rot: number, x: number, y: number): Pt {
    switch (((rot % 360) + 360) % 360) {
        case 90:
            return [-y, x]
        case 180:
            return [-x, -y]
        case 270:
            return [y, -x]
        default:
            return [x, y]
    }
}

/** Point offset from an upright item's anchor by (dx right, dy down) in local units. */
export function local(at: Pt, rot: number, dx: number, dyDown: number): Pt {
    const [vx, vy] = rotVec(rot, dx, -dyDown)
    return [at[0] + vx, at[1] + vy]
}

export function normRect(x0: number, y0: number, x1: number, y1: number): Rect {
    return [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)]
}

// ---------------------------------------------------------------------------
// Text metrics (shared by the on-screen renderer and the PDF exporter so the
// two produce the same layout).

export const LINE_HEIGHT = 1.2
export const ASCENT = 0.8
export const NOTE_SIZE = 22

export const FONT_CSS: Record<FontKey, string> = {
    helvetica: "Helvetica, Arial, 'Liberation Sans', sans-serif",
    times: "'Times New Roman', Times, 'Liberation Serif', serif",
    courier: "'Courier New', Courier, 'Liberation Mono', monospace",
}

let measureCtx: CanvasRenderingContext2D | null = null
export function measureText(text: string, font: FontKey, size: number): number {
    if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d")
    if (!measureCtx) return text.length * size * 0.5
    measureCtx.font = `100px ${FONT_CSS[font]}`
    return (measureCtx.measureText(text).width / 100) * size
}

export function textBox(a: TextAnn): { w: number; h: number; lines: string[] } {
    const lines = a.text.split("\n")
    const w = Math.max(a.fontSize * 0.6, ...lines.map((l) => measureText(l, a.font, a.fontSize)))
    return { w, h: lines.length * a.fontSize * LINE_HEIGHT, lines }
}

// ---------------------------------------------------------------------------
// Annotation geometry

/** Points whose bounding box encloses the annotation (PDF space). */
export function annCorners(a: Ann): Pt[] {
    switch (a.type) {
        case "highlight":
        case "underline":
        case "strikeout":
            return a.rects.flatMap((r): Pt[] => [
                [r[0], r[1]],
                [r[2], r[3]],
            ])
        case "ink": {
            const hw = a.width / 2
            return a.paths.flat().flatMap((p): Pt[] => [
                [p[0] - hw, p[1] - hw],
                [p[0] + hw, p[1] + hw],
            ])
        }
        case "rect":
        case "ellipse":
        case "whiteout":
            return [
                [a.x, a.y],
                [a.x + a.w, a.y + a.h],
            ]
        case "line":
        case "arrow":
            return [a.p1, a.p2]
        case "text": {
            const { w, h } = textBox(a)
            return boxCorners(a.at, a.rot, w, h)
        }
        case "note":
            return boxCorners(a.at, a.rot, NOTE_SIZE, NOTE_SIZE)
        case "image":
            return boxCorners(a.at, a.rot, a.w, a.h)
    }
}

function boxCorners(at: Pt, rot: number, w: number, h: number): Pt[] {
    return [local(at, rot, 0, 0), local(at, rot, w, 0), local(at, rot, 0, h), local(at, rot, w, h)]
}

export function bounds(points: Pt[]): Rect {
    let x0 = Infinity,
        y0 = Infinity,
        x1 = -Infinity,
        y1 = -Infinity
    for (const [x, y] of points) {
        x0 = Math.min(x0, x)
        y0 = Math.min(y0, y)
        x1 = Math.max(x1, x)
        y1 = Math.max(y1, y)
    }
    return [x0, y0, x1, y1]
}

/**
 * Map every point of an annotation through `f`. `k` is the uniform scale
 * applied to sizes that are not point-based (font size, image dimensions).
 */
export function mapAnn(a: Ann, f: (p: Pt) => Pt, k = 1): Ann {
    switch (a.type) {
        case "highlight":
        case "underline":
        case "strikeout":
            return {
                ...a,
                rects: a.rects.map((r) => {
                    const p = f([r[0], r[1]])
                    const q = f([r[2], r[3]])
                    return normRect(p[0], p[1], q[0], q[1])
                }),
            }
        case "ink":
            return { ...a, paths: a.paths.map((path) => path.map(f)) }
        case "rect":
        case "ellipse":
        case "whiteout": {
            const p = f([a.x, a.y])
            const q = f([a.x + a.w, a.y + a.h])
            const r = normRect(p[0], p[1], q[0], q[1])
            return { ...a, x: r[0], y: r[1], w: r[2] - r[0], h: r[3] - r[1] }
        }
        case "line":
        case "arrow":
            return { ...a, p1: f(a.p1), p2: f(a.p2) }
        case "text":
            return { ...a, at: f(a.at), fontSize: Math.max(4, a.fontSize * k) }
        case "note":
            return { ...a, at: f(a.at) }
        case "image":
            return { ...a, at: f(a.at), w: Math.max(4, a.w * k), h: Math.max(4, a.h * k) }
    }
}

export function translateAnn(a: Ann, dx: number, dy: number): Ann {
    return mapAnn(a, (p) => [p[0] + dx, p[1] + dy])
}

/** Merge client rects of a text selection into one rect per line fragment. */
export function mergeRects(rects: Rect[]): Rect[] {
    const sorted = [...rects]
        .filter((r) => r[2] - r[0] > 0.5 && r[3] - r[1] > 0.5)
        .sort((p, q) => q[3] - p[3] || p[0] - q[0])
    const out: Rect[] = []
    for (const r of sorted) {
        const last = out.find((o) => {
            const overlap = Math.min(o[3], r[3]) - Math.max(o[1], r[1])
            const minH = Math.min(o[3] - o[1], r[3] - r[1])
            const gap = Math.max(o[0], r[0]) - Math.min(o[2], r[2])
            return overlap > minH * 0.5 && gap < minH * 0.6
        })
        if (last) {
            last[0] = Math.min(last[0], r[0])
            last[1] = Math.min(last[1], r[1])
            last[2] = Math.max(last[2], r[2])
            last[3] = Math.max(last[3], r[3])
        } else out.push([...r])
    }
    return out
}

export function uid(prefix = "id"): string {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
}
