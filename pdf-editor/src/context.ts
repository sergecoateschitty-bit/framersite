import { createContext, useContext } from "react"
import type { LinkService } from "./pdf"
import type { DocStore } from "./store"
import type { PendingImage, SearchMatch, SourceDoc, Tool, ToolStyle } from "./types"

export interface EditorCtx {
    store: DocStore
    sources: Map<string, SourceDoc>
    linkServices: Map<string, LinkService>
    tool: Tool
    setTool(t: Tool): void
    style: ToolStyle
    scale: number
    viewRot: number
    author: string
    selectedId: string | null
    setSelectedId(id: string | null): void
    editingId: string | null
    setEditingId(id: string | null): void
    openNoteId: string | null
    setOpenNoteId(id: string | null): void
    pendingImage: PendingImage | null
    setPendingImage(p: PendingImage | null): void
    search: { matches: SearchMatch[]; current: number }
}

export const EditorContext = createContext<EditorCtx | null>(null)

export function useEditor(): EditorCtx {
    const ctx = useContext(EditorContext)
    if (!ctx) throw new Error("EditorContext missing")
    return ctx
}

export const MARKUP_TOOLS: Tool[] = ["highlight", "underline", "strikeout"]
export const DRAW_TOOLS: Tool[] = ["ink", "rect", "ellipse", "line", "arrow", "whiteout"]
export const PLACE_TOOLS: Tool[] = ["text", "note", "signature", "image", "stamp"]
