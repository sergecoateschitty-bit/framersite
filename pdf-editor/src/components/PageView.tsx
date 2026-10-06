import { memo, useEffect, useMemo, useRef, useState } from "react"
import type { RenderTask } from "pdfjs-dist"
import { MARKUP_TOOLS, useEditor } from "../context"
import { apply, annCorners, bounds, local, mapAnn, normRect, uid, viewportFor, type Viewport } from "../geometry"
import { PDFJS_IMAGES, pdfjs } from "../pdf"
import type { Ann, ImageAnn, NoteAnn, PageRef, Pt, TextAnn } from "../types"
import { AnnGraphic, MarkupGraphic, isMarkup } from "./AnnGraphics"
import { Icon } from "./Icons"

const MAX_CANVAS_PIXELS = 16_777_216

interface Props {
    page: PageRef
    index: number
    annots: Ann[]
    visible: boolean
}

type Gesture =
    | { kind: "draw"; start: Pt }
    | { kind: "move"; id: string; start: Pt; moved: boolean }
    | { kind: "resize"; id: string; tl: Pt; br: Pt; locked: boolean }

export const PageView = memo(function PageView({ page, index, annots, visible }: Props) {
    const ed = useEditor()
    const rotation = (page.baseRot + page.rot + ed.viewRot) % 360
    const vp = useMemo(() => viewportFor(page.view, ed.scale, rotation), [page.view, ed.scale, rotation])
    const canvasHost = useRef<HTMLDivElement>(null)
    const textRef = useRef<HTMLDivElement>(null)
    const formRef = useRef<HTMLDivElement>(null)
    const svgRef = useRef<SVGSVGElement>(null)
    const gesture = useRef<Gesture | null>(null)
    const [draft, setDraft] = useState<Ann | null>(null)
    const [rendered, setRendered] = useState(false)
    const src = page.srcId ? ed.sources.get(page.srcId) : undefined

    // --- Render the PDF page (canvas, text layer, form/link layer) ----------
    useEffect(() => {
        if (!visible) return
        const host = canvasHost.current
        if (!host) return
        if (!src) {
            host.innerHTML = ""
            setRendered(true)
            return
        }
        let cancelled = false
        let task: RenderTask | null = null
        let textLayer: InstanceType<typeof pdfjs.TextLayer> | null = null
        ;(async () => {
            const pdfPage = await src.proxy.getPage(page.srcIndex + 1)
            if (cancelled) return
            const viewport = pdfPage.getViewport({ scale: ed.scale, rotation })
            let outputScale = window.devicePixelRatio || 1
            const pixels = viewport.width * viewport.height * outputScale * outputScale
            if (pixels > MAX_CANVAS_PIXELS) outputScale = Math.sqrt(MAX_CANVAS_PIXELS / (viewport.width * viewport.height))
            const canvas = document.createElement("canvas")
            canvas.width = Math.floor(viewport.width * outputScale)
            canvas.height = Math.floor(viewport.height * outputScale)
            canvas.style.width = `${viewport.width}px`
            canvas.style.height = `${viewport.height}px`
            // Checkbox/radio appearances are rendered into separate canvases
            // that the form layer shows depending on the field state.
            const annotationCanvasMap = new Map<string, HTMLCanvasElement>()
            task = pdfPage.render({
                annotationCanvasMap,
                canvas,
                viewport,
                transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
                annotationMode: pdfjs.AnnotationMode.ENABLE_FORMS,
            })
            try {
                await task.promise
            } catch {
                return // cancelled
            }
            if (cancelled) return
            host.replaceChildren(canvas)
            setRendered(true)

            const textDiv = textRef.current
            if (textDiv) {
                textDiv.replaceChildren()
                textLayer = new pdfjs.TextLayer({ textContentSource: pdfPage.streamTextContent(), container: textDiv, viewport })
                await textLayer.render().catch(() => {})
                if (cancelled) return
                const end = document.createElement("div")
                end.className = "endOfContent"
                textDiv.append(end)
            }

            const formDiv = formRef.current
            const links = ed.linkServices.get(src.id)
            if (formDiv && links) {
                formDiv.replaceChildren()
                const annotations = await pdfPage.getAnnotations({ intent: "display" })
                if (cancelled || !annotations.length) return
                const flat = viewport.clone({ dontFlip: true })
                const layer = new pdfjs.AnnotationLayer({
                    div: formDiv,
                    page: pdfPage,
                    viewport: flat,
                    linkService: links,
                    annotationStorage: src.proxy.annotationStorage,
                    accessibilityManager: null,
                    annotationCanvasMap,
                    annotationEditorUIManager: null,
                    structTreeLayer: null,
                    commentManager: null,
                })
                await layer
                    .render({
                        annotations,
                        viewport: flat,
                        div: formDiv,
                        page: pdfPage,
                        linkService: links as never,
                        renderForms: true,
                        annotationStorage: src.proxy.annotationStorage,
                        annotationCanvasMap,
                        imageResourcesPath: PDFJS_IMAGES,
                        enableScripting: false,
                        hasJSActions: false,
                        fieldObjects: null,
                    })
                    .catch((err: unknown) => console.warn("Annotation layer failed", err))
            }
        })()
        return () => {
            cancelled = true
            task?.cancel()
            textLayer?.cancel()
        }
    }, [visible, src, page.srcIndex, ed.scale, rotation, ed.linkServices])

    // --- Coordinate helpers -------------------------------------------------
    const screenPos = (e: { clientX: number; clientY: number }): Pt => {
        const r = svgRef.current!.getBoundingClientRect()
        return [e.clientX - r.left, e.clientY - r.top]
    }
    const pdfPos = (e: { clientX: number; clientY: number }): Pt => apply(vp.inv, screenPos(e))

    const base = () => ({ pageId: page.id, created: Date.now(), author: ed.author })
    const { style, tool } = ed

    const replaceAnn = (list: Ann[], id: string, fn: (a: Ann) => Ann) => list.map((a) => (a.id === id ? fn(a) : a))

    const placeImage = (at: Pt) => {
        const p = ed.pendingImage
        if (!p) return
        const ann: ImageAnn = {
            ...base(),
            id: uid("ann"),
            type: "image",
            at: local(at, rotation, -p.w / 2, -p.h / 2),
            rot: rotation,
            w: p.w,
            h: p.h,
            src: p.src,
            kind: p.kind,
            label: p.label,
        }
        ed.store.commit((s) => ({ ...s, annots: [...s.annots, ann] }))
        ed.setSelectedId(ann.id)
        if (p.kind !== "signature") ed.setPendingImage(null)
        ed.setTool("select")
    }

    // --- Pointer interaction --------------------------------------------------
    const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
        if (e.button !== 0) return
        const target = e.target as Element
        const p = pdfPos(e)
        if (tool === "select") {
            const handle = target.closest("[data-handle]")
            const annEl = target.closest("[data-ann]")
            const id = handle?.getAttribute("data-handle") ?? annEl?.getAttribute("data-ann")
            const ann = id ? annots.find((a) => a.id === id) : undefined
            if (!ann) return
            e.stopPropagation()
            e.preventDefault()
            svgRef.current!.setPointerCapture(e.pointerId)
            if (handle) {
                const [x0, y0, x1, y1] = screenBox(ann, vp)
                gesture.current = {
                    kind: "resize",
                    id: ann.id,
                    tl: [x0, y0],
                    br: [x1, y1],
                    locked: ann.type === "text" || ann.type === "image",
                }
                return
            }
            ed.setSelectedId(ann.id)
            if (ann.type === "note") ed.setOpenNoteId(ann.id)
            if (ann.type === "text" && e.detail >= 2) {
                ed.setEditingId(ann.id)
                return
            }
            if (!isMarkup(ann)) gesture.current = { kind: "move", id: ann.id, start: p, moved: false }
            return
        }
        if (tool === "hand" || MARKUP_TOOLS.includes(tool)) return
        e.stopPropagation()
        e.preventDefault()
        ed.setSelectedId(null)
        if (tool === "text") {
            const ann: TextAnn = {
                ...base(),
                id: uid("ann"),
                type: "text",
                at: local(p, rotation, 0, -style.fontSize * 0.6),
                rot: rotation,
                text: "",
                fontSize: style.fontSize,
                font: style.font,
                color: style.color,
            }
            ed.store.commit((s) => ({ ...s, annots: [...s.annots, ann] }))
            ed.setSelectedId(ann.id)
            ed.setEditingId(ann.id)
            ed.setTool("select")
            return
        }
        if (tool === "note") {
            const ann: NoteAnn = {
                ...base(),
                id: uid("ann"),
                type: "note",
                at: local(p, rotation, -4, -4),
                rot: rotation,
                text: "",
                color: style.color,
            }
            ed.store.commit((s) => ({ ...s, annots: [...s.annots, ann] }))
            ed.setSelectedId(ann.id)
            ed.setOpenNoteId(ann.id)
            ed.setTool("select")
            return
        }
        if (tool === "signature" || tool === "image" || tool === "stamp") {
            placeImage(p)
            return
        }
        svgRef.current!.setPointerCapture(e.pointerId)
        gesture.current = { kind: "draw", start: p }
        const common = { ...base(), id: uid("ann"), color: style.color, width: style.width, opacity: style.opacity }
        if (tool === "ink") setDraft({ ...common, type: "ink", paths: [[p]] })
        else if (tool === "line" || tool === "arrow") setDraft({ ...common, type: tool, p1: p, p2: p })
        else if (tool === "rect" || tool === "ellipse" || tool === "whiteout")
            setDraft({
                ...common,
                type: tool,
                x: p[0],
                y: p[1],
                w: 0,
                h: 0,
                fill: tool === "whiteout" ? "#ffffff" : style.fill,
            })
    }

    const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
        const g = gesture.current
        if (!g) return
        const p = pdfPos(e)
        if (g.kind === "draw") {
            setDraft((d) => {
                if (!d) return d
                if (d.type === "ink") {
                    const path = d.paths[0]
                    const last = path[path.length - 1]
                    if (Math.hypot(p[0] - last[0], p[1] - last[1]) * ed.scale < 1.5) return d
                    return { ...d, paths: [[...path, p]] }
                }
                if (d.type === "line" || d.type === "arrow") {
                    let end = p
                    if (e.shiftKey) end = snap45(d.p1, p)
                    return { ...d, p2: end }
                }
                if (d.type === "rect" || d.type === "ellipse" || d.type === "whiteout") {
                    let [x1, y1] = p
                    if (e.shiftKey) {
                        const size = Math.max(Math.abs(x1 - g.start[0]), Math.abs(y1 - g.start[1]))
                        x1 = g.start[0] + Math.sign(x1 - g.start[0] || 1) * size
                        y1 = g.start[1] + Math.sign(y1 - g.start[1] || 1) * size
                    }
                    const r = normRect(g.start[0], g.start[1], x1, y1)
                    return { ...d, x: r[0], y: r[1], w: r[2] - r[0], h: r[3] - r[1] }
                }
                return d
            })
        } else if (g.kind === "move") {
            const dx = p[0] - g.start[0]
            const dy = p[1] - g.start[1]
            if (!g.moved && Math.hypot(dx, dy) * ed.scale < 3) return
            g.moved = true
            ed.store.live((s) => ({
                ...s,
                annots: replaceAnn(s.annots, g.id, (a) => mapAnn(a, (q) => [q[0] + dx, q[1] + dy])),
            }))
        } else if (g.kind === "resize") {
            const [mx, my] = screenPos(e)
            let sx = Math.max(0.05, (mx - g.tl[0]) / Math.max(1, g.br[0] - g.tl[0]))
            let sy = Math.max(0.05, (my - g.tl[1]) / Math.max(1, g.br[1] - g.tl[1]))
            if (g.locked || e.shiftKey) sx = sy = Math.max(sx, sy)
            const f = (q: Pt): Pt => {
                const s = apply(vp.m, q)
                return apply(vp.inv, [g.tl[0] + (s[0] - g.tl[0]) * sx, g.tl[1] + (s[1] - g.tl[1]) * sy])
            }
            ed.store.live((s) => ({ ...s, annots: replaceAnn(s.annots, g.id, (a) => mapAnn(a, f, sy)) }))
        }
    }

    const onPointerUp = () => {
        const g = gesture.current
        gesture.current = null
        if (!g) return
        if (g.kind === "draw") {
            const d = draft
            setDraft(null)
            if (!d) return
            const [x0, y0, x1, y1] = bounds(annCorners(d))
            const big = (x1 - x0) * ed.scale > 4 || (y1 - y0) * ed.scale > 4
            if (d.type === "ink" || big) ed.store.commit((s) => ({ ...s, annots: [...s.annots, d] }))
        } else {
            ed.store.endLive()
        }
    }

    // --- Derived rendering data ----------------------------------------------
    const markups = annots.filter(isMarkup)
    const others = annots.filter((a) => !isMarkup(a))
    const selected = annots.find((a) => a.id === ed.selectedId)
    const matrix = `matrix(${vp.m.join(" ")})`
    const matches = ed.search.matches
    const pageMatches = matches.map((m, i) => ({ m, i })).filter(({ m }) => m.pageId === page.id)
    const openNote = annots.find((a): a is NoteAnn => a.type === "note" && a.id === ed.openNoteId)

    const updateText = (id: string, text: string) =>
        ed.store.live((s) => ({ ...s, annots: replaceAnn(s.annots, id, (a) => ({ ...a, text }) as Ann) }))
    const finishText = (id: string) => {
        ed.store.endLive()
        ed.setEditingId(null)
        ed.store.commit((s) => {
            const a = s.annots.find((x) => x.id === id)
            if (a && a.type === "text" && !a.text.trim()) return { ...s, annots: s.annots.filter((x) => x.id !== id) }
            return s
        })
    }

    return (
        <div
            className={`page tool-${tool}${rendered ? "" : " loading"}`}
            data-page-id={page.id}
            data-page-index={index}
            style={
                {
                    width: vp.width,
                    height: vp.height,
                    "--scale-factor": ed.scale,
                    "--total-scale-factor": ed.scale,
                    "--user-unit": 1,
                    "--scale-round-x": "1px",
                    "--scale-round-y": "1px",
                } as React.CSSProperties
            }
        >
            <div className="canvas-host" ref={canvasHost} />
            <div className="textLayer" ref={textRef} />
            <svg className="markup-layer" width={vp.width} height={vp.height}>
                <g transform={matrix}>
                    {pageMatches.map(({ m, i }) =>
                        m.rects.map((r, k) => (
                            <rect
                                key={`${i}-${k}`}
                                className={i === ed.search.current ? "search-hit current" : "search-hit"}
                                x={r[0]}
                                y={r[1]}
                                width={r[2] - r[0]}
                                height={r[3] - r[1]}
                            />
                        )),
                    )}
                </g>
            </svg>
            <div className="annotationLayer" ref={formRef} />
            <svg
                className="markup-layer interactive"
                width={vp.width}
                height={vp.height}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
            >
                <g transform={matrix}>
                    {markups.map((a) => (
                        <g key={a.id} opacity={a.type === "highlight" ? a.opacity : 1}>
                            <MarkupGraphic a={a} />
                        </g>
                    ))}
                </g>
            </svg>
            <svg
                ref={svgRef}
                className={`ann-layer${tool !== "select" && tool !== "hand" && !MARKUP_TOOLS.includes(tool) ? " drawing" : ""}`}
                width={vp.width}
                height={vp.height}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
            >
                <g transform={matrix}>
                    {others.map((a) => (
                        <AnnGraphic
                            key={a.id}
                            a={a}
                            editing={a.id === ed.editingId}
                            onText={(t) => updateText(a.id, t)}
                            onDoneEditing={() => finishText(a.id)}
                        />
                    ))}
                    {draft && <AnnGraphic a={draft} />}
                </g>
                {selected && selected.id !== ed.editingId && <SelectionBox a={selected} vp={vp} />}
            </svg>
            {openNote && <NotePopup note={openNote} vp={vp} />}
            {!src && <div className="blank-label">Blank page</div>}
        </div>
    )
})

