import { useCallback, useMemo, useReducer } from "react"
import type { DocState } from "./types"

interface History {
    past: DocState[]
    present: DocState
    future: DocState[]
    /** Snapshot taken when a live edit (drag, typing) started. */
    base: DocState | null
}

type Action =
    | { type: "reset"; state: DocState }
    | { type: "commit"; fn: (s: DocState) => DocState }
    | { type: "transient"; fn: (base: DocState) => DocState }
    | { type: "end" }
    | { type: "undo" }
    | { type: "redo" }

const LIMIT = 200
const EMPTY: DocState = { pages: [], annots: [] }

function reducer(h: History, action: Action): History {
    switch (action.type) {
        case "reset":
            return { past: [], present: action.state, future: [], base: null }
        case "commit": {
            const settled = h.base ? endLive(h) : h
            const next = action.fn(settled.present)
            if (next === settled.present) return settled
            return { past: [...settled.past, settled.present].slice(-LIMIT), present: next, future: [], base: null }
        }
        case "transient": {
            const base = h.base ?? h.present
            return { ...h, base, present: action.fn(base) }
        }
        case "end":
            return endLive(h)
        case "undo": {
            const settled = h.base ? endLive(h) : h
            if (!settled.past.length) return settled
            return {
                past: settled.past.slice(0, -1),
                present: settled.past[settled.past.length - 1],
                future: [settled.present, ...settled.future],
                base: null,
            }
        }
        case "redo": {
            if (!h.future.length) return h
            return {
                past: [...h.past, h.present],
                present: h.future[0],
                future: h.future.slice(1),
                base: null,
            }
        }
    }
}

function endLive(h: History): History {
    if (!h.base) return h
    if (h.base === h.present) return { ...h, base: null }
    return { past: [...h.past, h.base].slice(-LIMIT), present: h.present, future: [], base: null }
}

export interface DocStore {
    state: DocState
    canUndo: boolean
    canRedo: boolean
    dirty: boolean
    reset(state: DocState): void
    /** Apply an undoable change. */
    commit(fn: (s: DocState) => DocState): void
    /** Live-update during a gesture; `fn` always receives the pre-gesture state. */
    live(fn: (base: DocState) => DocState): void
    /** Finish a live gesture, recording one undo step. */
    endLive(): void
    undo(): void
    redo(): void
}

export function useDocStore(): DocStore {
    const [h, dispatch] = useReducer(reducer, { past: [], present: EMPTY, future: [], base: null })
    const reset = useCallback((state: DocState) => dispatch({ type: "reset", state }), [])
    const commit = useCallback((fn: (s: DocState) => DocState) => dispatch({ type: "commit", fn }), [])
    const live = useCallback((fn: (s: DocState) => DocState) => dispatch({ type: "transient", fn }), [])
    const end = useCallback(() => dispatch({ type: "end" }), [])
    const undo = useCallback(() => dispatch({ type: "undo" }), [])
    const redo = useCallback(() => dispatch({ type: "redo" }), [])
    return useMemo(
        () => ({
            state: h.present,
            canUndo: h.past.length > 0 || (h.base !== null && h.base !== h.present),
            canRedo: h.future.length > 0,
            dirty: h.past.length > 0 || h.base !== null,
            reset,
            commit,
            live,
            endLive: end,
            undo,
            redo,
        }),
        [h, reset, commit, live, end, undo, redo],
    )
}
