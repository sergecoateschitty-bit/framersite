import {
    BlendMode,
    LineCapStyle,
    PDFDocument,
    PDFFont,
    PDFHexString,
    PDFImage,
    PDFName,
    PDFPage,
    PDFString,
    StandardFonts,
    degrees,
    rgb,
    type Color,
} from "pdf-lib"
import { ASCENT, FONT_CSS, LINE_HEIGHT, NOTE_SIZE, annCorners, bounds, local, textBox } from "./geometry"
import type { Ann, DocState, FontKey, PageRef, Pt, SourceDoc, TextAnn } from "./types"

function color(hex: string): Color {
    const h = hex.replace("#", "")
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0")
    const n = parseInt(full.slice(0, 6), 16)
    return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

function colorArray(hex: string): number[] {
    const c = color(hex) as unknown as { red: number; green: number; blue: number }
    return [c.red, c.green, c.blue]
}

async function sourceBytes(src: SourceDoc): Promise<Uint8Array> {
    // saveDocument() writes filled-in form values; plain getData() otherwise.
    if (src.proxy.annotationStorage.size > 0) return src.proxy.saveDocument()
    return src.proxy.getData()
}

function dataUrlBytes(url: string): { bytes: Uint8Array; png: boolean } {
    const [head, body] = url.split(",")
    const bin = atob(body)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return { bytes, png: head.includes("png") }
}

/** Render text the standard PDF fonts can't encode (e.g. CJK, emoji) to a PNG. */
function rasterizeText(a: TextAnn): string {
    const { w, h, lines } = textBox(a)
    const k = 4
    const canvas = document.createElement("canvas")
    canvas.width = Math.ceil(w * k) + 2
    canvas.height = Math.ceil(h * k) + 2
    const ctx = canvas.getContext("2d")!
    ctx.scale(k, k)
    ctx.fillStyle = a.color
    ctx.font = `${a.fontSize}px ${FONT_CSS[a.font]}`
    ctx.textBaseline = "alphabetic"
    lines.forEach((line, i) => ctx.fillText(line, 0, a.fontSize * (ASCENT + LINE_HEIGHT * i)))
    return canvas.toDataURL("image/png")
}

function canEncode(font: PDFFont, text: string): boolean {
    try {
        font.encodeText(text)
        return true
    } catch {
        return false
    }
}

class Painter {
    private fonts = new Map<FontKey, PDFFont>()
    private images = new Map<string, PDFImage>()
    constructor(private doc: PDFDocument) {}

    async font(key: FontKey) {
        let f = this.fonts.get(key)
        if (!f) {
            const std = { helvetica: StandardFonts.Helvetica, times: StandardFonts.TimesRoman, courier: StandardFonts.Courier }
            f = await this.doc.embedFont(std[key])
            this.fonts.set(key, f)
        }
        return f
    }

    async image(src: string) {
        let img = this.images.get(src)
        if (!img) {
            const { bytes, png } = dataUrlBytes(src)
            img = png ? await this.doc.embedPng(bytes) : await this.doc.embedJpg(bytes)
            this.images.set(src, img)
        }
        return img
    }

    addPopupNote(page: PDFPage, at: Pt, rot: number, text: string, author: string, hex: string, created: number) {
        const [x0, y0, x1, y1] = bounds([local(at, rot, 0, 0), local(at, rot, NOTE_SIZE, NOTE_SIZE)])
        const ctx = this.doc.context
        const annot = ctx.obj({
            Type: "Annot",
            Subtype: "Text",
            Rect: [x0, y0, x1, y1],
            Contents: PDFHexString.fromText(text),
            T: PDFHexString.fromText(author),
            Name: "Comment",
            C: colorArray(hex),
            F: 4 | 8 | 16, // Print, NoZoom, NoRotate
            M: PDFString.fromDate(new Date(created)),
            Open: false,
        })
        annot.set(PDFName.of("P"), page.ref)
        page.node.addAnnot(ctx.register(annot))
    }

    async draw(page: PDFPage, a: Ann) {
        switch (a.type) {
            case "highlight":
                for (const r of a.rects) {
                    page.drawRectangle({
                        x: r[0],
                        y: r[1],
                        width: r[2] - r[0],
                        height: r[3] - r[1],
                        color: color(a.color),
                        opacity: a.opacity,
                        blendMode: BlendMode.Multiply,
                    })
                }
                break
            case "underline":
            case "strikeout":
                for (const r of a.rects) {
                    const h = r[3] - r[1]
                    const y = a.type === "underline" ? r[1] + h * 0.1 : r[1] + h * 0.45
                    page.drawLine({
                        start: { x: r[0], y },
                        end: { x: r[2], y },
                        thickness: Math.max(0.75, h * 0.07),
                        color: color(a.color),
                        opacity: a.opacity,
                    })
                }
                break
            case "ink":
                for (const path of a.paths) {
                    if (!path.length) continue
                    const pts = path.length === 1 ? [path[0], [path[0][0] + 0.01, path[0][1]] as Pt] : path
                    const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0]} ${-p[1]}`).join(" ")
                    page.drawSvgPath(d, {
                        x: 0,
                        y: 0,
                        borderColor: color(a.color),
                        borderWidth: a.width,
                        borderOpacity: a.opacity,
                        borderLineCap: LineCapStyle.Round,
                    })
                }
                break
            case "rect":
            case "whiteout":
                page.drawRectangle({
                    x: a.x,
                    y: a.y,
                    width: a.w,
                    height: a.h,
                    ...(a.type === "whiteout"
                        ? { color: color(a.fill ?? "#ffffff") }
                        : {
                              borderColor: color(a.color),
                              borderWidth: a.width,
                              borderOpacity: a.opacity,
                              ...(a.fill ? { color: color(a.fill), opacity: a.opacity } : {}),
                          }),
                })
                break
            case "ellipse":
                page.drawEllipse({
                    x: a.x + a.w / 2,
                    y: a.y + a.h / 2,
                    xScale: a.w / 2,
                    yScale: a.h / 2,
                    borderColor: color(a.color),
                    borderWidth: a.width,
                    borderOpacity: a.opacity,
                    ...(a.fill ? { color: color(a.fill), opacity: a.opacity } : {}),
                })
                break
            case "line":
            case "arrow": {
                const { shaft, head } = arrowGeometry(a.p1, a.p2, a.width, a.type === "arrow")
                page.drawLine({
                    start: { x: a.p1[0], y: a.p1[1] },
                    end: { x: shaft[0], y: shaft[1] },
                    thickness: a.width,
                    color: color(a.color),
                    opacity: a.opacity,
                    lineCap: LineCapStyle.Round,
                })
                if (head) {
                    const d = head.map((p, i) => `${i ? "L" : "M"}${p[0]} ${-p[1]}`).join(" ") + " Z"
                    page.drawSvgPath(d, { x: 0, y: 0, color: color(a.color), opacity: a.opacity })
                }
                break
            }
            case "text": {
                if (!a.text.trim()) break
                const font = await this.font(a.font)
                if (!canEncode(font, a.text.replace(/\n/g, ""))) {
                    const { w, h } = textBox(a)
                    const img = await this.image(rasterizeText(a))
                    const [x, y] = local(a.at, a.rot, 0, h)
                    page.drawImage(img, { x, y, width: w, height: h, rotate: degrees(a.rot) })
                    break
                }
                a.text.split("\n").forEach((line, i) => {
                    const [x, y] = local(a.at, a.rot, 0, a.fontSize * (ASCENT + LINE_HEIGHT * i))
                    page.drawText(line, {
                        x,
                        y,
                        size: a.fontSize,
                        font,
                        color: color(a.color),
                        rotate: degrees(a.rot),
                    })
                })
                break
            }
            case "note":
                this.addPopupNote(page, a.at, a.rot, a.text, a.author, a.color, a.created)
                break
            case "image": {
                const img = await this.image(a.src)
                const [x, y] = local(a.at, a.rot, 0, a.h)
                page.drawImage(img, { x, y, width: a.w, height: a.h, rotate: degrees(a.rot) })
                break
            }
        }
        // Comments attached to markups / shapes become popup notes in the file.
        if (a.comment && a.type !== "note") {
            const [x0, , , y1] = bounds(annCorners(a))
            this.addPopupNote(page, [x0, y1 + NOTE_SIZE], 0, a.comment, a.author, "#f5c518", a.created)
        }
    }
}

/** Shaft end and arrow head polygon for a line from p1 to p2. */
export function arrowGeometry(p1: Pt, p2: Pt, width: number, arrow: boolean): { shaft: Pt; head: Pt[] | null } {
    if (!arrow) return { shaft: p2, head: null }
    const dx = p2[0] - p1[0]
    const dy = p2[1] - p1[1]
    const len = Math.hypot(dx, dy) || 1
    const ux = dx / len
    const uy = dy / len
    const size = Math.min(len, Math.max(8, width * 4))
    const base: Pt = [p2[0] - ux * size, p2[1] - uy * size]
    const half = size * 0.45
    return {
        shaft: [p2[0] - ux * size * 0.6, p2[1] - uy * size * 0.6],
        head: [p2, [base[0] - uy * half, base[1] + ux * half], [base[0] + uy * half, base[1] - ux * half]],
    }
}

export interface ExportOptions {
    title?: string
    /** When set, only these page ids are exported (in document order). */
    onlyPages?: Set<string>
}

export async function exportPdf(
    state: DocState,
    sources: SourceDoc[],
    opts: ExportOptions = {},
): Promise<Uint8Array> {
    const pages = opts.onlyPages ? state.pages.filter((p) => opts.onlyPages!.has(p.id)) : state.pages
    if (!pages.length) throw new Error("There are no pages to save.")

    // Use the first opened document as the base so its form fields,
    // outline, metadata and other document-level structures survive.
    const base = sources[0]
    const out = base
        ? await PDFDocument.load(await sourceBytes(base), { updateMetadata: false })
        : await PDFDocument.create()
    const originalPages = out.getPages()
    const loaded = new Map<string, PDFDocument>()
    const used = new Set<number>()
    const painter = new Painter(out)
    const byPage = new Map<string, Ann[]>()
    for (const a of state.annots) {
        const list = byPage.get(a.pageId)
        if (list) list.push(a)
        else byPage.set(a.pageId, [a])
    }

    const getPage = async (ref: PageRef): Promise<PDFPage> => {
        if (!ref.srcId) {
            const page = PDFPage.create(out)
            const [x0, y0, x1, y1] = ref.view
            page.setMediaBox(x0, y0, x1 - x0, y1 - y0)
            return page
        }
        if (base && ref.srcId === base.id && !used.has(ref.srcIndex)) {
            used.add(ref.srcIndex)
            return originalPages[ref.srcIndex]
        }
        // Duplicated base pages are copied from a pristine copy of the base
        // file so they don't pick up markup already drawn on the original.
        let doc = loaded.get(ref.srcId)
        if (!doc) {
            const src = sources.find((s) => s.id === ref.srcId)
            if (!src) throw new Error("A source document is missing.")
            doc = await PDFDocument.load(await sourceBytes(src), { updateMetadata: false })
            loaded.set(ref.srcId, doc)
        }
        const [copy] = await out.copyPages(doc, [ref.srcIndex])
        return copy
    }

    const finalPages: PDFPage[] = []
    for (const ref of pages) {
        const page = await getPage(ref)
        page.setRotation(degrees((((ref.baseRot + ref.rot) % 360) + 360) % 360))
        for (const a of byPage.get(ref.id) ?? []) await painter.draw(page, a)
        finalPages.push(page)
    }

    while (out.getPageCount() > 0) out.removePage(0)
    for (const page of finalPages) out.addPage(page)

    if (opts.title) out.setTitle(opts.title)
    out.setModificationDate(new Date())
    out.setProducer("PDF Studio (pdf-lib)")
    return out.save()
}

export function downloadBytes(bytes: Uint8Array, filename: string) {
    const blob = new Blob([bytes as BlobPart], { type: "application/pdf" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
