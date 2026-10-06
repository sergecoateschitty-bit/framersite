import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs"
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist"
import type { PageRef, Rect, SearchMatch, SourceDoc } from "./types"
import { uid } from "./geometry"

export { pdfjs }

const CDN = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}`
/** Icons pdf.js uses for existing comment/note annotations. */
export const PDFJS_IMAGES = `${CDN}/web/images/`

let ready: Promise<void> | null = null

/**
 * Configure the pdf.js worker. The regular build ships the worker as a
 * separate file; the single-file build runs pdf.js' worker code on the main
 * thread so the page has no external dependencies at all.
 */
export function initPdfjs(): Promise<void> {
    if (!ready) {
        ready = (async () => {
            if (import.meta.env.MODE === "single") {
                const worker = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs")
                ;(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker
            } else {
                const { default: url } = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")
                pdfjs.GlobalWorkerOptions.workerSrc = url
            }
        })()
    }
    return ready
}

export async function openPdf(
    data: Uint8Array,
    name: string,
    askPassword: (retry: boolean) => Promise<string | null>,
): Promise<SourceDoc> {
    await initPdfjs()
    const task = pdfjs.getDocument({
        // pdf.js transfers the buffer to the worker; keep our own copy intact.
        data: data.slice(),
        cMapUrl: `${CDN}/cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `${CDN}/standard_fonts/`,
        wasmUrl: `${CDN}/wasm/`,
        enableXfa: false,
    })
    task.onPassword = async (update: (pw: string) => void, reason: number) => {
        const pw = await askPassword(reason === pdfjs.PasswordResponses.INCORRECT_PASSWORD)
        if (pw === null) task.destroy()
        else update(pw)
    }
    const proxy = await task.promise
    return { id: uid("src"), name, proxy, size: data.byteLength }
}

export async function pageRefsFor(src: SourceDoc): Promise<PageRef[]> {
    const refs: PageRef[] = []
    for (let i = 0; i < src.proxy.numPages; i++) {
        const page = await src.proxy.getPage(i + 1)
        refs.push({
            id: uid("pg"),
            srcId: src.id,
            srcIndex: i,
            view: page.view as Rect,
            baseRot: page.rotate,
            rot: 0,
        })
    }
    return refs
}

// ---------------------------------------------------------------------------
// Links inside the document (used by pdf.js' annotation layer)

export interface Navigator {
    goToPage(srcId: string, index: number): void
}

export class LinkService {
    externalLinkTarget = 2 // _blank
    externalLinkRel = "noopener noreferrer nofollow"
    externalLinkEnabled = true
    isInPresentationMode = false
    constructor(
        private doc: PDFDocumentProxy,
        private srcId: string,
        private nav: Navigator,
    ) {}
    get pagesCount() {
        return this.doc.numPages
    }
    get page() {
        return 1
    }
    set page(_v: number) {}
    get rotation() {
        return 0
    }
    set rotation(_v: number) {}
    async goToDestination(dest: unknown) {
        const index = await resolveDest(this.doc, dest)
        if (index !== null) this.nav.goToPage(this.srcId, index)
    }
    goToPage(n: number) {
        this.nav.goToPage(this.srcId, n - 1)
    }
    addLinkAttributes(link: HTMLAnchorElement, url: string, newWindow = false) {
        link.href = url
        link.target = newWindow || this.externalLinkTarget ? "_blank" : ""
        link.rel = this.externalLinkRel
        link.title = url
    }
    getDestinationHash() {
        return "#"
    }
    getAnchorUrl(hash: string) {
        return `#${hash}`
    }
    setHash() {}
    executeNamedAction(action: string) {
        if (action === "NextPage" || action === "PrevPage" || action === "FirstPage" || action === "LastPage") {
            window.dispatchEvent(new CustomEvent("pdf-named-action", { detail: action }))
        }
    }
    executeSetOCGState() {}
    getAttachmentContent() {
        return null
    }
}

export async function resolveDest(doc: PDFDocumentProxy, dest: unknown): Promise<number | null> {
    try {
        let explicit = dest
        if (typeof dest === "string") explicit = await doc.getDestination(dest)
        if (!Array.isArray(explicit)) return null
        const target = explicit[0]
        if (typeof target === "number") return target
        if (target && typeof target === "object") return await doc.getPageIndex(target)
    } catch {
        // Broken destinations are common; just ignore them.
    }
    return null
}

// ---------------------------------------------------------------------------
// Text extraction for search

interface PageText {
    text: string
    items: { start: number; end: number; x: number; y: number; w: number; h: number; angle: number }[]
}

const textCache = new WeakMap<PDFPageProxy, Promise<PageText>>()

export function getPageText(page: PDFPageProxy): Promise<PageText> {
    let p = textCache.get(page)
    if (!p) {
        p = page.getTextContent().then((tc) => {
            let text = ""
            const items: PageText["items"] = []
            for (const item of tc.items) {
                if (!("str" in item)) continue
                const [a, b, , , e, f] = item.transform as number[]
                const start = text.length
                text += item.str
                items.push({
                    start,
                    end: text.length,
                    x: e,
                    y: f,
                    w: item.width,
                    h: item.height || Math.hypot(a, b),
                    angle: Math.atan2(b, a),
                })
                if (item.hasEOL) text += "\n"
            }
            return { text, items }
        })
        textCache.set(page, p)
    }
    return p
}

export async function searchPages(
    pages: PageRef[],
    sources: Map<string, SourceDoc>,
    query: string,
    opts: { matchCase: boolean; wholeWord: boolean },
    signal: { cancelled: boolean },
): Promise<SearchMatch[]> {
    const out: SearchMatch[] = []
    if (!query.trim()) return out
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")
    const re = new RegExp(opts.wholeWord ? `\\b${escaped}\\b` : escaped, opts.matchCase ? "g" : "gi")
    for (const ref of pages) {
        if (signal.cancelled) return out
        if (!ref.srcId) continue
        const src = sources.get(ref.srcId)
        if (!src) continue
        const page = await src.proxy.getPage(ref.srcIndex + 1)
        const { text, items } = await getPageText(page)
        for (const m of text.matchAll(re)) {
            const s = m.index!
            const e = s + m[0].length
            const rects: Rect[] = []
            for (const it of items) {
                if (it.end <= s || it.start >= e) continue
                const len = Math.max(1, it.end - it.start)
                const from = (Math.max(s, it.start) - it.start) / len
                const to = (Math.min(e, it.end) - it.start) / len
                const cos = Math.cos(it.angle)
                const sin = Math.sin(it.angle)
                // Corners of the matched run, in the run's rotated frame.
                const pts = [
                    [from * it.w, -0.25 * it.h],
                    [to * it.w, -0.25 * it.h],
                    [from * it.w, 0.95 * it.h],
                    [to * it.w, 0.95 * it.h],
                ].map(([u, v]) => [it.x + u * cos - v * sin, it.y + u * sin + v * cos])
                rects.push([
                    Math.min(...pts.map((p) => p[0])),
                    Math.min(...pts.map((p) => p[1])),
                    Math.max(...pts.map((p) => p[0])),
                    Math.max(...pts.map((p) => p[1])),
                ])
            }
            if (rects.length) out.push({ pageId: ref.id, rects })
        }
    }
    return out
}
