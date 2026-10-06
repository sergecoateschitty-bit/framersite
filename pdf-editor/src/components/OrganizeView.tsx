import { useState } from "react"
import { useEditor } from "../context"
import { uid } from "../geometry"
import type { Ann, PageRef } from "../types"
import { Icon } from "./Icons"
import { Thumbnail } from "./Thumbnail"

interface Props {
    pages: PageRef[]
    annots: Ann[]
    onOpenPage(index: number): void
    onInsertFile(atIndex: number): void
    onExtract(ids: Set<string>): void
    onClose(): void
}

export function OrganizeView({ pages, annots, onOpenPage, onInsertFile, onExtract, onClose }: Props) {
    const ed = useEditor()
    const [sel, setSel] = useState<Set<string>>(new Set())
    const [anchor, setAnchor] = useState<number | null>(null)
    const [drag, setDrag] = useState<string | null>(null)
    const [dropAt, setDropAt] = useState<number | null>(null)
    const [size, setSize] = useState(160)

    const selected = pages.filter((p) => sel.has(p.id))
    const lastSelectedIndex = Math.max(-1, ...pages.map((p, i) => (sel.has(p.id) ? i : -1)))
    const insertIndex = lastSelectedIndex >= 0 ? lastSelectedIndex + 1 : pages.length

    const click = (e: React.MouseEvent, i: number) => {
        const id = pages[i].id
        if (e.shiftKey && anchor !== null) {
            const [a, b] = [Math.min(anchor, i), Math.max(anchor, i)]
            setSel(new Set(pages.slice(a, b + 1).map((p) => p.id)))
        } else if (e.metaKey || e.ctrlKey) {
            const next = new Set(sel)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            setSel(next)
            setAnchor(i)
        } else {
            setSel(new Set([id]))
            setAnchor(i)
        }
    }

    const rotate = (delta: number) =>
        ed.store.commit((s) => ({
            ...s,
            pages: s.pages.map((p) => (sel.has(p.id) ? { ...p, rot: (p.rot + delta + 360) % 360 } : p)),
        }))

    const remove = () => {
        if (selected.length >= pages.length) return
        ed.store.commit((s) => ({
            pages: s.pages.filter((p) => !sel.has(p.id)),
            annots: s.annots.filter((a) => !sel.has(a.pageId)),
        }))
        setSel(new Set())
    }

    const duplicate = () =>
        ed.store.commit((s) => {
            const pagesOut: PageRef[] = []
            const extra: Ann[] = []
            for (const p of s.pages) {
                pagesOut.push(p)
                if (sel.has(p.id)) {
                    const copy = { ...p, id: uid("pg") }
                    pagesOut.push(copy)
                    for (const a of s.annots) if (a.pageId === p.id) extra.push({ ...a, id: uid("ann"), pageId: copy.id })
                }
            }
            return { pages: pagesOut, annots: [...s.annots, ...extra] }
        })

    const insertBlank = () => {
        const ref = pages[Math.max(0, insertIndex - 1)]
        const w = ref ? ref.view[2] - ref.view[0] : 612
        const h = ref ? ref.view[3] - ref.view[1] : 792
        const swap = ref ? (ref.baseRot + ref.rot) % 180 !== 0 : false
        const blank: PageRef = {
            id: uid("pg"),
            srcId: null,
            srcIndex: 0,
            view: [0, 0, swap ? h : w, swap ? w : h],
            baseRot: 0,
            rot: 0,
        }
        ed.store.commit((s) => ({ ...s, pages: [...s.pages.slice(0, insertIndex), blank, ...s.pages.slice(insertIndex)] }))
        setSel(new Set([blank.id]))
    }

    const move = (ids: Set<string>, to: number) =>
        ed.store.commit((s) => {
            const moving = s.pages.filter((p) => ids.has(p.id))
            const before = s.pages.slice(0, to).filter((p) => !ids.has(p.id))
            const after = s.pages.slice(to).filter((p) => !ids.has(p.id))
            return { ...s, pages: [...before, ...moving, ...after] }
        })

    const onDrop = () => {
        if (drag !== null && dropAt !== null) {
            const ids = sel.has(drag) ? sel : new Set([drag])
            move(ids, dropAt)
        }
        setDrag(null)
        setDropAt(null)
    }

    const none = sel.size === 0
    return (
        <div className="organize">
            <div className="organize-bar">
                <strong>Organize pages</strong>
                <span className="muted">{sel.size ? `${sel.size} selected` : `${pages.length} pages`}</span>
                <div className="spacer" />
                <button className="btn ghost" onClick={() => setSel(new Set(pages.map((p) => p.id)))}>
                    Select all
                </button>
                <button className="icon-btn" title="Rotate left" disabled={none} onClick={() => rotate(-90)}>
                    <Icon name="rotateCcw" />
                </button>
                <button className="icon-btn" title="Rotate right" disabled={none} onClick={() => rotate(90)}>
                    <Icon name="rotateCw" />
                </button>
                <button className="icon-btn" title="Duplicate" disabled={none} onClick={duplicate}>
                    <Icon name="copy" />
                </button>
                <button
                    className="icon-btn"
                    title="Delete"
                    disabled={none || sel.size >= pages.length}
                    onClick={remove}
                >
                    <Icon name="trash" />
                </button>
                <span className="divider" />
                <button className="btn ghost" title="Insert a blank page" onClick={insertBlank}>
                    <Icon name="plus" size={16} /> Blank page
                </button>
                <button className="btn ghost" title="Insert pages from another PDF" onClick={() => onInsertFile(insertIndex)}>
                    <Icon name="filePlus" size={16} /> Insert from file
                </button>
                <button className="btn ghost" title="Save selected pages as a new PDF" disabled={none} onClick={() => onExtract(sel)}>
                    <Icon name="extract" size={16} /> Extract
                </button>
                <span className="divider" />
                <input
                    type="range"
                    min={100}
                    max={280}
                    value={size}
                    onChange={(e) => setSize(Number(e.target.value))}
                    aria-label="Thumbnail size"
                />
                <button className="btn primary" onClick={onClose}>
                    Done
                </button>
            </div>
            <div
                className="organize-grid"
                onClick={(e) => e.target === e.currentTarget && setSel(new Set())}
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
            >
                {pages.map((p, i) => (
                    <div
                        key={p.id}
                        className={`org-item${sel.has(p.id) ? " selected" : ""}${drag && dropAt === i ? " drop-before" : ""}${
                            drag && dropAt === i + 1 && i === pages.length - 1 ? " drop-after" : ""
                        }`}
                        draggable
                        onDragStart={(e) => {
                            setDrag(p.id)
                            e.dataTransfer.effectAllowed = "move"
                            e.dataTransfer.setData("text/plain", p.id)
                        }}
                        onDragEnd={() => {
                            setDrag(null)
                            setDropAt(null)
                        }}
                        onDragOver={(e) => {
                            e.preventDefault()
                            const r = e.currentTarget.getBoundingClientRect()
                            setDropAt(e.clientX < r.left + r.width / 2 ? i : i + 1)
                        }}
                        onClick={(e) => click(e, i)}
                        onDoubleClick={() => onOpenPage(i)}
                    >
                        <div className="org-thumb" style={{ width: size, height: size * 1.3 }}>
                            <Thumbnail
                                page={p}
                                src={p.srcId ? ed.sources.get(p.srcId) : undefined}
                                annots={annots.filter((a) => a.pageId === p.id)}
                                width={fitWidth(p, size, size * 1.3)}
                                rotation={(p.baseRot + p.rot) % 360}
                            />
                        </div>
                        <div className="org-label">
                            {i + 1}
                            {p.srcId && ed.sources.size > 1 && (
                                <span className="muted"> · {ed.sources.get(p.srcId)?.name}</span>
                            )}
                        </div>
                        <div className="org-actions" onClick={(e) => e.stopPropagation()}>
                            <button
                                className="icon-btn small"
                                title="Rotate"
                                onClick={() =>
                                    ed.store.commit((s) => ({
                                        ...s,
                                        pages: s.pages.map((x) => (x.id === p.id ? { ...x, rot: (x.rot + 90) % 360 } : x)),
                                    }))
                                }
                            >
                                <Icon name="rotateCw" size={14} />
                            </button>
                            <button
                                className="icon-btn small"
                                title="Delete"
                                disabled={pages.length <= 1}
                                onClick={() =>
                                    ed.store.commit((s) => ({
                                        pages: s.pages.filter((x) => x.id !== p.id),
                                        annots: s.annots.filter((a) => a.pageId !== p.id),
                                    }))
                                }
                            >
                                <Icon name="trash" size={14} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

function fitWidth(p: PageRef, maxW: number, maxH: number) {
    const rot = (p.baseRot + p.rot) % 180
    const w = p.view[2] - p.view[0]
    const h = p.view[3] - p.view[1]
    const [vw, vh] = rot ? [h, w] : [w, h]
    return Math.min(maxW, (maxH * vw) / vh)
}
