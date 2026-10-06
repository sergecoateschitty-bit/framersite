import { useEditor } from "../context"
import type { Ann, FontKey, Tool, ToolStyle } from "../types"
import { Icon } from "./Icons"
import { TYPE_LABEL } from "./Sidebar"

const PALETTE = ["#111111", "#dc2626", "#ea580c", "#ffd400", "#16a34a", "#0891b2", "#1d4ed8", "#7c3aed", "#db2777", "#ffffff"]

const HINTS: Partial<Record<Tool, string>> = {
    select: "Select text, or click an annotation to move, resize or edit it. Double-click added text to edit.",
    hand: "Drag to scroll the document.",
    highlight: "Select text to highlight it. On scanned pages, drag a box.",
    underline: "Select text to underline it.",
    strikeout: "Select text to strike it through.",
    ink: "Draw freehand on the page.",
    text: "Click where you want to add text.",
    note: "Click to place a sticky note.",
    rect: "Drag to draw a rectangle. Hold Shift for a square.",
    ellipse: "Drag to draw an ellipse. Hold Shift for a circle.",
    line: "Drag to draw a line. Hold Shift to snap to 45°.",
    arrow: "Drag to draw an arrow. Hold Shift to snap to 45°.",
    whiteout: "Drag over content to cover it with white.",
    signature: "Click on the page to place your signature.",
    image: "Click on the page to place the image.",
    stamp: "Click on the page to place the stamp.",
}

type Field = "color" | "fill" | "width" | "opacity" | "font" | "fontSize"

function fieldsFor(kind: Tool | Ann["type"]): Field[] {
    switch (kind) {
        case "highlight":
            return ["color", "opacity"]
        case "underline":
        case "strikeout":
        case "note":
            return ["color"]
        case "ink":
        case "line":
        case "arrow":
            return ["color", "width", "opacity"]
        case "rect":
        case "ellipse":
            return ["color", "fill", "width", "opacity"]
        case "text":
            return ["color", "font", "fontSize"]
        default:
            return []
    }
}

interface Props {
    style: ToolStyle
    onStyle(patch: Partial<ToolStyle>): void
    selected: Ann | null
    onDeleteSelected(): void
}

export function ToolOptions({ style, onStyle, selected, onDeleteSelected }: Props) {
    const ed = useEditor()
    const kind = selected ? selected.type : ed.tool
    const fields = fieldsFor(kind)

    // Values come from the selected annotation when there is one.
    const value = (f: Field): string | number | null => {
        if (selected) {
            if (f === "fontSize") return selected.type === "text" ? selected.fontSize : style.fontSize
            const v = (selected as unknown as Record<string, unknown>)[f]
            return (v as string | number | null | undefined) ?? null
        }
        return style[f]
    }

    const set = (patch: Partial<ToolStyle>, liveOnly = false) => {
        onStyle(patch)
        if (!selected) return
        const apply = (s: { annots: Ann[]; pages: unknown[] }) => ({
            ...s,
            annots: s.annots.map((a) => (a.id === selected.id ? ({ ...a, ...patch } as Ann) : a)),
        })
        if (liveOnly) ed.store.live((s) => apply(s) as typeof s)
        else ed.store.commit((s) => apply(s) as typeof s)
    }

    return (
        <div className="tool-options">
            {selected ? (
                <span className="tool-name">
                    {selected.type === "image" && selected.kind !== "image"
                        ? selected.kind[0].toUpperCase() + selected.kind.slice(1)
                        : TYPE_LABEL[selected.type]}
                </span>
            ) : (
                <span className="hint">{HINTS[ed.tool]}</span>
            )}
            <div className="spacer" />
            {fields.includes("color") && (
                <div className="opt">
                    <span className="opt-label">{fields.includes("fill") ? "Stroke" : "Color"}</span>
                    <Swatches value={String(value("color") ?? "")} onPick={(c) => set({ color: c })} />
                </div>
            )}
            {fields.includes("fill") && (
                <div className="opt">
                    <span className="opt-label">Fill</span>
                    <button
                        className={`swatch none${value("fill") === null ? " active" : ""}`}
                        title="No fill"
                        onClick={() => set({ fill: null })}
                    />
                    <Swatches value={String(value("fill") ?? "")} onPick={(c) => set({ fill: c })} compact />
                </div>
            )}
            {fields.includes("width") && (
                <label className="opt">
                    <span className="opt-label">Width</span>
                    <input
                        type="range"
                        min={0.5}
                        max={16}
                        step={0.5}
                        value={Number(value("width") ?? 2)}
                        onChange={(e) => set({ width: Number(e.target.value) }, true)}
                        onPointerUp={() => ed.store.endLive()}
                        onKeyUp={() => ed.store.endLive()}
                    />
                    <span className="opt-value">{Number(value("width") ?? 2)}pt</span>
                </label>
            )}
            {fields.includes("opacity") && (
                <label className="opt">
                    <span className="opt-label">Opacity</span>
                    <input
                        type="range"
                        min={0.1}
                        max={1}
                        step={0.05}
                        value={Number(value("opacity") ?? 1)}
                        onChange={(e) => set({ opacity: Number(e.target.value) }, true)}
                        onPointerUp={() => ed.store.endLive()}
                        onKeyUp={() => ed.store.endLive()}
                    />
                    <span className="opt-value">{Math.round(Number(value("opacity") ?? 1) * 100)}%</span>
                </label>
            )}
            {fields.includes("font") && (
                <select
                    className="select"
                    value={String(value("font") ?? "helvetica")}
                    onChange={(e) => set({ font: e.target.value as FontKey })}
                    aria-label="Font"
                >
                    <option value="helvetica">Helvetica</option>
                    <option value="times">Times</option>
                    <option value="courier">Courier</option>
                </select>
            )}
            {fields.includes("fontSize") && (
                <select
                    className="select"
                    value={Math.round(Number(value("fontSize") ?? 12))}
                    onChange={(e) => set({ fontSize: Number(e.target.value) })}
                    aria-label="Font size"
                >
                    {[6, 8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64, 72]
                        .concat([Math.round(Number(value("fontSize") ?? 12))])
                        .filter((v, i, arr) => arr.indexOf(v) === i)
                        .sort((a, b) => a - b)
                        .map((s) => (
                            <option key={s} value={s}>
                                {s} pt
                            </option>
                        ))}
                </select>
            )}
            {selected && (
                <button className="btn ghost small danger" onClick={onDeleteSelected} title="Delete (Del)">
                    <Icon name="trash" size={15} /> Delete
                </button>
            )}
        </div>
    )
}

function Swatches({ value, onPick, compact }: { value: string; onPick(c: string): void; compact?: boolean }) {
    const list = compact ? PALETTE.filter((_, i) => i % 2 === 0 || i === 3) : PALETTE
    return (
        <div className="swatches">
            {list.map((c) => (
                <button
                    key={c}
                    className={`swatch${value.toLowerCase() === c ? " active" : ""}`}
                    style={{ background: c }}
                    onClick={() => onPick(c)}
                    aria-label={`Color ${c}`}
                    title={c}
                />
            ))}
            <label className="swatch custom" title="Custom color">
                <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"} onChange={(e) => onPick(e.target.value)} />
            </label>
        </div>
    )
}
