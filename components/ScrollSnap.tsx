import * as React from "react"
import { useRef, useState, useEffect, useCallback } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "framer"

/**
 * Scroll Snap
 *
 * A scrolling container that snaps from section to section. Connect any
 * number of layers (frames, stacks, components) as "Sections": each one is
 * stretched to the size of the container, and scrolling inside the
 * component snaps to the next/previous section. A custom scrollbar on the
 * edge gives visual feedback of where you are.
 *
 * The container can be any size — set it to Fill (100vw × 100vh) for a
 * full-screen, presentation-style page.
 */

type Align = "start" | "center" | "end"

interface Props {
    sections: React.ReactNode[]
    direction: "vertical" | "horizontal"
    alignVertical: Align
    alignHorizontal: Align
    sectionSize: number
    sectionGap: number
    snapStrength: "mandatory" | "proximity"
    onePerScroll: boolean
    transitionDuration: number
    showScrollbar: boolean
    scrollbarPosition: "end" | "start"
    scrollbarColor: string
    scrollbarTrackColor: string
    scrollbarWidth: number
    scrollbarInset: number
    scrollbarRadius: number
    backgroundColor: string
    keyboard: boolean
    style?: React.CSSProperties
}

// Framer hands connected layers over as elements sized to their canvas
// size; force them to fill the section instead.
function stretch(child: React.ReactNode): React.ReactNode {
    if (!React.isValidElement(child)) return child
    const element = child as React.ReactElement<{ style?: React.CSSProperties }>
    return React.cloneElement(element, {
        style: {
            ...(element.props.style || {}),
            width: "100%",
            height: "100%",
        },
    })
}

