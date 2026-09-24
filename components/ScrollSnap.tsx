import * as React from "react"
import { useRef, useState, useEffect, useCallback, useId } from "react"
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
// Same sizing options as a layer inside a Framer auto layout (stack).
type SizeType = "fixed" | "relative" | "fill" | "fit"

interface Props {
    sections: React.ReactNode[]
    direction: "vertical" | "horizontal"
    alignVertical: Align
    alignHorizontal: Align
    sectionSize: number
    sectionGap: number
    contentWidthType: SizeType
    contentWidthFixed: number
    contentWidthRelative: number
    contentHeightType: SizeType
    contentHeightFixed: number
    contentHeightRelative: number
    contentAlignX: Align
    contentAlignY: Align
    padding: string
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
// size; resize them to fill the section, or to the custom content size.
function resize(child: React.ReactNode, size: React.CSSProperties): React.ReactNode {
    if (!React.isValidElement(child)) return child
    const element = child as React.ReactElement<{ style?: React.CSSProperties }>
    return React.cloneElement(element, {
        style: {
            ...(element.props.style || {}),
            ...size,
        },
    })
}

function axisSize(
    axis: "width" | "height",
    type: SizeType,
    fixed: number,
    relative: number
): React.CSSProperties {
    switch (type) {
        case "fixed":
            return { [axis]: Math.max(0, fixed ?? 0) }
        case "relative":
            return { [axis]: `${Math.max(0, relative ?? 100)}%` }
        case "fit":
            return {}
        default:
            return { [axis]: "100%" }
    }
}

const flexAlign = { start: "flex-start", center: "center", end: "flex-end" } as const

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
        contentWidthType,
        contentWidthFixed,
        contentWidthRelative,
        contentHeightType,
        contentHeightFixed,
        contentHeightRelative,
        contentAlignX,
        contentAlignY,
        padding,
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
    const instanceId = useId()
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
    // Size of the layer inside each section, per axis, like a stack child:
    // Fixed = px, Relative = % of the section, Fill = the whole section,
    // Fit Content = leave the layer at its own size.
    const contentStyle: React.CSSProperties = {
        flexShrink: 0,
        ...axisSize("width", contentWidthType, contentWidthFixed, contentWidthRelative),
        ...axisSize("height", contentHeightType, contentHeightFixed, contentHeightRelative),
    }

    // Framer can size a connected layer through its own classes (e.g. a stack
    // set to Fit), which may beat the inline size above. Repeat the size as
    // an !important rule on the section's direct child so it always applies.
    const important = (axis: "width" | "height", value: React.CSSProperties["width"]) =>
        value === undefined
            ? ""
            : `${axis}:${typeof value === "number" ? `${value}px` : value} !important;` +
              `min-${axis}:0 !important;max-${axis}:none !important;`
    const contentCss = `[data-scroll-snap="${instanceId}"]>[data-scroll-snap-section]>*{flex-shrink:0 !important;${important(
        "width",
        contentStyle.width
    )}${important("height", contentStyle.height)}}`

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
            <style>{`.framer-scroll-snap::-webkit-scrollbar{display:none}${contentCss}`}</style>
            <div
                ref={scrollRef}
                className="framer-scroll-snap"
                data-scroll-snap={instanceId}
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
                        data-scroll-snap-section=""
                        ref={(el) => {
                            sectionRefs.current[index] = el
                        }}
                        style={{
                            position: "relative",
                            flex: `0 0 ${size}%`,
                            [isVertical ? "width" : "height"]: "100%",
                            [isVertical ? "marginTop" : "marginLeft"]: index > 0 ? gap : 0,
                            overflow: "hidden",
                            boxSizing: "border-box",
                            padding,
                            display: "flex",
                            justifyContent: flexAlign[contentAlignX] || "center",
                            alignItems: flexAlign[contentAlignY] || "center",
                            scrollSnapAlign: align,
                            scrollSnapStop: "always",
                        }}
                    >
                        {resize(section, contentStyle)}
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
    contentWidthType: {
        type: ControlType.Enum,
        title: "Content Width",
        options: ["fixed", "relative", "fill", "fit"],
        optionTitles: ["Fixed", "Relative", "Fill", "Fit Content"],
        defaultValue: "fill",
    },
    contentWidthFixed: {
        type: ControlType.Number,
        title: " ",
        defaultValue: 600,
        min: 0,
        max: 10000,
        step: 1,
        unit: "px",
        hidden: (props: Props) => props.contentWidthType !== "fixed",
    },
    contentWidthRelative: {
        type: ControlType.Number,
        title: " ",
        defaultValue: 80,
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
        hidden: (props: Props) => props.contentWidthType !== "relative",
    },
    contentHeightType: {
        type: ControlType.Enum,
        title: "Content Height",
        options: ["fixed", "relative", "fill", "fit"],
        optionTitles: ["Fixed", "Relative", "Fill", "Fit Content"],
        defaultValue: "fill",
    },
    contentHeightFixed: {
        type: ControlType.Number,
        title: " ",
        defaultValue: 400,
        min: 0,
        max: 10000,
        step: 1,
        unit: "px",
        hidden: (props: Props) => props.contentHeightType !== "fixed",
    },
    contentHeightRelative: {
        type: ControlType.Number,
        title: " ",
        defaultValue: 80,
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
        hidden: (props: Props) => props.contentHeightType !== "relative",
    },
    contentAlignX: {
        type: ControlType.Enum,
        title: "Content X",
        options: ["start", "center", "end"],
        optionTitles: ["Left", "Center", "Right"],
        displaySegmentedControl: true,
        defaultValue: "center",
        hidden: (props: Props) =>
            props.contentWidthType === "fill" && props.contentHeightType === "fill",
    },
    contentAlignY: {
        type: ControlType.Enum,
        title: "Content Y",
        options: ["start", "center", "end"],
        optionTitles: ["Top", "Center", "Bottom"],
        displaySegmentedControl: true,
        defaultValue: "center",
        hidden: (props: Props) =>
            props.contentWidthType === "fill" && props.contentHeightType === "fill",
    },
    padding: {
        type: "padding" as ControlType,
        title: "Padding",
        defaultValue: "0px",
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
