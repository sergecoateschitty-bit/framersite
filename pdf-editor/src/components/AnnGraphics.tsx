import { useEffect, useRef } from "react"
import { arrowGeometry } from "../export"
import { ASCENT, FONT_CSS, LINE_HEIGHT, NOTE_SIZE, textBox, type Matrix } from "../geometry"
import type { Ann, MarkupAnn, TextAnn } from "../types"

const isMarkup = (a: Ann): a is MarkupAnn => a.type === "highlight" || a.type === "underline" || a.type === "strikeout"

function uprightTransform(at: [number, number], rot: number) {
    // Inside the page group (PDF space, y up): move to the anchor, rotate so
    // the item reads upright, then flip y so local coordinates run downwards.
    return `translate(${at[0]} ${at[1]}) rotate(${rot}) scale(1 -1)`
}

export function MarkupGraphic({ a }: { a: MarkupAnn }) {
    if (a.type === "highlight") {
        return (
            <g data-ann={a.id} className="hit" fill={a.color}>
                {a.rects.map((r, i) => (
                    <rect key={i} x={r[0]} y={r[1]} width={r[2] - r[0]} height={r[3] - r[1]} />
                ))}
            </g>
        )
    }
    return (
        <g data-ann={a.id} className="hit" stroke={a.color} opacity={a.opacity}>
            {a.rects.map((r, i) => {
                const h = r[3] - r[1]
                const y = a.type === "underline" ? r[1] + h * 0.1 : r[1] + h * 0.45
                return (
                    <g key={i}>
                        <rect x={r[0]} y={r[1]} width={r[2] - r[0]} height={h} fill="transparent" stroke="none" />
                        <line x1={r[0]} x2={r[2]} y1={y} y2={y} strokeWidth={Math.max(0.75, h * 0.07)} />
                    </g>
                )
            })}
        </g>
    )
}

interface GraphicProps {
    a: Ann
    editing?: boolean
    onText?: (text: string) => void
    onDoneEditing?: () => void
}

export function AnnGraphic({ a, editing, onText, onDoneEditing }: GraphicProps) {
    switch (a.type) {
        case "highlight":
        case "underline":
        case "strikeout":
            return null // drawn on the multiply-blended markup layer
        case "ink":
            return (
                <g data-ann={a.id} className="hit" opacity={a.opacity}>
                    {a.paths.map((path, i) => {
                        const d = path.map((p, j) => `${j ? "L" : "M"}${p[0]} ${p[1]}`).join(" ")
                        return (
                            <g key={i}>
                                <path d={d} className="hit-pad" strokeWidth={Math.max(a.width, 8)} />
                                <path
                                    d={path.length === 1 ? `${d} l0.01 0` : d}
                                    fill="none"
                                    stroke={a.color}
                                    strokeWidth={a.width}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </g>
                        )
                    })}
                </g>
            )
        case "rect":
        case "whiteout":
            return (
                <rect
                    data-ann={a.id}
                    className="hit"
                    x={a.x}
                    y={a.y}
                    width={a.w}
                    height={a.h}
                    fill={a.type === "whiteout" ? (a.fill ?? "#ffffff") : (a.fill ?? "transparent")}
                    fillOpacity={a.type === "whiteout" ? 1 : a.fill ? a.opacity : 0}
                    stroke={a.type === "whiteout" ? "none" : a.color}
                    strokeOpacity={a.opacity}
                    strokeWidth={a.width}
                />
            )
        case "ellipse":
            return (
                <ellipse
                    data-ann={a.id}
                    className="hit"
                    cx={a.x + a.w / 2}
                    cy={a.y + a.h / 2}
                    rx={a.w / 2}
                    ry={a.h / 2}
                    fill={a.fill ?? "transparent"}
                    fillOpacity={a.fill ? a.opacity : 0}
                    stroke={a.color}
                    strokeOpacity={a.opacity}
                    strokeWidth={a.width}
                />
            )
        case "line":
        case "arrow": {
            const { shaft, head } = arrowGeometry(a.p1, a.p2, a.width, a.type === "arrow")
            return (
                <g data-ann={a.id} className="hit" opacity={a.opacity}>
                    <line x1={a.p1[0]} y1={a.p1[1]} x2={a.p2[0]} y2={a.p2[1]} className="hit-pad" strokeWidth={Math.max(a.width, 8)} />
                    <line x1={a.p1[0]} y1={a.p1[1]} x2={shaft[0]} y2={shaft[1]} stroke={a.color} strokeWidth={a.width} strokeLinecap="round" />
                    {head && <polygon points={head.map((p) => p.join(",")).join(" ")} fill={a.color} />}
                </g>
            )
        }
        case "text":
            return editing ? (
                <TextEditor a={a} onText={onText} onDone={onDoneEditing} />
            ) : (
                <TextGraphic a={a} />
            )
        case "note":
            return (
                <g data-ann={a.id} className="hit note-icon" transform={uprightTransform(a.at, a.rot)}>
                    <path
                        d={`M1 1h${NOTE_SIZE - 2}v${NOTE_SIZE - 7}h-8l-5 5v-5H1z`}
                        fill={a.color}
                        stroke="rgba(0,0,0,.55)"
                        strokeWidth={1}
                        strokeLinejoin="round"
                    />
                    <path d="M5 6h12M5 9.5h12M5 13h7" stroke="rgba(0,0,0,.55)" strokeWidth={1.2} />
                </g>
            )
        case "image":
            return (
                <g data-ann={a.id} className="hit" transform={uprightTransform(a.at, a.rot)}>
                    <image href={a.src} x={0} y={0} width={a.w} height={a.h} preserveAspectRatio="none" />
                </g>
            )
    }
}

