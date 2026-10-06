import { useState } from "react"
import { useEditor } from "../context"
import type { Ann, AnnType, PageRef } from "../types"
import { Icon } from "./Icons"
import { Thumbnail } from "./Thumbnail"

export interface OutlineNode {
    title: string
    dest: unknown
    url: string | null
    bold?: boolean
    italic?: boolean
    items: OutlineNode[]
}

export type SidebarTab = "pages" | "bookmarks" | "comments"

interface Props {
    tab: SidebarTab
    setTab(t: SidebarTab): void
    pages: PageRef[]
    annots: Ann[]
    current: number
    outline: OutlineNode[] | null
    onGoto(index: number): void
    onOutline(node: OutlineNode): void
    onSelectAnn(a: Ann): void
    onRotatePage(id: string, delta: number): void
    onDeletePage(id: string): void
}

export const TYPE_LABEL: Record<AnnType, string> = {
    highlight: "Highlight",
    underline: "Underline",
    strikeout: "Strikethrough",
    ink: "Drawing",
    rect: "Rectangle",
    ellipse: "Ellipse",
    line: "Line",
    arrow: "Arrow",
    whiteout: "Whiteout",
    text: "Text",
    note: "Sticky note",
    image: "Image",
}

export const TYPE_ICON: Record<AnnType, string> = {
    highlight: "highlight",
    underline: "underline",
    strikeout: "strike",
    ink: "pen",
    rect: "square",
    ellipse: "circle",
    line: "line",
    arrow: "arrow",
    whiteout: "whiteout",
    text: "text",
    note: "note",
    image: "image",
}

export function Sidebar(props: Props) {
    const { tab, setTab } = props
    return (
        <aside className="sidebar">
            <div className="sidebar-tabs" role="tablist">
                {(
                    [
                        ["pages", "pages", "Pages"],
                        ["bookmarks", "bookmark", "Bookmarks"],
                        ["comments", "comment", "Comments"],
                    ] as const
                ).map(([id, icon, label]) => (
                    <button
                        key={id}
                        role="tab"
                        aria-selected={tab === id}
                        className={tab === id ? "active" : ""}
                        onClick={() => setTab(id)}
                        title={label}
                    >
                        <Icon name={icon} size={16} />
                        <span>{label}</span>
                        {id === "comments" && props.annots.length > 0 && <em className="badge">{props.annots.length}</em>}
                    </button>
                ))}
            </div>
            <div className="sidebar-body">
                {tab === "pages" && <PagesPanel {...props} />}
                {tab === "bookmarks" && <BookmarksPanel {...props} />}
                {tab === "comments" && <CommentsPanel {...props} />}
            </div>
        </aside>
    )
}

function PagesPanel({ pages, annots, current, onGoto, onRotatePage, onDeletePage }: Props) {
    const ed = useEditor()
    return (
        <div className="thumb-list">
            {pages.map((p, i) => (
                <div
                    key={p.id}
                    className={`thumb-item${i === current ? " current" : ""}`}
                    onClick={() => onGoto(i)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && onGoto(i)}
                >
                    <Thumbnail
                        page={p}
                        src={p.srcId ? ed.sources.get(p.srcId) : undefined}
                        annots={annots.filter((a) => a.pageId === p.id)}
                        width={132}
                        rotation={(p.baseRot + p.rot + ed.viewRot) % 360}
                    />
                    <div className="thumb-actions" onClick={(e) => e.stopPropagation()}>
                        <button className="icon-btn small" title="Rotate page left" onClick={() => onRotatePage(p.id, -90)}>
                            <Icon name="rotateCcw" size={14} />
                        </button>
                        <button className="icon-btn small" title="Rotate page right" onClick={() => onRotatePage(p.id, 90)}>
                            <Icon name="rotateCw" size={14} />
                        </button>
                        <button
                            className="icon-btn small"
                            title="Delete page"
                            disabled={pages.length <= 1}
                            onClick={() => onDeletePage(p.id)}
                        >
                            <Icon name="trash" size={14} />
                        </button>
                    </div>
                    <span className="thumb-label">{i + 1}</span>
                </div>
            ))}
        </div>
    )
}