function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export default function ScrollSnap(props: Props) {
    const {
        sections,
        direction,
        alignVertical,
        alignHorizontal,
        sectionSize,
        sectionGap,
        snapStrength,
        onePerScroll,
        transitionDuration,
        showScrollbar,
        scrollbarPosition,
        scrollbarColor,
        scrollbarTrackColor,
        scrollbarWidth,
        scrollbarInset,
        scrollbarRadius,
        backgroundColor,
        keyboard,
        style,
    } = props

    const isVertical = direction === "vertical"
    const align: Align = (isVertical ? alignVertical : alignHorizontal) || "start"
    const size = Math.max(10, Math.min(100, sectionSize ?? 100))
    const gap = Math.max(0, sectionGap || 0)
    const isCanvas = RenderTarget.current() === RenderTarget.canvas
    const items = (sections || []).filter(Boolean)
    const count = items.length

    const scrollRef = useRef<HTMLDivElement>(null)
    const sectionRefs = useRef<(HTMLDivElement | null)[]>([])
    const animating = useRef(false)
    const frame = useRef<number | null>(null)
    const [progress, setProgress] = useState(0)
    const [thumbFraction, setThumbFraction] = useState(1)

    // Scroll offset at which section `index` sits at the chosen alignment
    // (its start, center or end lined up with the container's).
    const targetFor = (index: number) => {
        const node = scrollRef.current
        const section = sectionRefs.current[index]
        if (!node || !section) return 0
        const viewport = isVertical ? node.clientHeight : node.clientWidth
        const offset = isVertical ? section.offsetTop : section.offsetLeft
        const length = isVertical ? section.offsetHeight : section.offsetWidth
        const shift =
            align === "center" ? (viewport - length) / 2 : align === "end" ? viewport - length : 0
        const max = isVertical
            ? node.scrollHeight - node.clientHeight
            : node.scrollWidth - node.clientWidth
        return Math.max(0, Math.min(max, offset - shift))
    }

    const currentIndex = () => {
        const node = scrollRef.current
        if (!node) return 0
        const offset = isVertical ? node.scrollTop : node.scrollLeft
        let best = 0
        let bestDistance = Infinity
        for (let i = 0; i < count; i++) {
            const distance = Math.abs(targetFor(i) - offset)
            if (distance < bestDistance) {
                best = i
                bestDistance = distance
            }
        }
        return best
    }

    const updateProgress = useCallback(() => {
        const node = scrollRef.current
        if (!node) return
        const total = isVertical ? node.scrollHeight : node.scrollWidth
        const visible = isVertical ? node.clientHeight : node.clientWidth
        const max = total - visible
        const offset = isVertical ? node.scrollTop : node.scrollLeft
        setProgress(max > 0 ? offset / max : 0)
        setThumbFraction(total > 0 ? Math.min(1, visible / total) : 1)
    }, [isVertical])

    // Animate to a section ourselves (instead of scrollTo smooth) so the
    // duration is controllable and so we know when the move has finished.
    const goTo = useCallback(
        (index: number) => {
            const node = scrollRef.current
            if (!node) return
            const target = targetFor(Math.max(0, Math.min(count - 1, index)))
            const from = isVertical ? node.scrollTop : node.scrollLeft
            const distance = target - from
            if (Math.abs(distance) < 1) return

            if (frame.current !== null) cancelAnimationFrame(frame.current)
            animating.current = true
            // Snap has to be off while animating or the browser fights us.
            node.style.scrollSnapType = "none"

            const duration = Math.max(0, transitionDuration) * 1000
            const start = performance.now()
            const step = (now: number) => {
                const t = duration === 0 ? 1 : Math.min(1, (now - start) / duration)
                const value = from + distance * easeInOutCubic(t)
                if (isVertical) node.scrollTop = value
                else node.scrollLeft = value
                if (t < 1) {
                    frame.current = requestAnimationFrame(step)
                } else {
                    frame.current = null
                    node.style.scrollSnapType = ""
                    animating.current = false
                }
            }
            frame.current = requestAnimationFrame(step)
        },
        [count, isVertical, align, transitionDuration]
    )

    // "One section per scroll": take over the wheel so a single flick of a
    // trackpad or mouse wheel moves exactly one section.
    useEffect(() => {
        const node = scrollRef.current
        if (!node || isCanvas || !onePerScroll) return

        let lastWheel = 0
        const onWheel = (event: WheelEvent) => {
            const delta =
                Math.abs(event.deltaY) >= Math.abs(event.deltaX)
                    ? event.deltaY
                    : event.deltaX
            if (Math.abs(delta) < 4) return

            const index = currentIndex()
            const next = index + (delta > 0 ? 1 : -1)
            // Let the page scroll on once we're past the first/last section.
            if (next < 0 || next > count - 1) return

            event.preventDefault()
            const now = performance.now()
            // Swallow the trackpad's inertia tail after a move.
            const quiet = now - lastWheel > 80
            lastWheel = now
            if (animating.current || !quiet) return
            goTo(next)
        }

        node.addEventListener("wheel", onWheel, { passive: false })
        return () => node.removeEventListener("wheel", onWheel)
    }, [isCanvas, onePerScroll, count, goTo])

    useEffect(() => {
        const node = scrollRef.current
        if (!node || isCanvas || !keyboard) return

        const onKey = (event: KeyboardEvent) => {
            const forward = isVertical
                ? ["ArrowDown", "PageDown", " "]
                : ["ArrowRight", "PageDown", " "]
            const backward = isVertical
                ? ["ArrowUp", "PageUp"]
                : ["ArrowLeft", "PageUp"]
            let next: number | null = null
            if (forward.includes(event.key) && !event.shiftKey) next = currentIndex() + 1
            else if (backward.includes(event.key) || (event.key === " " && event.shiftKey))
                next = currentIndex() - 1
            else if (event.key === "Home") next = 0
            else if (event.key === "End") next = count - 1
            if (next === null) return
            event.preventDefault()
            goTo(next)
        }

        node.addEventListener("keydown", onKey)
        return () => node.removeEventListener("keydown", onKey)
    }, [isCanvas, keyboard, isVertical, count, goTo])

    // Keep the current section aligned when the container is resized.
    useEffect(() => {
        const node = scrollRef.current
        if (!node || typeof ResizeObserver === "undefined") return
        let lastIndex = 0
        const onScroll = () => {
            if (!animating.current) lastIndex = currentIndex()
        }
        const observer = new ResizeObserver(() => {
            const offset = targetFor(lastIndex)
            if (isVertical) node.scrollTop = offset
            else node.scrollLeft = offset
            updateProgress()
        })
        node.addEventListener("scroll", onScroll, { passive: true })
        observer.observe(node)
        return () => {
            node.removeEventListener("scroll", onScroll)
            observer.disconnect()
        }
    }, [isVertical, align, count, updateProgress])

    // Start on the first section, lined up with the chosen alignment.
    useEffect(() => {
        const node = scrollRef.current
        if (!node) return
        const offset = targetFor(0)
        if (isVertical) node.scrollTop = offset
        else node.scrollLeft = offset
        updateProgress()
    }, [isVertical, align, size, gap, count])

    useEffect(() => {
        updateProgress()
        return () => {
            if (frame.current !== null) cancelAnimationFrame(frame.current)
        }
    }, [updateProgress, count])

    if (count === 0) {
        return (
            <div
                style={{
                    ...style,
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: 16,
                    boxSizing: "border-box",
                    textAlign: "center",
                    background: "rgba(136, 85, 255, 0.1)",
                    border: "1px dashed rgba(136, 85, 255, 0.6)",
                    borderRadius: 8,
                    color: "#8855FF",
                    fontFamily: "Inter, system-ui, sans-serif",
                    fontSize: 12,
                    lineHeight: 1.5,
                }}
            >
                <strong style={{ fontSize: 14 }}>Scroll Snap</strong>
                <span>Connect layers to “Sections” in the properties panel.</span>
            </div>
        )
    }

    // Thumb length = visible fraction of the content; it travels along the
    // track as you scroll.
    const thumbOffset = progress * (1 - thumbFraction)
    // Empty space before the first / after the last section so that every
    // section — including the ends — can reach the chosen alignment.
    const free = 100 - size
    const leadSpace = align === "center" ? free / 2 : align === "end" ? free : 0
    const trailSpace = align === "center" ? free / 2 : align === "start" ? free : 0
    const spacerStyle = (percent: number): React.CSSProperties => ({
        flex: `0 0 ${percent}%`,
        pointerEvents: "none",
    })

    const edge = scrollbarPosition === "end" ? (isVertical ? "right" : "bottom") : isVertical ? "left" : "top"

    return (
        <div
            style={{
                ...style,
                position: "relative",
                width: "100%",
                height: "100%",
                overflow: "hidden",
                backgroundColor,
            }}
        >
            <style>{`.framer-scroll-snap::-webkit-scrollbar{display:none}`}</style>
            <div
                ref={scrollRef}
                className="framer-scroll-snap"
                tabIndex={keyboard ? 0 : undefined}
                onScroll={updateProgress}
                style={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: isVertical ? "column" : "row",
                    overflowX: isVertical ? "hidden" : "auto",
                    overflowY: isVertical ? "auto" : "hidden",
                    scrollSnapType: isCanvas
                        ? undefined
                        : `${isVertical ? "y" : "x"} ${snapStrength}`,
                    overscrollBehavior: "contain",
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                    WebkitOverflowScrolling: "touch",
                    outline: "none",
                } as React.CSSProperties}
            >
                {leadSpace > 0 && <div aria-hidden style={spacerStyle(leadSpace)} />}
                {items.map((section, index) => (
                    <div
                        key={index}
                        ref={(el) => {
                            sectionRefs.current[index] = el
                        }}
                        style={{
                            position: "relative",
                            flex: `0 0 ${size}%`,
                            [isVertical ? "width" : "height"]: "100%",
                            [isVertical ? "marginTop" : "marginLeft"]: index > 0 ? gap : 0,
                            overflow: "hidden",
                            scrollSnapAlign: align,
                            scrollSnapStop: "always",
                        }}
                    >
                        {stretch(section)}
                    </div>
                ))}
                {trailSpace > 0 && <div aria-hidden style={spacerStyle(trailSpace)} />}
            </div>

            {showScrollbar && count > 1 && (
                <div
                    aria-hidden
                    style={{
                        position: "absolute",
                        pointerEvents: "none",
                        backgroundColor: scrollbarTrackColor,
                        borderRadius: scrollbarRadius,
                        [edge]: scrollbarInset,
                        ...(isVertical
                            ? {
                                  top: scrollbarInset,
                                  bottom: scrollbarInset,
                                  width: scrollbarWidth,
                              }
                            : {
                                  left: scrollbarInset,
                                  right: scrollbarInset,
                                  height: scrollbarWidth,
                              }),
                    }}
                >
                    <div
                        style={{
                            position: "absolute",
                            backgroundColor: scrollbarColor,
                            borderRadius: scrollbarRadius,
                            ...(isVertical
                                ? {
                                      left: 0,
                                      right: 0,
                                      top: `${thumbOffset * 100}%`,
                                      height: `${thumbFraction * 100}%`,
                                  }
                                : {
                                      top: 0,
                                      bottom: 0,
                                      left: `${thumbOffset * 100}%`,
                                      width: `${thumbFraction * 100}%`,
                                  }),
                        }}
                    />
                </div>
            )}
        </div>
    )
}

