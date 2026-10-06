import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { EditorContext, type EditorCtx } from "./context"
import { downloadBytes, exportPdf } from "./export"
import { apply, invert, mapAnn, pageSize, viewportFor } from "./geometry"
import { LinkService, initPdfjs, openPdf, pageRefsFor, pdfjs, resolveDest, searchPages } from "./pdf"
import { makeSamplePdf } from "./sample"
import { useDocStore } from "./store"
import type { Ann, PendingImage, SearchMatch, SourceDoc, Tool, ToolStyle, ZoomMode } from "./types"
import { Icon } from "./components/Icons"
import { Modal, PasswordModal, PropertiesModal, STAMPS, ShortcutsModal, SignatureModal, imageFileToPending, makeStamp } from "./components/Modals"
import { OrganizeView } from "./components/OrganizeView"
import { Sidebar, type OutlineNode, type SidebarTab } from "./components/Sidebar"
import { ToolOptions } from "./components/ToolOptions"
import { Viewer, type ViewerHandle } from "./components/Viewer"

const DEFAULT_STYLE: ToolStyle = { color: "#dc2626", width: 2, opacity: 1, fill: null, fontSize: 14, font: "helvetica" }
const INITIAL_STYLES: Partial<Record<Tool, Partial<ToolStyle>>> = {
    highlight: { color: "#ffd400", opacity: 0.45 },
    underline: { color: "#16a34a" },
    strikeout: { color: "#dc2626" },
    ink: { color: "#1d4ed8", width: 2 },
    text: { color: "#111111", fontSize: 14 },
    note: { color: "#ffd400" },
}
const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4]
const PAGE_GAP = 16

const TOOL_GROUPS: { tool: Tool; icon: string; label: string; key?: string }[][] = [
    [
        { tool: "select", icon: "cursor", label: "Select", key: "V" },
        { tool: "hand", icon: "hand", label: "Hand", key: "H" },
    ],
    [
        { tool: "highlight", icon: "highlight", label: "Highlight text", key: "U" },
        { tool: "underline", icon: "underline", label: "Underline text" },
        { tool: "strikeout", icon: "strike", label: "Strikethrough text" },
    ],
    [
        { tool: "text", icon: "text", label: "Add text", key: "T" },
        { tool: "note", icon: "note", label: "Sticky note", key: "N" },
    ],
    [
        { tool: "ink", icon: "pen", label: "Draw", key: "D" },
        { tool: "rect", icon: "square", label: "Rectangle", key: "R" },
        { tool: "ellipse", icon: "circle", label: "Ellipse", key: "O" },
        { tool: "line", icon: "line", label: "Line", key: "L" },
        { tool: "arrow", icon: "arrow", label: "Arrow", key: "A" },
    ],
    [
        { tool: "whiteout", icon: "whiteout", label: "Whiteout", key: "W" },
        { tool: "signature", icon: "signature", label: "Sign" },
        { tool: "image", icon: "image", label: "Add image" },
        { tool: "stamp", icon: "stamp", label: "Stamp" },
    ],
]
const TOOL_KEYS: Record<string, Tool> = { v: "select", h: "hand", u: "highlight", t: "text", n: "note", d: "ink", r: "rect", o: "ellipse", l: "line", a: "arrow", w: "whiteout" }

function readPref(key: string): string | null {
    try {
        return localStorage.getItem(key)
    } catch {
        return null
    }
}
function writePref(key: string, value: string) {
    try {
        localStorage.setItem(key, value)
    } catch {
        // ignore
    }
}