function BookmarksPanel({ outline, onOutline }: Props) {
    if (!outline) return <p className="empty">Loading…</p>
    if (!outline.length) return <p className="empty">This document has no bookmarks.</p>
    return (
        <ul className="outline">
            {outline.map((n, i) => (
                <OutlineItem key={i} node={n} onOutline={onOutline} />
            ))}
        </ul>
    )
}

function OutlineItem({ node, onOutline }: { node: OutlineNode; onOutline(n: OutlineNode): void }) {
    const [open, setOpen] = useState(false)
    return (
        <li>
            <div className="outline-row">
                {node.items.length > 0 ? (
                    <button className="icon-btn tiny" onClick={() => setOpen(!open)} aria-label={open ? "Collapse" : "Expand"}>
                        <Icon name={open ? "chevronDown" : "chevronRight"} size={14} />
                    </button>
                ) : (
                    <span className="outline-spacer" />
                )}
                <button
                    className="outline-title"
                    style={{ fontWeight: node.bold ? 600 : undefined, fontStyle: node.italic ? "italic" : undefined }}
                    onClick={() => onOutline(node)}
                    title={node.title}
                >
                    {node.title}
                </button>
            </div>
            {open && node.items.length > 0 && (
                <ul>
                    {node.items.map((c, i) => (
                        <OutlineItem key={i} node={c} onOutline={onOutline} />
                    ))}
                </ul>
            )}
        </li>
    )
}

function CommentsPanel({ pages, annots, onSelectAnn }: Props) {
    const ed = useEditor()
    const [filter, setFilter] = useState("")
    const order = new Map(pages.map((p, i) => [p.id, i]))
    const q = filter.trim().toLowerCase()
    const list = annots
        .filter((a) => order.has(a.pageId))
        .filter((a) => {
            if (!q) return true
            const hay = `${TYPE_LABEL[a.type]} ${a.author} ${a.comment ?? ""} ${"text" in a ? (a.text ?? "") : ""}`
            return hay.toLowerCase().includes(q)
        })
        .sort((a, b) => order.get(a.pageId)! - order.get(b.pageId)! || a.created - b.created)

    if (!annots.length) {
        return (
            <p className="empty">
                No comments yet. Use the tools on the left to highlight text, add sticky notes, draw or add text.
            </p>
        )
    }

    let lastPage = -1
    return (
        <div className="comments">
            <input
                className="input"
                placeholder="Filter comments"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
            />
            {list.map((a) => {
                const pageIdx = order.get(a.pageId)!
                const header = pageIdx !== lastPage
                lastPage = pageIdx
                const body = "text" in a && a.type !== "note" ? a.text : null
                return (
                    <div key={a.id}>
                        {header && <div className="comments-page">Page {pageIdx + 1}</div>}
                        <div
                            className={`comment-card${ed.selectedId === a.id ? " selected" : ""}`}
                            onClick={() => onSelectAnn(a)}
                        >
                            <div className="comment-head">
                                <span
                                    className="comment-icon"
                                    style={{ color: "color" in a ? a.color : undefined }}
                                >
                                    <Icon name={TYPE_ICON[a.type]} size={15} />
                                </span>
                                <strong>{a.type === "image" && a.kind !== "image" ? capital(a.kind) : TYPE_LABEL[a.type]}</strong>
                                <span className="comment-meta">
                                    {a.author} · {new Date(a.created).toLocaleDateString()}
                                </span>
                                <button
                                    className="icon-btn tiny"
                                    title="Delete"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        ed.store.commit((s) => ({ ...s, annots: s.annots.filter((x) => x.id !== a.id) }))
                                        if (ed.selectedId === a.id) ed.setSelectedId(null)
                                    }}
                                >
                                    <Icon name="trash" size={13} />
                                </button>
                            </div>
                            {body && <blockquote>{body}</blockquote>}
                            <textarea
                                className="comment-input"
                                rows={1}
                                placeholder={a.type === "note" ? "Add a note…" : "Add a comment…"}
                                value={a.type === "note" ? a.text : (a.comment ?? "")}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                    const v = e.target.value
                                    ed.store.live((s) => ({
                                        ...s,
                                        annots: s.annots.map((x) =>
                                            x.id !== a.id ? x : x.type === "note" ? { ...x, text: v } : { ...x, comment: v },
                                        ),
                                    }))
                                }}
                                onBlur={() => ed.store.endLive()}
                            />
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

function capital(s: string) {
    return s[0].toUpperCase() + s.slice(1)
}