ScrollSnap.displayName = "Scroll Snap"

addPropertyControls(ScrollSnap, {
    sections: {
        type: ControlType.Array,
        title: "Sections",
        control: { type: ControlType.ComponentInstance },
    },
    direction: {
        type: ControlType.Enum,
        title: "Direction",
        options: ["vertical", "horizontal"],
        optionTitles: ["Vertical", "Horizontal"],
        displaySegmentedControl: true,
        defaultValue: "vertical",
    },
    alignVertical: {
        type: ControlType.Enum,
        title: "Align",
        options: ["start", "center", "end"],
        optionTitles: ["Top", "Center", "Bottom"],
        displaySegmentedControl: true,
        defaultValue: "start",
        hidden: (props: Props) => props.direction !== "vertical",
    },
    alignHorizontal: {
        type: ControlType.Enum,
        title: "Align",
        options: ["start", "center", "end"],
        optionTitles: ["Left", "Center", "Right"],
        displaySegmentedControl: true,
        defaultValue: "start",
        hidden: (props: Props) => props.direction !== "horizontal",
    },
    sectionSize: {
        type: ControlType.Number,
        title: "Section Size",
        defaultValue: 100,
        min: 10,
        max: 100,
        step: 1,
        unit: "%",
    },
    sectionGap: {
        type: ControlType.Number,
        title: "Gap",
        defaultValue: 0,
        min: 0,
        max: 500,
        step: 1,
    },
    snapStrength: {
        type: ControlType.Enum,
        title: "Snap",
        options: ["mandatory", "proximity"],
        optionTitles: ["Always", "Nearby"],
        displaySegmentedControl: true,
        defaultValue: "mandatory",
    },
    onePerScroll: {
        type: ControlType.Boolean,
        title: "One Per Scroll",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
    transitionDuration: {
        type: ControlType.Number,
        title: "Duration",
        defaultValue: 0.7,
        min: 0,
        max: 3,
        step: 0.05,
        unit: "s",
        hidden: (props: Props) => !props.onePerScroll && !props.keyboard,
    },
    keyboard: {
        type: ControlType.Boolean,
        title: "Keyboard",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "rgba(0,0,0,0)",
    },
    showScrollbar: {
        type: ControlType.Boolean,
        title: "Scrollbar",
        defaultValue: true,
        enabledTitle: "Show",
        disabledTitle: "Hide",
    },
    scrollbarColor: {
        type: ControlType.Color,
        title: "Scrollbar Color",
        defaultValue: "rgba(0,0,0,0.5)",
        hidden: (props: Props) => !props.showScrollbar,
    },
    scrollbarTrackColor: {
        type: ControlType.Color,
        title: "Track Color",
        defaultValue: "rgba(0,0,0,0.08)",
        hidden: (props: Props) => !props.showScrollbar,
    },
    scrollbarWidth: {
        type: ControlType.Number,
        title: "Scrollbar Width",
        defaultValue: 4,
        min: 1,
        max: 40,
        step: 1,
        displayStepper: true,
        hidden: (props: Props) => !props.showScrollbar,
    },
    scrollbarInset: {
        type: ControlType.Number,
        title: "Inset",
        defaultValue: 8,
        min: 0,
        max: 100,
        step: 1,
        hidden: (props: Props) => !props.showScrollbar,
    },
    scrollbarRadius: {
        type: ControlType.Number,
        title: "Radius",
        defaultValue: 4,
        min: 0,
        max: 40,
        step: 1,
        hidden: (props: Props) => !props.showScrollbar,
    },
    scrollbarPosition: {
        type: ControlType.Enum,
        title: "Position",
        options: ["end", "start"],
        optionTitles: ["Right / Bottom", "Left / Top"],
        defaultValue: "end",
        hidden: (props: Props) => !props.showScrollbar,
    },
} as any)
