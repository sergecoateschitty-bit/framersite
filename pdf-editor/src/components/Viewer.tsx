import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import { MARKUP_TOOLS, useEditor } from "../context"
import { apply, mergeRects, normRect, pageSize, uid, viewportFor } from "../geometry"
import type { Ann, MarkupAnn, PageRef, Rect } from "../types"
import { PageView } from "./PageView"

export interface ViewerHandle {
    scrollToPage(index: number, offsetPdfY?: { pageId: string; rect: Rect }): void
    element(): HTMLDivElement | null
}

interface Props {
    pages: PageRef[]
    annots: Ann[]
    twoPage: boolean
    onCurrentPage(index: number): void
    onZoomBy(factor: number): void
}

const GAP = 16

export const Viewer = forwardRef<ViewerHandle, Props>(function Viewer({ pages, annots, twoPage, onCurrentPage, onZoomBy }, ref) {
    const ed = useEditor()
    const scroller = useRef<HTMLDivElement>(null)
    const [visible, setVisible] = useState<Set<string>>(new Set())
    const lastScale = useRef(ed.scale)

    const byPage = useMemo(() => {
        const map = new Map<string, Ann[]>()
        for (const a of annots) {
            const list = map.get(a.pageId)
            if (list) list.push(a)
            else map.set(a.pageId, [a])
        }
        return map
    }, [annots])
    const stableLists = useRef(new Map<string, Ann[]>())
    const listFor = (id: string): Ann[] => {
        // Keep array identity when a page's annotations didn't change so
        // memoised PageViews skip re-rendering.
        const next = byPage.get(id) ?? EMPTY
        const prev = stableLists.current.get(id)
        if (prev && prev.length === next.length && prev.every((a, i) => a === next[i])) return prev
        stableLists.current.set(id, next)
        return next
    }

    useImperativeHandle(ref, () => ({
        element: () => scroller.current,
        scrollToPage(index, target) {
            const el = scroller.current?.querySelector<HTMLElement>(`[data-page-index="${index}"]`)
            const box = scroller.current
            if (!el || !box) return
            let top = el.offsetTop - GAP
            if (target) {
                const pg = pages[index]
                if (pg) {
                    const vp = viewportFor(pg.view, ed.scale, (pg.baseRot + pg.rot + ed.viewRot) % 360)
                    const p = apply(vp.m, [target.rect[0], target.rect[3]])
                    top = el.offsetTop + p[1] - box.clientHeight / 3
                    const left = el.offsetLeft + p[0] - box.clientWidth / 2
                    if (el.offsetWidth > box.clientWidth) box.scrollLeft = Math.max(0, left)
                }
            }
            box.scrollTo({ top: Math.max(0, top) })
        },
    }))

    // Lazily render pages near the viewport.
    useEffect(() => {
        const box = scroller.current
        if (!box) return
        const io = new IntersectionObserver(
            (entries) => {
                setVisible((prev) => {
                    const next = new Set(prev)
                    for (const e of entries) {
                        const id = (e.target as HTMLElement).dataset.pageId!
                        if (e.isIntersecting) next.add(id)
                        else next.delete(id)
                    }
                    return next
                })
            },
            { root: box, rootMargin: "800px 0px" },
        )
        box.querySelectorAll("[data-page-id]").forEach((el) => io.observe(el))
        return () => io.disconnect()
    }, [pages, ed.scale, ed.viewRot, twoPage])

    // Track the current page while scrolling.
    const updateCurrent = useCallback(() => {
        const box = scroller.current
        if (!box) return
        const mid = box.scrollTop + box.clientHeight * 0.35
        let best = 0
        const els = box.querySelectorAll<HTMLElement>("[data-page-index]")
        for (const el of els) {
            if (el.offsetTop <= mid) best = Number(el.dataset.pageIndex)
            else break
        }
        if (box.scrollTop + box.clientHeight >= box.scrollHeight - 2 && els.length) best = els.length - 1
        onCurrentPage(best)
    }, [onCurrentPage])

    // Keep the reading position stable when zooming.
    useEffect(() => {
        const box = scroller.current
        if (!box) return
        const k = ed.scale / lastScale.current
        lastScale.current = ed.scale
        if (k !== 1) {
            box.scrollTop = box.scrollTop * k
            box.scrollLeft = box.scrollLeft * k
        }
    }, [ed.scale])

    // Ctrl/⌘ + wheel zoom.
    useEffect(() => {
        const box = scroller.current
        if (!box) return
        const onWheel = (e: WheelEvent) => {
            if (!e.ctrlKey && !e.metaKey) return
            e.preventDefault()
            onZoomBy(Math.exp(-e.deltaY * 0.0025))
        }
        box.addEventListener("wheel", onWheel, { passive: false })
        return () => box.removeEventListener("wheel", onWheel)
    }, [onZoomBy])

    // Hand tool panning + markup-from-selection.
    const pan = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
    const markupStart = useRef<{ x: number; y: number; pageEl: HTMLElement } | null>(null)

    const onPointerDown = (e: React.PointerEvent) => {
        const target = e.target as HTMLElement
        if (ed.tool === "hand" && scroller.current) {
            pan.current = { x: e.clientX, y: e.clientY, left: scroller.current.scrollLeft, top: scroller.current.scrollTop }
            scroller.current.setPointerCapture(e.pointerId)
            return
        }
        const textLayer = target.closest(".textLayer")
        if (textLayer) {
            textLayer.classList.add("selecting")
            const off = () => {
                textLayer.classList.remove("selecting")
                window.removeEventListener("pointerup", off)
            }
            window.addEventListener("pointerup", off)
        }
        if (MARKUP_TOOLS.includes(ed.tool)) {
            const pageEl = target.closest<HTMLElement>("[data-page-id]")
            markupStart.current = pageEl ? { x: e.clientX, y: e.clientY, pageEl } : null
        }
        if (!target.closest("[data-ann],[data-handle],.note-popup,.text-editor")) {
            ed.setSelectedId(null)
            ed.setOpenNoteId(null)
        }
    }

    const onPointerMove = (e: React.PointerEvent) => {
        const p = pan.current
        if (!p || !scroller.current) return
        scroller.current.scrollLeft = p.left - (e.clientX - p.x)
        scroller.current.scrollTop = p.top - (e.clientY - p.y)
    }

    const vpFor = (pageId: string) => {
        const pg = pages.find((p) => p.id === pageId)
        return pg ? viewportFor(pg.view, ed.scale, (pg.baseRot + pg.rot + ed.viewRot) % 360) : null
    }

    const onPointerUp = (e: React.PointerEvent) => {
        pan.current = null
        if (!MARKUP_TOOLS.includes(ed.tool)) return
        const type = ed.tool as MarkupAnn["type"]
        const sel = window.getSelection()
        const created: MarkupAnn[] = []
        const make = (pageId: string, rects: Rect[], text?: string) => {
            if (!rects.length) return
            created.push({
                id: uid("ann"),
                pageId,
                created: Date.now(),
                author: ed.author,
                type,
                rects,
                color: ed.style.color,
                opacity: type === "highlight" ? Math.min(ed.style.opacity, 0.6) : 1,
                text,
            })
        }
        if (sel && !sel.isCollapsed && sel.rangeCount) {
            const perPage = new Map<string, Rect[]>()
            for (const { rect, pageEl } of selectionRects(sel)) {
                const id = pageEl.dataset.pageId!
                const vp = vpFor(id)
                if (!vp) continue
                const pr = pageEl.getBoundingClientRect()
                const a = apply(vp.inv, [rect.left - pr.left, rect.top - pr.top])
                const b = apply(vp.inv, [rect.right - pr.left, rect.bottom - pr.top])
                const list = perPage.get(id) ?? []
                list.push(normRect(a[0], a[1], b[0], b[1]))
                perPage.set(id, list)
            }
            const text = sel.toString().trim()
            for (const [id, rects] of perPage) make(id, mergeRects(rects), text)
            sel.removeAllRanges()
        } else if (markupStart.current) {
            // No text under the pointer (e.g. a scanned page): drag a box instead.
            const { x, y, pageEl } = markupStart.current
            if (Math.abs(e.clientX - x) > 4 && Math.abs(e.clientY - y) > 4) {
                const id = pageEl.dataset.pageId!
                const vp = vpFor(id)
                if (vp) {
                    const pr = pageEl.getBoundingClientRect()
                    const a = apply(vp.inv, [x - pr.left, y - pr.top])
                    const b = apply(vp.inv, [e.clientX - pr.left, e.clientY - pr.top])
                    make(id, [normRect(a[0], a[1], b[0], b[1])])
                }
            }
        }
        markupStart.current = null
        if (created.length) ed.store.commit((s) => ({ ...s, annots: [...s.annots, ...created] }))
    }

    return (
        <div
            className={`viewer tool-${ed.tool}`}
            ref={scroller}
            onScroll={updateCurrent}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
        >
            <div className={`pages${twoPage ? " two-page" : ""}`} style={{ gap: GAP, padding: GAP }}>
                {pages.map((p, i) => {
                    const [w, h] = pageSize(p.view, p.baseRot + p.rot + ed.viewRot)
                    return (
                        <div key={p.id} className="page-slot" style={{ minWidth: w * ed.scale, minHeight: h * ed.scale }}>
                            <PageView page={p} index={i} annots={listFor(p.id)} visible={visible.has(p.id)} />
                            <div className="page-number">{i + 1}</div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
})

const EMPTY: Ann[] = []

/** Client rects of the selected text, one per text node fragment. */
function selectionRects(sel: Selection): { rect: DOMRect; pageEl: HTMLElement }[] {
    const out: { rect: DOMRect; pageEl: HTMLElement }[] = []
    for (let r = 0; r < sel.rangeCount; r++) {
        const range = sel.getRangeAt(r)
        const root = range.commonAncestorContainer
        const walker = document.createTreeWalker(
            root.nodeType === Node.TEXT_NODE ? root.parentNode! : root,
            NodeFilter.SHOW_TEXT,
        )
        let node: Node | null = walker.currentNode
        while (node) {
            if (node.nodeType === Node.TEXT_NODE && range.intersectsNode(node)) {
                const pageEl = node.parentElement?.closest<HTMLElement>(".textLayer")?.closest<HTMLElement>("[data-page-id]")
                if (pageEl) {
                    const sub = document.createRange()
                    sub.selectNodeContents(node)
                    if (node === range.startContainer) sub.setStart(node, range.startOffset)
                    if (node === range.endContainer) sub.setEnd(node, range.endOffset)
                    for (const rect of sub.getClientRects()) {
                        if (rect.width > 0.5 && rect.height > 0.5) out.push({ rect, pageEl })
                    }
                }
            }
            node = walker.nextNode()
        }
    }
    return out
}