function TextGraphic({ a }: { a: TextAnn }) {
    const { w, h, lines } = textBox(a)
    return (
        <g data-ann={a.id} className="hit" transform={uprightTransform(a.at, a.rot)}>
            <rect x={0} y={0} width={w} height={h} fill="transparent" />
            <text fill={a.color} fontSize={a.fontSize} fontFamily={FONT_CSS[a.font]} style={{ whiteSpace: "pre" }}>
                {lines.map((line, i) => (
                    <tspan key={i} x={0} y={a.fontSize * (ASCENT + LINE_HEIGHT * i)}>
                        {line || " "}
                    </tspan>
                ))}
            </text>
        </g>
    )
}

function TextEditor({ a, onText, onDone }: { a: TextAnn; onText?: (t: string) => void; onDone?: () => void }) {
    const ref = useRef<HTMLTextAreaElement>(null)
    const { w, h } = textBox(a)
    useEffect(() => {
        const el = ref.current
        if (!el) return
        el.focus({ preventScroll: true })
        el.setSelectionRange(el.value.length, el.value.length)
    }, [])
    const width = w + a.fontSize * 2
    return (
        <g transform={uprightTransform(a.at, a.rot)}>
            <foreignObject x={-2} y={-2} width={width + 4} height={h + a.fontSize + 4} className="text-editor-fo">
                <textarea
                    ref={ref}
                    className="text-editor"
                    value={a.text}
                    spellCheck
                    wrap="off"
                    placeholder="Type here"
                    onChange={(e) => onText?.(e.target.value)}
                    onBlur={() => onDone?.()}
                    onKeyDown={(e) => {
                        e.stopPropagation()
                        if (e.key === "Escape") (e.target as HTMLTextAreaElement).blur()
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{
                        fontFamily: FONT_CSS[a.font],
                        fontSize: a.fontSize,
                        lineHeight: LINE_HEIGHT,
                        color: a.color,
                        width: width + 4,
                        height: h + a.fontSize + 4,
                        padding: 2,
                    }}
                />
            </foreignObject>
        </g>
    )
}

/** Read-only rendering of a page's annotations (used for thumbnails). */
export function StaticAnnotations({ annots, m, width, height }: { annots: Ann[]; m: Matrix; width: number; height: number }) {
    if (!annots.length) return null
    const markups = annots.filter(isMarkup)
    return (
        <>
            <svg className="markup-layer" width={width} height={height}>
                <g transform={`matrix(${m.join(" ")})`}>
                    {markups.map((a) => (
                        <g key={a.id} opacity={a.type === "highlight" ? a.opacity : 1}>
                            <MarkupGraphic a={a} />
                        </g>
                    ))}
                </g>
            </svg>
            <svg className="ann-layer static" width={width} height={height}>
                <g transform={`matrix(${m.join(" ")})`}>
                    {annots.map((a) => (
                        <AnnGraphic key={a.id} a={a} />
                    ))}
                </g>
            </svg>
        </>
    )
}

export { isMarkup }
