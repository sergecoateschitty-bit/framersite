import { memo, useEffect, useRef, useState } from "react"
import { pageSize, viewportFor } from "../geometry"
import type { Ann, PageRef, SourceDoc } from "../types"
import { StaticAnnotations } from "./AnnGraphics"

const cache = new Map<string, string>()

async function renderThumb(src: SourceDoc, page: PageRef, rotation: number, width: number): Promise<string> {
    const key = `${src.id}:${page.srcIndex}:${rotation}:${width}`
    const hit = cache.get(key)
    if (hit) return hit
    const pdfPage = await src.proxy.getPage(page.srcIndex + 1)
    const [w] = pageSize(page.view, rotation)
    const viewport = pdfPage.getViewport({ scale: width / w, rotation })
    const k = Math.min(2, window.devicePixelRatio || 1)
    const canvas = document.createElement("canvas")
    canvas.width = Math.ceil(viewport.width * k)
    canvas.height = Math.ceil(viewport.height * k)
    await pdfPage.render({ canvas, viewport, transform: k !== 1 ? [k, 0, 0, k, 0, 0] : undefined }).promise
    const url = canvas.toDataURL("image/jpeg", 0.85)
    cache.set(key, url)
    return url
}

interface Props {
    page: PageRef
    src: SourceDoc | undefined
    annots: Ann[]
    width: number
    rotation: number
}

/** Small lazily rendered preview of a page, including its markup. */
export const Thumbnail = memo(function Thumbnail({ page, src, annots, width, rotation }: Props) {
    const ref = useRef<HTMLDivElement>(null)
    const [url, setUrl] = useState<string | null>(null)
    const [near, setNear] = useState(false)
    const [w, h] = pageSize(page.view, rotation)
    const scale = width / w
    const height = h * scale

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "400px" })
        io.observe(el)
        return () => io.disconnect()
    }, [])

    useEffect(() => {
        if (!near || !src) return
        let alive = true
        renderThumb(src, page, rotation, Math.round(width)).then(
            (u) => alive && setUrl(u),
            () => {},
        )
        return () => {
            alive = false
        }
    }, [near, src, page, rotation, width])

    const vp = viewportFor(page.view, scale, rotation)
    return (
        <div ref={ref} className="thumb" style={{ width, height }}>
            {url ? <img src={url} alt="" draggable={false} /> : <div className={src ? "thumb-loading" : "thumb-blank"} />}
            <StaticAnnotations annots={annots} m={vp.m} width={vp.width} height={vp.height} />
        </div>
    )
})