export default function App() {
    const store = useDocStore()
    const { pages, annots } = store.state
    const [sources, setSources] = useState<Map<string, SourceDoc>>(new Map())
    const [fileName, setFileName] = useState("")
    const [tool, setToolState] = useState<Tool>("select")
    const [styles, setStyles] = useState<Partial<Record<Tool, ToolStyle>>>({})
    const [zoom, setZoom] = useState<ZoomMode>("fit-width")
    const [viewRot, setViewRot] = useState(0)
    const [twoPage, setTwoPage] = useState(false)
    const [current, setCurrent] = useState(0)
    const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 900)
    const [sidebarTab, setSidebarTab] = useState<SidebarTab>("pages")
    const [mode, setMode] = useState<"view" | "organize">("view")
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [openNoteId, setOpenNoteId] = useState<string | null>(null)
    const [pendingImage, setPendingImage] = useState<PendingImage | null>(null)
    const [outline, setOutline] = useState<OutlineNode[] | null>(null)
    const [searchOpen, setSearchOpen] = useState(false)
    const [query, setQuery] = useState("")
    const [matchCase, setMatchCase] = useState(false)
    const [wholeWord, setWholeWord] = useState(false)
    const [matches, setMatches] = useState<SearchMatch[]>([])
    const [matchIdx, setMatchIdx] = useState(0)
    const [searching, setSearching] = useState(false)
    const [modal, setModal] = useState<null | "signature" | "properties" | "shortcuts" | "stamps" | "about">(null)
    const [props, setProps] = useState<[string, string][]>([])
    const [password, setPassword] = useState<{ retry: boolean; resolve(pw: string | null): void } | null>(null)
    const [busy, setBusy] = useState<string | null>(null)
    const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null)
    const [theme, setTheme] = useState<"light" | "dark">(() =>
        (readPref("pdf-studio:theme") as "light" | "dark" | null) ??
        (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
    )
    const [dragOver, setDragOver] = useState(false)
    const [viewerSize, setViewerSize] = useState({ w: 800, h: 600 })
    const author = useMemo(() => readPref("pdf-studio:author") || "You", [])

    const viewer = useRef<ViewerHandle>(null)
    const viewerWrap = useRef<HTMLDivElement>(null)
    const fileInput = useRef<HTMLInputElement>(null)
    const insertInput = useRef<HTMLInputElement>(null)
    const imageInput = useRef<HTMLInputElement>(null)
    const insertAt = useRef(0)

    const hasDoc = pages.length > 0
    const sourceList = useMemo(() => [...sources.values()], [sources])
    const primary = sourceList[0]

    useEffect(() => {
        document.documentElement.dataset.theme = theme
        writePref("pdf-studio:theme", theme)
    }, [theme])

    useEffect(() => {
        void initPdfjs()
        const mq = window.matchMedia("(max-width: 760px)")
        const onChange = () => mq.matches && setSidebarOpen(false)
        mq.addEventListener("change", onChange)
        return () => mq.removeEventListener("change", onChange)
    }, [])

    const notify = useCallback((msg: string, error = false) => {
        setToast({ msg, error })
        window.setTimeout(() => setToast((t) => (t?.msg === msg ? null : t)), error ? 6000 : 2800)
    }, [])

    // ----- Layout / zoom -------------------------------------------------------
    useEffect(() => {
        const el = viewerWrap.current
        if (!el) return
        const ro = new ResizeObserver(([e]) => setViewerSize({ w: e.contentRect.width, h: e.contentRect.height }))
        ro.observe(el)
        return () => ro.disconnect()
    }, [hasDoc, mode])

    const refPage = pages[Math.min(current, pages.length - 1)] ?? pages[0]
    const scale = useMemo(() => {
        if (typeof zoom === "number") return zoom
        if (!refPage) return 1
        const [w, h] = pageSize(refPage.view, refPage.baseRot + refPage.rot + viewRot)
        let availW = viewerSize.w - PAGE_GAP * 2 - 18
        const availH = viewerSize.h - PAGE_GAP * 2 - 24
        if (twoPage) availW = (availW - PAGE_GAP) / 2
        const s = zoom === "fit-width" ? availW / w : Math.min(availW / w, availH / h)
        return Math.max(0.1, Math.min(8, s))
        // Only re-fit when the reference page's shape changes, not on every page turn.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [zoom, refPage?.view, refPage?.rot, refPage?.baseRot, viewRot, viewerSize, twoPage])

    const zoomTo = useCallback((s: number) => setZoom(Math.max(0.1, Math.min(8, Math.round(s * 100) / 100))), [])
    const scaleRef = useRef(scale)
    scaleRef.current = scale
    const zoomBy = useCallback((f: number) => zoomTo(scaleRef.current * f), [zoomTo])
    const zoomStep = (dir: 1 | -1) => {
        const s = scaleRef.current
        const next = dir > 0 ? ZOOM_PRESETS.find((z) => z > s + 0.01) : [...ZOOM_PRESETS].reverse().find((z) => z < s - 0.01)
        zoomTo(next ?? (dir > 0 ? s * 1.25 : s / 1.25))
    }

    // ----- Tools ----------------------------------------------------------------
    const setTool = useCallback((t: Tool) => {
        setToolState(t)
        if (t !== "select") {
            setSelectedId(null)
            setOpenNoteId(null)
        }
        window.getSelection()?.removeAllRanges()
    }, [])

    const style: ToolStyle = styles[tool] ?? { ...DEFAULT_STYLE, ...INITIAL_STYLES[tool] }
    const selected = annots.find((a) => a.id === selectedId) ?? null

    const chooseTool = (t: Tool) => {
        if (t === "signature") return setModal("signature")
        if (t === "image") return imageInput.current?.click()
        if (t === "stamp") return setModal("stamps")
        setTool(t)
    }

    const deleteSelected = useCallback(() => {
        if (!selectedId) return
        store.commit((s) => ({ ...s, annots: s.annots.filter((a) => a.id !== selectedId) }))
        setSelectedId(null)
        setOpenNoteId(null)
    }, [selectedId, store])

    // ----- Opening documents ---------------------------------------------------
    const askPassword = useCallback(
        (retry: boolean) => new Promise<string | null>((resolve) => setPassword({ retry, resolve })),
        [],
    )

    const loadDocument = useCallback(
        async (bytes: Uint8Array, name: string) => {
            setBusy("Opening…")
            try {
                const src = await openPdf(bytes, name, askPassword)
                const refs = await pageRefsFor(src)
                for (const s of sources.values()) void s.proxy.loadingTask.destroy()
                setSources(new Map([[src.id, src]]))
                store.reset({ pages: refs, annots: [] })
                setFileName(name)
                setCurrent(0)
                setSelectedId(null)
                setEditingId(null)
                setOpenNoteId(null)
                setMatches([])
                setQuery("")
                setMode("view")
                setViewRot(0)
                setZoom("fit-width")
                setOutline(null)
                src.proxy
                    .getOutline()
                    .then((o) => setOutline((o ?? []) as unknown as OutlineNode[]))
                    .catch(() => setOutline([]))
                requestAnimationFrame(() => viewer.current?.element()?.scrollTo({ top: 0 }))
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                if (!/destroyed|cancel/i.test(msg)) notify(`Couldn't open this file: ${msg}`, true)
            } finally {
                setBusy(null)
                setPassword(null)
            }
        },
        [askPassword, notify, sources, store],
    )

    const confirmDiscard = useCallback(
        () => !store.dirty || window.confirm("You have unsaved changes. Discard them and open another file?"),
        [store.dirty],
    )

    const openFile = useCallback(
        async (file: File) => {
            if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) {
                notify("Please choose a PDF file.", true)
                return
            }
            if (!confirmDiscard()) return
            await loadDocument(new Uint8Array(await file.arrayBuffer()), file.name)
        },
        [confirmDiscard, loadDocument, notify],
    )

    const openSample = async () => {
        if (!confirmDiscard()) return
        await loadDocument(await makeSamplePdf(), "sample.pdf")
    }

    const insertFile = async (file: File, at: number) => {
        setBusy("Inserting pages…")
        try {
            const src = await openPdf(new Uint8Array(await file.arrayBuffer()), file.name, askPassword)
            const refs = await pageRefsFor(src)
            setSources((m) => new Map(m).set(src.id, src))
            store.commit((s) => ({ ...s, pages: [...s.pages.slice(0, at), ...refs, ...s.pages.slice(at)] }))
            notify(`Inserted ${refs.length} page${refs.length === 1 ? "" : "s"} from ${file.name}`)
        } catch (err) {
            notify(`Couldn't insert that file: ${err instanceof Error ? err.message : err}`, true)
        } finally {
            setBusy(null)
            setPassword(null)
        }
    }

    // ----- Saving / printing ---------------------------------------------------
    const baseName = fileName.replace(/\.pdf$/i, "") || "document"

    const save = useCallback(async () => {
        if (!hasDoc) return
        setBusy("Saving…")
        try {
            const bytes = await exportPdf(store.state, sourceList)
            downloadBytes(bytes, `${baseName}.pdf`)
            notify("Saved — your PDF has been downloaded.")
        } catch (err) {
            console.error(err)
            const msg = err instanceof Error ? err.message : String(err)
            notify(
                /encrypt/i.test(msg)
                    ? "This PDF is encrypted, so it can't be re-saved in the browser."
                    : `Couldn't save: ${msg}`,
                true,
            )
        } finally {
            setBusy(null)
        }
    }, [hasDoc, store.state, sourceList, baseName, notify])

    const extract = async (ids: Set<string>) => {
        setBusy("Extracting…")
        try {
            const bytes = await exportPdf(store.state, sourceList, { onlyPages: ids })
            downloadBytes(bytes, `${baseName}-pages.pdf`)
        } catch (err) {
            notify(`Couldn't extract pages: ${err instanceof Error ? err.message : err}`, true)
        } finally {
            setBusy(null)
        }
    }

    const print = useCallback(async () => {
        if (!hasDoc) return
        setBusy("Preparing to print…")
        const root = document.getElementById("print-root")!
        try {
            const bytes = await exportPdf(store.state, sourceList)
            await initPdfjs()
            const doc = await pdfjs.getDocument({ data: bytes }).promise
            root.replaceChildren()
            for (let i = 1; i <= doc.numPages; i++) {
                const page = await doc.getPage(i)
                const viewport = page.getViewport({ scale: 2 })
                const canvas = document.createElement("canvas")
                canvas.width = viewport.width
                canvas.height = viewport.height
                await page.render({ canvas, viewport, intent: "print", annotationMode: pdfjs.AnnotationMode.ENABLE_STORAGE }).promise
                const img = document.createElement("img")
                img.src = canvas.toDataURL("image/jpeg", 0.92)
                const wrap = document.createElement("div")
                wrap.className = "print-page"
                wrap.append(img)
                root.append(wrap)
            }
            await doc.loadingTask.destroy()
            setBusy(null)
            await new Promise((r) => setTimeout(r, 50))
            window.print()
        } catch (err) {
            notify(`Couldn't print: ${err instanceof Error ? err.message : err}`, true)
        } finally {
            setBusy(null)
            window.setTimeout(() => root.replaceChildren(), 1000)
        }
    }, [hasDoc, store.state, sourceList, notify])

    const showProperties = async () => {
        if (!primary) return
        const meta = await primary.proxy.getMetadata().catch(() => null)
        const info = (meta?.info ?? {}) as Record<string, unknown>
        const date = (v: unknown) => {
            const d = typeof v === "string" ? pdfjs.PDFDateString.toDateObject(v) : null
            return d ? d.toLocaleString() : ""
        }
        const p = pages[0]
        const [w, h] = p ? pageSize(p.view, p.baseRot + p.rot) : [0, 0]
        setProps([
            ["File name", fileName],
            ["Title", String(info.Title ?? "")],
            ["Author", String(info.Author ?? "")],
            ["Subject", String(info.Subject ?? "")],
            ["Keywords", String(info.Keywords ?? "")],
            ["Creator", String(info.Creator ?? "")],
            ["Producer", String(info.Producer ?? "")],
            ["Created", date(info.CreationDate)],
            ["Modified", date(info.ModDate)],
            ["PDF version", String(info.PDFFormatVersion ?? "")],
            ["Pages", String(pages.length)],
            ["Page size", p ? `${(w / 72).toFixed(2)} × ${(h / 72).toFixed(2)} in (${Math.round(w)} × ${Math.round(h)} pt)` : ""],
            ["File size", formatBytes(primary.size)],
            ["Annotations added", String(annots.length)],
            ["Fillable form", info.IsAcroFormPresent ? "Yes" : "No"],
        ])
        setModal("properties")
    }

    // ----- Navigation ------------------------------------------------------------
    const goto = useCallback(
        (i: number) => {
            if (!pages.length) return
            const idx = Math.max(0, Math.min(pages.length - 1, i))
            setCurrent(idx)
            viewer.current?.scrollToPage(idx)
        },
        [pages.length],
    )

    const gotoSource = useCallback(
        (srcId: string, index: number) => {
            const i = pages.findIndex((p) => p.srcId === srcId && p.srcIndex === index)
            if (i >= 0) {
                if (mode !== "view") setMode("view")
                requestAnimationFrame(() => goto(i))
            }
        },
        [pages, goto, mode],
    )
    const gotoSourceRef = useRef(gotoSource)
    gotoSourceRef.current = gotoSource

    const linkServices = useMemo(() => {
        const m = new Map<string, LinkService>()
        for (const s of sources.values())
            m.set(s.id, new LinkService(s.proxy, s.id, { goToPage: (id, idx) => gotoSourceRef.current(id, idx) }))
        return m
    }, [sources])

    useEffect(() => {
        const onNamed = (e: Event) => {
            const action = (e as CustomEvent<string>).detail
            if (action === "NextPage") goto(current + 1)
            else if (action === "PrevPage") goto(current - 1)
            else if (action === "FirstPage") goto(0)
            else if (action === "LastPage") goto(pages.length - 1)
        }
        window.addEventListener("pdf-named-action", onNamed)
        return () => window.removeEventListener("pdf-named-action", onNamed)
    }, [goto, current, pages.length])

    const onOutline = async (node: OutlineNode) => {
        if (node.url) {
            window.open(node.url, "_blank", "noopener")
            return
        }
        if (!primary) return
        const idx = await resolveDest(primary.proxy, node.dest)
        if (idx !== null) gotoSource(primary.id, idx)
    }

    const selectAnn = (a: Ann) => {
        setTool("select")
        setSelectedId(a.id)
        const i = pages.findIndex((p) => p.id === a.pageId)
        if (i >= 0) goto(i)
    }

    // ----- Search ----------------------------------------------------------------
    useEffect(() => {
        if (!searchOpen || !query.trim()) {
            setMatches([])
            setSearching(false)
            return
        }
        const signal = { cancelled: false }
        setSearching(true)
        const t = window.setTimeout(async () => {
            const found = await searchPages(pages, sources, query, { matchCase, wholeWord }, signal)
            if (signal.cancelled) return
            setMatches(found)
            setSearching(false)
            const firstAfter = found.findIndex((m) => pages.findIndex((p) => p.id === m.pageId) >= current)
            setMatchIdx(Math.max(0, firstAfter))
        }, 220)
        return () => {
            signal.cancelled = true
            window.clearTimeout(t)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, matchCase, wholeWord, searchOpen, pages, sources])

    useEffect(() => {
        const m = matches[matchIdx]
        if (!m) return
        const i = pages.findIndex((p) => p.id === m.pageId)
        if (i >= 0) viewer.current?.scrollToPage(i, { pageId: m.pageId, rect: m.rects[0] })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [matchIdx, matches])

    const stepMatch = (d: number) => {
        if (!matches.length) return
        setMatchIdx((i) => (i + d + matches.length) % matches.length)
    }
    const searchInput = useRef<HTMLInputElement>(null)
    const openSearch = () => {
        setSearchOpen(true)
        const sel = window.getSelection()?.toString().trim()
        if (sel && sel.length < 80) setQuery(sel)
        requestAnimationFrame(() => searchInput.current?.select())
    }

    // ----- Keyboard shortcuts -----------------------------------------------------
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const mod = e.ctrlKey || e.metaKey
            const target = e.target as HTMLElement
            const typing = target.closest("input, textarea, select, [contenteditable=true], .annotationLayer")
            const k = e.key.toLowerCase()
            if (mod && k === "o") {
                e.preventDefault()
                fileInput.current?.click()
                return
            }
            if (!hasDoc) return
            if (mod && k === "s") {
                e.preventDefault()
                void save()
                return
            }
            if (mod && k === "p") {
                e.preventDefault()
                void print()
                return
            }
            if (mod && k === "f") {
                e.preventDefault()
                openSearch()
                return
            }
            if (typing) return
            if (mod && k === "z") {
                e.preventDefault()
                if (e.shiftKey) store.redo()
                else store.undo()
                return
            }
            if (mod && k === "y") {
                e.preventDefault()
                store.redo()
                return
            }
            if (mod && (k === "=" || k === "+")) {
                e.preventDefault()
                zoomStep(1)
                return
            }
            if (mod && k === "-") {
                e.preventDefault()
                zoomStep(-1)
                return
            }
            if (mod && k === "0") {
                e.preventDefault()
                setZoom("fit-width")
                return
            }
            if (mod) return
            if ((k === "delete" || k === "backspace") && selectedId) {
                e.preventDefault()
                deleteSelected()
                return
            }
            if (k === "escape") {
                if (openNoteId) setOpenNoteId(null)
                else if (selectedId) setSelectedId(null)
                else if (tool !== "select") setTool("select")
                else if (searchOpen) setSearchOpen(false)
                return
            }
            if (selectedId && k.startsWith("arrow")) {
                const a = annots.find((x) => x.id === selectedId)
                const pg = a && pages.find((p) => p.id === a.pageId)
                if (a && pg) {
                    e.preventDefault()
                    const step = e.shiftKey ? 10 : 1
                    const [sx, sy] = k === "arrowleft" ? [-step, 0] : k === "arrowright" ? [step, 0] : k === "arrowup" ? [0, -step] : [0, step]
                    const inv = invert(viewportFor(pg.view, 1, pg.baseRot + pg.rot + viewRot).m)
                    const o = apply(inv, [0, 0])
                    const v = apply(inv, [sx, sy])
                    const dx = v[0] - o[0]
                    const dy = v[1] - o[1]
                    store.commit((s) => ({
                        ...s,
                        annots: s.annots.map((x) => (x.id === a.id ? mapAnn(x, (p) => [p[0] + dx, p[1] + dy]) : x)),
                    }))
                }
                return
            }
            if (mode === "view") {
                if (k === "arrowright" || k === "pagedown") {
                    if (k === "arrowright" || !viewerScrollable()) {
                        e.preventDefault()
                        goto(current + 1)
                    }
                    return
                }
                if (k === "arrowleft" || k === "pageup") {
                    if (k === "arrowleft" || !viewerScrollable()) {
                        e.preventDefault()
                        goto(current - 1)
                    }
                    return
                }
                if (k === "home") {
                    e.preventDefault()
                    goto(0)
                    return
                }
                if (k === "end") {
                    e.preventDefault()
                    goto(pages.length - 1)
                    return
                }
                const t = TOOL_KEYS[k]
                if (t && !e.altKey) setTool(t)
            }
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    })

    const viewerScrollable = () => {
        const el = viewer.current?.element()
        return !!el && el.scrollHeight > el.clientHeight + 4
    }

    // Warn before leaving with unsaved changes.
    useEffect(() => {
        if (!store.dirty) return
        const onBefore = (e: BeforeUnloadEvent) => {
            e.preventDefault()
            e.returnValue = ""
        }
        window.addEventListener("beforeunload", onBefore)
        return () => window.removeEventListener("beforeunload", onBefore)
    }, [store.dirty])

    // Drag & drop a PDF anywhere.
    useEffect(() => {
        let depth = 0
        const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes("Files")
        const enter = (e: DragEvent) => {
            if (!hasFiles(e)) return
            depth++
            setDragOver(true)
        }
        const leave = (e: DragEvent) => {
            if (!hasFiles(e)) return
            depth = Math.max(0, depth - 1)
            if (!depth) setDragOver(false)
        }
        const over = (e: DragEvent) => hasFiles(e) && e.preventDefault()
        const drop = (e: DragEvent) => {
            if (!hasFiles(e)) return
            e.preventDefault()
            depth = 0
            setDragOver(false)
            const file = e.dataTransfer?.files?.[0]
            if (file) void openFile(file)
        }
        window.addEventListener("dragenter", enter)
        window.addEventListener("dragleave", leave)
        window.addEventListener("dragover", over)
        window.addEventListener("drop", drop)
        return () => {
            window.removeEventListener("dragenter", enter)
            window.removeEventListener("dragleave", leave)
            window.removeEventListener("dragover", over)
            window.removeEventListener("drop", drop)
        }
    }, [openFile])

    // Drop a selection that points at a deleted annotation (e.g. after undo).
    useEffect(() => {
        if (selectedId && !annots.some((a) => a.id === selectedId)) setSelectedId(null)
        if (openNoteId && !annots.some((a) => a.id === openNoteId)) setOpenNoteId(null)
        if (editingId && !annots.some((a) => a.id === editingId)) setEditingId(null)
    }, [annots, selectedId, openNoteId, editingId])

    const ctx: EditorCtx = {
        store,
        sources,
        linkServices,
        tool,
        setTool,
        style,
        scale,
        viewRot,
        author,
        selectedId,
        setSelectedId,
        editingId,
        setEditingId,
        openNoteId,
        setOpenNoteId,
        pendingImage,
        setPendingImage,
        search: { matches, current: matchIdx },
    }

    const updateStyle = (patch: Partial<ToolStyle>) => {
        const key = selected ? (selected.type as Tool) : tool
        setStyles((s) => ({ ...s, [key]: { ...(s[key] ?? { ...DEFAULT_STYLE, ...INITIAL_STYLES[key] }), ...patch } }))
    }

    const rotatePage = (id: string, delta: number) =>
        store.commit((s) => ({ ...s, pages: s.pages.map((p) => (p.id === id ? { ...p, rot: (p.rot + delta + 360) % 360 } : p)) }))
    const deletePage = (id: string) =>
        store.commit((s) => ({ pages: s.pages.filter((p) => p.id !== id), annots: s.annots.filter((a) => a.pageId !== id) }))

    const zoomLabel = `${Math.round(scale * 100)}%`

    return (
        <EditorContext.Provider value={ctx}>
            <div className="app">
                <header className="topbar">
                    <div className="brand" title="PDF Studio">
                        <span className="logo">
                            <Icon name="file" size={16} />
                        </span>
                        <span className="brand-name">PDF Studio</span>
                    </div>
                    <div className="tb-group">
                        <button className="icon-btn" title="Open (Ctrl+O)" onClick={() => fileInput.current?.click()}>
                            <Icon name="open" />
                        </button>
                        <button className="icon-btn" title="Save (Ctrl+S)" disabled={!hasDoc} onClick={save}>
                            <Icon name="download" />
                        </button>
                        <button className="icon-btn" title="Print (Ctrl+P)" disabled={!hasDoc} onClick={print}>
                            <Icon name="print" />
                        </button>
                    </div>
                    {hasDoc && (
                        <>
                            <span className="divider" />
                            <div className="tb-group">
                                <button className="icon-btn" title="Undo (Ctrl+Z)" disabled={!store.canUndo} onClick={store.undo}>
                                    <Icon name="undo" />
                                </button>
                                <button className="icon-btn" title="Redo (Ctrl+Shift+Z)" disabled={!store.canRedo} onClick={store.redo}>
                                    <Icon name="redo" />
                                </button>
                            </div>
                            <span className="divider hide-sm" />
                            <div className="tb-group page-nav hide-sm">
                                <button className="icon-btn" title="Previous page" disabled={current <= 0} onClick={() => goto(current - 1)}>
                                    <Icon name="chevronUp" />
                                </button>
                                <PageInput current={current} total={pages.length} onGo={goto} />
                                <button className="icon-btn" title="Next page" disabled={current >= pages.length - 1} onClick={() => goto(current + 1)}>
                                    <Icon name="chevronDown" />
                                </button>
                            </div>
                            <span className="divider" />
                            <div className="tb-group">
                                <button className="icon-btn" title="Zoom out (Ctrl+−)" onClick={() => zoomStep(-1)}>
                                    <Icon name="zoomOut" />
                                </button>
                                <select
                                    className="select zoom-select"
                                    value={typeof zoom === "number" ? "custom" : zoom}
                                    onChange={(e) => {
                                        const v = e.target.value
                                        if (v === "fit-width" || v === "fit-page") setZoom(v)
                                        else if (v !== "custom") zoomTo(Number(v))
                                    }}
                                    aria-label="Zoom"
                                >
                                    <option value="custom" hidden>
                                        {zoomLabel}
                                    </option>
                                    <option value="fit-width">Fit width ({zoom === "fit-width" ? zoomLabel : "…"})</option>
                                    <option value="fit-page">Fit page ({zoom === "fit-page" ? zoomLabel : "…"})</option>
                                    {ZOOM_PRESETS.map((z) => (
                                        <option key={z} value={z}>
                                            {Math.round(z * 100)}%
                                        </option>
                                    ))}
                                </select>
                                <button className="icon-btn" title="Zoom in (Ctrl++)" onClick={() => zoomStep(1)}>
                                    <Icon name="zoomIn" />
                                </button>
                            </div>
                            <span className="divider hide-sm" />
                            <div className="tb-group hide-sm">
                                <button className="icon-btn" title="Rotate view counter-clockwise" onClick={() => setViewRot((r) => (r + 270) % 360)}>
                                    <Icon name="rotateCcw" />
                                </button>
                                <button className="icon-btn" title="Rotate view clockwise" onClick={() => setViewRot((r) => (r + 90) % 360)}>
                                    <Icon name="rotateCw" />
                                </button>
                                <button
                                    className={`icon-btn${twoPage ? " active" : ""}`}
                                    title={twoPage ? "Single page view" : "Two page view"}
                                    onClick={() => setTwoPage((v) => !v)}
                                >
                                    <Icon name={twoPage ? "onePage" : "twoPage"} />
                                </button>
                            </div>
                        </>
                    )}
                    <div className="spacer" />
                    {hasDoc && (
                        <div className="file-title" title={fileName}>
                            {fileName}
                            {store.dirty && <span className="dirty-dot" title="Unsaved changes" />}
                        </div>
                    )}
                    <div className="spacer" />
                    {hasDoc && (
                        <div className="tb-group">
                            <button
                                className={`btn ghost${mode === "organize" ? " active" : ""}`}
                                onClick={() => setMode(mode === "organize" ? "view" : "organize")}
                                title="Organize pages"
                            >
                                <Icon name="pages" size={16} />
                                <span className="hide-sm">Organize</span>
                            </button>
                            <button className={`icon-btn${searchOpen ? " active" : ""}`} title="Find (Ctrl+F)" onClick={() => (searchOpen ? setSearchOpen(false) : openSearch())}>
                                <Icon name="search" />
                            </button>
                            <button className="icon-btn hide-sm" title="Document properties" onClick={showProperties}>
                                <Icon name="info" />
                            </button>
                        </div>
                    )}
                    <button className="icon-btn hide-sm" title="Keyboard shortcuts" onClick={() => setModal("shortcuts")}>
                        <Icon name="help" />
                    </button>
                    <button
                        className="icon-btn"
                        title={theme === "dark" ? "Light mode" : "Dark mode"}
                        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    >
                        <Icon name={theme === "dark" ? "sun" : "moon"} />
                    </button>
                    {hasDoc && (
                        <button className="btn primary save-btn" onClick={save} disabled={!!busy}>
                            <Icon name="save" size={16} />
                            <span className="hide-sm">Save</span>
                        </button>
                    )}
                </header>

                {!hasDoc ? (
                    <Welcome onOpen={() => fileInput.current?.click()} onSample={openSample} />
                ) : mode === "organize" ? (
                    <OrganizeView
                        pages={pages}
                        annots={annots}
                        onOpenPage={(i) => {
                            setMode("view")
                            requestAnimationFrame(() => goto(i))
                        }}
                        onInsertFile={(at) => {
                            insertAt.current = at
                            insertInput.current?.click()
                        }}
                        onExtract={extract}
                        onClose={() => setMode("view")}
                    />
                ) : (
                    <div className="workspace">
                        <nav className="tool-rail" aria-label="Tools">
                            <button
                                className={`icon-btn${sidebarOpen ? " active" : ""}`}
                                title="Toggle sidebar"
                                onClick={() => setSidebarOpen((v) => !v)}
                            >
                                <Icon name="sidebar" />
                            </button>
                            {TOOL_GROUPS.map((group, gi) => (
                                <div className="rail-group" key={gi}>
                                    {group.map((t) => (
                                        <button
                                            key={t.tool}
                                            className={`icon-btn tool${tool === t.tool ? " active" : ""}`}
                                            title={t.key ? `${t.label} (${t.key})` : t.label}
                                            aria-pressed={tool === t.tool}
                                            onClick={() => chooseTool(t.tool)}
                                        >
                                            <Icon name={t.icon} />
                                        </button>
                                    ))}
                                </div>
                            ))}
                        </nav>
                        {sidebarOpen && (
                            <Sidebar
                                tab={sidebarTab}
                                setTab={setSidebarTab}
                                pages={pages}
                                annots={annots}
                                current={current}
                                outline={outline}
                                onGoto={(i) => {
                                    goto(i)
                                    if (window.innerWidth <= 760) setSidebarOpen(false)
                                }}
                                onOutline={onOutline}
                                onSelectAnn={selectAnn}
                                onRotatePage={rotatePage}
                                onDeletePage={deletePage}
                            />
                        )}
                        <main className="center">
                            <ToolOptions style={style} onStyle={updateStyle} selected={selected} onDeleteSelected={deleteSelected} />
                            {searchOpen && (
                                <div className="search-bar" onKeyDown={(e) => e.stopPropagation()}>
                                    <Icon name="search" size={16} />
                                    <input
                                        ref={searchInput}
                                        className="input"
                                        placeholder="Find in document"
                                        value={query}
                                        autoFocus
                                        onChange={(e) => setQuery(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") stepMatch(e.shiftKey ? -1 : 1)
                                            if (e.key === "Escape") setSearchOpen(false)
                                        }}
                                    />
                                    <span className="search-count">
                                        {searching ? "…" : query ? (matches.length ? `${matchIdx + 1} / ${matches.length}` : "No results") : ""}
                                    </span>
                                    <button className="icon-btn small" title="Previous (Shift+Enter)" disabled={!matches.length} onClick={() => stepMatch(-1)}>
                                        <Icon name="chevronUp" size={16} />
                                    </button>
                                    <button className="icon-btn small" title="Next (Enter)" disabled={!matches.length} onClick={() => stepMatch(1)}>
                                        <Icon name="chevronDown" size={16} />
                                    </button>
                                    <button className={`toggle${matchCase ? " active" : ""}`} title="Match case" onClick={() => setMatchCase((v) => !v)}>
                                        Aa
                                    </button>
                                    <button className={`toggle${wholeWord ? " active" : ""}`} title="Whole words" onClick={() => setWholeWord((v) => !v)}>
                                        <u>ab</u>
                                    </button>
                                    <button className="icon-btn small" title="Close" onClick={() => setSearchOpen(false)}>
                                        <Icon name="close" size={16} />
                                    </button>
                                </div>
                            )}
                            <div className="viewer-wrap" ref={viewerWrap}>
                                <Viewer
                                    ref={viewer}
                                    pages={pages}
                                    annots={annots}
                                    twoPage={twoPage}
                                    onCurrentPage={setCurrent}
                                    onZoomBy={zoomBy}
                                />
                            </div>
                        </main>
                    </div>
                )}

                <input
                    ref={fileInput}
                    type="file"
                    accept="application/pdf,.pdf"
                    hidden
                    onChange={(e) => {
                        const f = e.target.files?.[0]
                        e.target.value = ""
                        if (f) void openFile(f)
                    }}
                />
                <input
                    ref={insertInput}
                    type="file"
                    accept="application/pdf,.pdf"
                    hidden
                    onChange={(e) => {
                        const f = e.target.files?.[0]
                        e.target.value = ""
                        if (f) void insertFile(f, insertAt.current)
                    }}
                />
                <input
                    ref={imageInput}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={async (e) => {
                        const f = e.target.files?.[0]
                        e.target.value = ""
                        if (!f) return
                        try {
                            setPendingImage(await imageFileToPending(f))
                            setTool("image")
                        } catch (err) {
                            notify(err instanceof Error ? err.message : String(err), true)
                        }
                    }}
                />

                {modal === "signature" && (
                    <SignatureModal
                        onClose={() => setModal(null)}
                        onDone={(p) => {
                            setPendingImage(p)
                            setModal(null)
                            setTool("signature")
                        }}
                    />
                )}
                {modal === "stamps" && (
                    <Modal title="Choose a stamp" onClose={() => setModal(null)}>
                        <div className="stamp-grid">
                            {STAMPS.map((s) => {
                                const p = makeStamp(s.label, s.color)
                                return (
                                    <button
                                        key={s.label}
                                        className="stamp-choice"
                                        onClick={() => {
                                            setPendingImage(p)
                                            setModal(null)
                                            setTool("stamp")
                                        }}
                                    >
                                        <img src={p.src} alt={s.label} />
                                    </button>
                                )
                            })}
                        </div>
                    </Modal>
                )}
                {modal === "properties" && <PropertiesModal rows={props} onClose={() => setModal(null)} />}
                {modal === "shortcuts" && <ShortcutsModal onClose={() => setModal(null)} />}
                {password && (
                    <PasswordModal
                        retry={password.retry}
                        onSubmit={(pw) => {
                            password.resolve(pw)
                            setPassword(null)
                        }}
                    />
                )}
                {busy && (
                    <div className="busy">
                        <div className="spinner" /> {busy}
                    </div>
                )}
                {toast && <div className={`toast${toast.error ? " error" : ""}`}>{toast.msg}</div>}
                {dragOver && (
                    <div className="drop-overlay">
                        <div>
                            <Icon name="open" size={40} />
                            <p>Drop a PDF to open it</p>
                        </div>
                    </div>
                )}
            </div>
        </EditorContext.Provider>
    )
}

function PageInput({ current, total, onGo }: { current: number; total: number; onGo(i: number): void }) {
    const [value, setValue] = useState(String(current + 1))
    useEffect(() => setValue(String(current + 1)), [current])
    return (
        <span className="page-input">
            <input
                className="input"
                value={value}
                inputMode="numeric"
                aria-label="Page number"
                onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        const n = parseInt(value, 10)
                        if (n >= 1) onGo(Math.min(total, n) - 1)
                        ;(e.target as HTMLInputElement).blur()
                    }
                }}
                onBlur={() => setValue(String(current + 1))}
            />
            <span className="muted">/ {total}</span>
        </span>
    )
}

