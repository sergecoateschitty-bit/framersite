import { useEffect, useRef, useState, type ReactNode } from "react"
import type { PendingImage } from "../types"
import { Icon } from "./Icons"

export function Modal({ title, onClose, children, wide }: { title: string; onClose(): void; children: ReactNode; wide?: boolean }) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [onClose])
    return (
        <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className={`modal${wide ? " wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} onKeyDown={(e) => e.stopPropagation()}>
                <div className="modal-head">
                    <h2>{title}</h2>
                    <button className="icon-btn" onClick={onClose} aria-label="Close">
                        <Icon name="close" />
                    </button>
                </div>
                {children}
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Signatures

const SIG_KEY = "pdf-studio:signatures"

function loadSaved(): string[] {
    try {
        const v = JSON.parse(localStorage.getItem(SIG_KEY) ?? "[]")
        return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []
    } catch {
        return []
    }
}

function saveSaved(list: string[]) {
    try {
        localStorage.setItem(SIG_KEY, JSON.stringify(list.slice(0, 6)))
    } catch {
        // Storage unavailable (private mode etc.) — signatures just aren't remembered.
    }
}

function trimCanvas(src: HTMLCanvasElement): HTMLCanvasElement | null {
    const ctx = src.getContext("2d")!
    const { width, height } = src
    const data = ctx.getImageData(0, 0, width, height).data
    let x0 = width,
        y0 = height,
        x1 = -1,
        y1 = -1
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (data[(y * width + x) * 4 + 3] > 8) {
                if (x < x0) x0 = x
                if (x > x1) x1 = x
                if (y < y0) y0 = y
                if (y > y1) y1 = y
            }
        }
    }
    if (x1 < 0) return null
    const pad = 6
    x0 = Math.max(0, x0 - pad)
    y0 = Math.max(0, y0 - pad)
    x1 = Math.min(width - 1, x1 + pad)
    y1 = Math.min(height - 1, y1 + pad)
    const out = document.createElement("canvas")
    out.width = x1 - x0 + 1
    out.height = y1 - y0 + 1
    out.getContext("2d")!.drawImage(src, x0, y0, out.width, out.height, 0, 0, out.width, out.height)
    return out
}

function toPending(url: string, kind: PendingImage["kind"], targetWidth: number): Promise<PendingImage> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
            const w = Math.min(targetWidth, img.naturalWidth)
            resolve({ src: url, w, h: (w * img.naturalHeight) / img.naturalWidth, kind })
        }
        img.onerror = () => reject(new Error("Could not read that image."))
        img.src = url
    })
}

export function SignatureModal({ onClose, onDone }: { onClose(): void; onDone(p: PendingImage): void }) {
    const [mode, setMode] = useState<"draw" | "type" | "upload">("draw")
    const [saved, setSaved] = useState<string[]>(loadSaved)
    const [typed, setTyped] = useState("")
    const [font, setFont] = useState(0)
    const [inkColor, setInkColor] = useState("#1a2b6d")
    const [remember, setRemember] = useState(true)
    const canvas = useRef<HTMLCanvasElement>(null)
    const drawing = useRef<{ x: number; y: number } | null>(null)
    const [hasInk, setHasInk] = useState(false)
    const [upload, setUpload] = useState<string | null>(null)
    const fonts = ["'Dancing Script', 'Segoe Script', 'Brush Script MT', cursive", "'Caveat', 'Bradley Hand', cursive", "'Great Vibes', 'Snell Roundhand', cursive"]

    useEffect(() => {
        const c = canvas.current
        if (!c) return
        const k = window.devicePixelRatio || 1
        c.width = c.clientWidth * k
        c.height = c.clientHeight * k
        const ctx = c.getContext("2d")!
        ctx.scale(k, k)
        ctx.lineCap = "round"
        ctx.lineJoin = "round"
        setHasInk(false)
    }, [mode])

    const pos = (e: React.PointerEvent) => {
        const r = canvas.current!.getBoundingClientRect()
        return { x: e.clientX - r.left, y: e.clientY - r.top }
    }

    const finish = async (url: string) => {
        if (remember && !saved.includes(url)) saveSaved([url, ...saved])
        onDone(await toPending(url, "signature", 160))
    }

    const create = async () => {
        if (mode === "draw") {
            const t = canvas.current && trimCanvas(canvas.current)
            if (t) await finish(t.toDataURL("image/png"))
        } else if (mode === "type") {
            if (!typed.trim()) return
            await document.fonts?.ready
            const c = document.createElement("canvas")
            const ctx = c.getContext("2d")!
            const size = 120
            ctx.font = `${size}px ${fonts[font]}`
            const w = ctx.measureText(typed).width
            c.width = Math.ceil(w + 40)
            c.height = Math.ceil(size * 1.6)
            ctx.font = `${size}px ${fonts[font]}`
            ctx.fillStyle = inkColor
            ctx.textBaseline = "middle"
            ctx.fillText(typed, 20, c.height / 2)
            const t = trimCanvas(c)
            if (t) await finish(t.toDataURL("image/png"))
        } else if (upload) {
            await finish(upload)
        }
    }

    return (
        <Modal title="Add signature" onClose={onClose} wide>
            {saved.length > 0 && (
                <div className="saved-sigs">
                    <span className="muted">Saved signatures</span>
                    <div className="saved-row">
                        {saved.map((s) => (
                            <div key={s} className="saved-sig">
                                <button onClick={async () => onDone(await toPending(s, "signature", 160))} title="Use this signature">
                                    <img src={s} alt="Saved signature" />
                                </button>
                                <button
                                    className="icon-btn tiny"
                                    title="Remove"
                                    onClick={() => {
                                        const next = saved.filter((x) => x !== s)
                                        setSaved(next)
                                        saveSaved(next)
                                    }}
                                >
                                    <Icon name="close" size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            <div className="segmented">
                {(["draw", "type", "upload"] as const).map((m) => (
                    <button key={m} className={mode === m ? "active" : ""} onClick={() => setMode(m)}>
                        {m[0].toUpperCase() + m.slice(1)}
                    </button>
                ))}
            </div>
            {mode === "draw" && (
                <div className="sig-pad-wrap">
                    <canvas
                        ref={canvas}
                        className="sig-pad"
                        onPointerDown={(e) => {
                            canvas.current!.setPointerCapture(e.pointerId)
                            drawing.current = pos(e)
                        }}
                        onPointerMove={(e) => {
                            if (!drawing.current) return
                            const p = pos(e)
                            const ctx = canvas.current!.getContext("2d")!
                            ctx.strokeStyle = inkColor
                            ctx.lineWidth = 2.6
                            ctx.beginPath()
                            ctx.moveTo(drawing.current.x, drawing.current.y)
                            ctx.lineTo(p.x, p.y)
                            ctx.stroke()
                            drawing.current = p
                            setHasInk(true)
                        }}
                        onPointerUp={() => (drawing.current = null)}
                    />
                    <div className="sig-line">Sign above</div>
                    <button
                        className="btn ghost small sig-clear"
                        onClick={() => {
                            const c = canvas.current!
                            c.getContext("2d")!.clearRect(0, 0, c.width, c.height)
                            setHasInk(false)
                        }}
                    >
                        Clear
                    </button>
                </div>
            )}
            {mode === "type" && (
                <div className="sig-type">
                    <input
                        className="input big"
                        autoFocus
                        placeholder="Type your name"
                        value={typed}
                        onChange={(e) => setTyped(e.target.value)}
                    />
                    <div className="sig-fonts">
                        {fonts.map((f, i) => (
                            <button key={f} className={font === i ? "active" : ""} style={{ fontFamily: f, color: inkColor }} onClick={() => setFont(i)}>
                                {typed || "Your Name"}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {mode === "upload" && (
                <div className="sig-upload">
                    {upload ? <img src={upload} alt="Uploaded signature" /> : <p className="muted">PNG or JPEG, ideally on a transparent or white background.</p>}
                    <label className="btn">
                        Choose image
                        <input
                            type="file"
                            accept="image/png,image/jpeg"
                            hidden
                            onChange={async (e) => {
                                const f = e.target.files?.[0]
                                if (f) setUpload(await readAsDataUrl(f))
                            }}
                        />
                    </label>
                </div>
            )}
            <div className="modal-foot">
                {mode !== "upload" && (
                    <div className="ink-colors">
                        {["#111111", "#1a2b6d", "#1d4ed8", "#b91c1c"].map((c) => (
                            <button
                                key={c}
                                className={`swatch${c === inkColor ? " active" : ""}`}
                                style={{ background: c }}
                                onClick={() => setInkColor(c)}
                                aria-label={`Ink ${c}`}
                            />
                        ))}
                    </div>
                )}
                <label className="check">
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember
                </label>
                <div className="spacer" />
                <button className="btn ghost" onClick={onClose}>
                    Cancel
                </button>
                <button
                    className="btn primary"
                    disabled={(mode === "draw" && !hasInk) || (mode === "type" && !typed.trim()) || (mode === "upload" && !upload)}
                    onClick={create}
                >
                    Place signature
                </button>
            </div>
        </Modal>
    )
}

export function readAsDataUrl(file: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result))
        r.onerror = () => reject(r.error)
        r.readAsDataURL(file)
    })
}

/** Convert any browser-decodable image to PNG/JPEG data URL pdf-lib can embed. */
export async function imageFileToPending(file: File): Promise<PendingImage> {
    let url = await readAsDataUrl(file)
    if (!/^data:image\/(png|jpe?g);/.test(url)) {
        const img = await new Promise<HTMLImageElement>((res, rej) => {
            const i = new Image()
            i.onload = () => res(i)
            i.onerror = () => rej(new Error("Unsupported image format."))
            i.src = url
        })
        const c = document.createElement("canvas")
        c.width = img.naturalWidth
        c.height = img.naturalHeight
        c.getContext("2d")!.drawImage(img, 0, 0)
        url = c.toDataURL("image/png")
    }
    return toPending(url, "image", 240)
}

// ---------------------------------------------------------------------------
// Stamps

export const STAMPS: { label: string; color: string }[] = [
    { label: "APPROVED", color: "#15803d" },
    { label: "REVIEWED", color: "#1d4ed8" },
    { label: "DRAFT", color: "#6b7280" },
    { label: "CONFIDENTIAL", color: "#b91c1c" },
    { label: "FINAL", color: "#15803d" },
    { label: "NOT APPROVED", color: "#b91c1c" },
    { label: "FOR COMMENT", color: "#a16207" },
    { label: "VOID", color: "#b91c1c" },
]

export function makeStamp(label: string, color: string): PendingImage {
    const k = 4
    const fontSize = 18
    const ctx0 = document.createElement("canvas").getContext("2d")!
    ctx0.font = `800 ${fontSize}px Helvetica, Arial, sans-serif`
    const date = new Date().toLocaleDateString()
    const tw = Math.max(ctx0.measureText(label).width, 60)
    const w = tw + 28
    const h = fontSize + 26
    const c = document.createElement("canvas")
    c.width = w * k
    c.height = h * k
    const ctx = c.getContext("2d")!
    ctx.scale(k, k)
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.roundRect(2, 2, w - 4, h - 4, 6)
    ctx.globalAlpha = 0.08
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.stroke()
    ctx.font = `800 ${fontSize}px Helvetica, Arial, sans-serif`
    ctx.textAlign = "center"
    ctx.textBaseline = "alphabetic"
    ctx.fillText(label, w / 2, 8 + fontSize)
    ctx.font = `600 8px Helvetica, Arial, sans-serif`
    ctx.fillText(date, w / 2, h - 8)
    return { src: c.toDataURL("image/png"), w, h, kind: "stamp", label }
}

// ---------------------------------------------------------------------------

export function PasswordModal({ retry, onSubmit }: { retry: boolean; onSubmit(pw: string | null): void }) {
    const [pw, setPw] = useState("")
    return (
        <Modal title="Password required" onClose={() => onSubmit(null)}>
            <form
                onSubmit={(e) => {
                    e.preventDefault()
                    onSubmit(pw)
                }}
            >
                <p>{retry ? "Incorrect password. Try again." : "This document is protected. Enter the password to open it."}</p>
                <input className="input" type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} />
                <div className="modal-foot">
                    <div className="spacer" />
                    <button type="button" className="btn ghost" onClick={() => onSubmit(null)}>
                        Cancel
                    </button>
                    <button type="submit" className="btn primary">
                        Open
                    </button>
                </div>
            </form>
        </Modal>
    )
}

export function PropertiesModal({ rows, onClose }: { rows: [string, string][]; onClose(): void }) {
    return (
        <Modal title="Document properties" onClose={onClose}>
            <dl className="props">
                {rows.map(([k, v]) => (
                    <div key={k}>
                        <dt>{k}</dt>
                        <dd>{v || "—"}</dd>
                    </div>
                ))}
            </dl>
        </Modal>
    )
}

const SHORTCUTS: [string, string][] = [
    ["Ctrl/⌘ O", "Open file"],
    ["Ctrl/⌘ S", "Save (download)"],
    ["Ctrl/⌘ P", "Print"],
    ["Ctrl/⌘ F", "Find"],
    ["Ctrl/⌘ Z / Shift Z", "Undo / Redo"],
    ["Ctrl/⌘ + / −", "Zoom in / out"],
    ["Ctrl/⌘ 0", "Fit width"],
    ["Ctrl/⌘ wheel", "Zoom"],
    ["← → / PgUp PgDn", "Previous / next page"],
    ["Home / End", "First / last page"],
    ["Delete", "Delete selected annotation"],
    ["Esc", "Cancel / back to Select"],
    ["V  H", "Select / Hand tool"],
    ["U  T  N  D", "Highlight / Text / Note / Draw"],
    ["Shift while drawing", "Constrain shapes and lines"],
    ["Double-click text", "Edit added text"],
]

export function ShortcutsModal({ onClose }: { onClose(): void }) {
    return (
        <Modal title="Keyboard shortcuts" onClose={onClose}>
            <dl className="props shortcuts">
                {SHORTCUTS.map(([k, v]) => (
                    <div key={k}>
                        <dt>
                            <kbd>{k}</kbd>
                        </dt>
                        <dd>{v}</dd>
                    </div>
                ))}
            </dl>
        </Modal>
    )
}