function screenBox(a: Ann, vp: Viewport) {
    return bounds(annCorners(a).map((p) => apply(vp.m, p)))
}

function snap45(p1: Pt, p: Pt): Pt {
    const dx = p[0] - p1[0]
    const dy = p[1] - p1[1]
    const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4)
    const len = Math.hypot(dx, dy)
    return [p1[0] + Math.cos(angle) * len, p1[1] + Math.sin(angle) * len]
}

function SelectionBox({ a, vp }: { a: Ann; vp: Viewport }) {
    const [x0, y0, x1, y1] = screenBox(a, vp)
    const pad = 4
    const resizable = !isMarkup(a) && a.type !== "note"
    return (
        <g className="selection">
            <rect x={x0 - pad} y={y0 - pad} width={x1 - x0 + pad * 2} height={y1 - y0 + pad * 2} />
            {resizable && (
                <rect
                    className="handle hit"
                    data-handle={a.id}
                    x={x1 + pad - 5}
                    y={y1 + pad - 5}
                    width={10}
                    height={10}
                />
            )}
        </g>
    )
}

function NotePopup({ note, vp }: { note: NoteAnn; vp: Viewport }) {
    const ed = useEditor()
    const [x0, , x1, y1] = screenBox(note, vp)
    const ref = useRef<HTMLTextAreaElement>(null)
    useEffect(() => {
        ref.current?.focus({ preventScroll: true })
    }, [note.id])
    const left = Math.min(Math.max(0, x1 + 8), Math.max(0, vp.width - 240))
    const top = Math.max(0, y1 - 20)
    return (
        <div
            className="note-popup"
            style={{ left: left < x1 && left + 240 > x0 ? Math.max(0, x0 - 248) : left, top }}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
        >
            <div className="note-head" style={{ background: note.color }}>
                <span>{note.author}</span>
                <span className="note-date">{new Date(note.created).toLocaleString()}</span>
                <button className="icon-btn small" title="Close" onClick={() => ed.setOpenNoteId(null)}>
                    <Icon name="close" size={14} />
                </button>
            </div>
            <textarea
                ref={ref}
                value={note.text}
                placeholder="Add a comment…"
                onChange={(e) => {
                    const text = e.target.value
                    ed.store.live((s) => ({
                        ...s,
                        annots: s.annots.map((a) => (a.id === note.id ? { ...a, text } : a)),
                    }))
                }}
                onBlur={() => ed.store.endLive()}
            />
            <div className="note-actions">
                <button
                    className="btn ghost small danger"
                    onClick={() => {
                        ed.store.commit((s) => ({ ...s, annots: s.annots.filter((a) => a.id !== note.id) }))
                        ed.setOpenNoteId(null)
                        ed.setSelectedId(null)
                    }}
                >
                    <Icon name="trash" size={14} /> Delete
                </button>
                <button className="btn small" onClick={() => ed.setOpenNoteId(null)}>
                    Done
                </button>
            </div>
        </div>
    )
}