function Welcome({ onOpen, onSample }: { onOpen(): void; onSample(): void }) {
    const features: [string, string, string][] = [
        ["highlight", "Comment & mark up", "Highlight, underline, strike through, sticky notes"],
        ["pen", "Draw & annotate", "Freehand ink, shapes, lines and arrows"],
        ["text", "Fill & sign", "Fill forms, add text anywhere, sign with a drawn or typed signature"],
        ["pages", "Organize pages", "Reorder, rotate, delete, insert, merge and extract pages"],
        ["search", "Find & navigate", "Full-text search, bookmarks, thumbnails, zoom and rotate"],
        ["save", "Save a real PDF", "Your edits are written into a standard PDF that opens anywhere"],
    ]
    return (
        <div className="welcome">
            <div className="welcome-card">
                <div className="welcome-icon">
                    <Icon name="file" size={34} />
                </div>
                <h1>Open a PDF to get started</h1>
                <p className="muted">View, annotate, fill, sign and organize PDF files — right in your browser. Files never leave your device.</p>
                <div className="welcome-actions">
                    <button className="btn primary big" onClick={onOpen}>
                        <Icon name="open" size={18} /> Choose a PDF
                    </button>
                    <button className="btn big" onClick={onSample}>
                        Try a sample document
                    </button>
                </div>
                <p className="muted small">or drag and drop a file anywhere on this page</p>
            </div>
            <div className="features">
                {features.map(([icon, title, text]) => (
                    <div className="feature" key={title}>
                        <Icon name={icon} size={20} />
                        <div>
                            <strong>{title}</strong>
                            <span>{text}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

function formatBytes(n: number) {
    if (n < 1024) return `${n} B`
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
    return `${(n / 1024 / 1024).toFixed(2)} MB`
}

