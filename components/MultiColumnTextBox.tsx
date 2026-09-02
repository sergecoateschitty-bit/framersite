import * as React from "react"
import { useRef, useState, useLayoutEffect, useMemo } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "framer"

/**
 * Multi-Column Text Box
 *
 * A text component that lays its content out in CSS columns and stays
 * readable as the layer is resized on the canvas: the column count adapts
 * to the available width (native CSS `column-width` behavior) and, when
 * "Fluid Type" is on, the font size scales smoothly between a min/max
 * bound relative to the box's own measured width — so the block looks
 * right whether it's small in a sidebar or huge on a hero section,
 * instead of relying on a single fixed viewport breakpoint.
 */

const DEFAULT_TEXT =
    "Multi-column text boxes let long-form copy read comfortably at any width. " +
    "Resize this layer and watch the column count and type size adapt automatically.\n\n" +
    "Drop your own copy in from the properties panel — paragraphs (separated by a blank line) " +
    "flow naturally from one column to the next, just like a printed newspaper or magazine layout."

function clampNumber(min: number, value: number, max: number): number {
    if (min > max) return min
    return Math.min(max, Math.max(min, value))
}

interface FontControlValue {
    fontFamily?: string
    fontStyle?: string
    fontWeight?: number | string
    fontVariationSettings?: string
    letterSpacing?: number | string
    lineHeight?: number | string
}

interface Props {
    width?: number
    height?: number
    content: string
    font: FontControlValue
    color: string
    textAlign: "left" | "center" | "right" | "justify"
    fluidType: boolean
    fontSize: number
    minFontSize: number
    maxFontSize: number
    referenceWidth: number
    columnMode: "auto" | "fixed"
    minColumnWidth: number
    columnCount: number
    columnGap: number
    showRule: boolean
    ruleWidth: number
    ruleColor: string
    paragraphSpacing: number
    padding: string
    hyphenate: boolean
    overflowMode: "clip" | "scroll"
}

export default function MultiColumnTextBox(props: Props) {
    const {
        content,
        font,
        color,
        textAlign,
        fluidType,
        fontSize,
        minFontSize,
        maxFontSize,
        referenceWidth,
        columnMode,
        minColumnWidth,
        columnCount,
        columnGap,
        showRule,
        ruleWidth,
        ruleColor,
        paragraphSpacing,
        padding,
        hyphenate,
        overflowMode,
    } = props

    const containerRef = useRef<HTMLDivElement>(null)
    const [measuredWidth, setMeasuredWidth] = useState(props.width || referenceWidth)

    useLayoutEffect(() => {
        const node = containerRef.current
        if (!node || typeof ResizeObserver === "undefined") return

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0]
            if (entry) setMeasuredWidth(entry.contentRect.width)
        })
        observer.observe(node)
        return () => observer.disconnect()
    }, [])

    const computedFontSize = useMemo(() => {
        if (!fluidType) return fontSize
        const scaled = (measuredWidth / Math.max(1, referenceWidth)) * fontSize
        return clampNumber(minFontSize, scaled, maxFontSize)
    }, [fluidType, fontSize, minFontSize, maxFontSize, referenceWidth, measuredWidth])

    const paragraphs = useMemo(
        () => (content || "").split(/\n{1,}/).filter((p) => p.length > 0),
        [content]
    )

    const isEmpty = paragraphs.length === 0
    const isCanvas = RenderTarget.current() === RenderTarget.canvas

    const columnStyle: React.CSSProperties =
        columnMode === "auto"
            ? { columnWidth: minColumnWidth, columnGap }
            : { columnCount: Math.max(1, Math.round(columnCount)), columnGap }

    if (showRule) {
        columnStyle.columnRuleWidth = ruleWidth
        columnStyle.columnRuleColor = ruleColor
        columnStyle.columnRuleStyle = "solid"
    }

    return (
        <div
            ref={containerRef}
            style={{
                width: "100%",
                height: "100%",
                boxSizing: "border-box",
                padding,
                overflowX: overflowMode === "scroll" ? "auto" : "hidden",
                overflowY: "hidden",
            }}
        >
            <div
                lang="en"
                style={{
                    ...columnStyle,
                    columnFill: "auto",
                    height: "100%",
                    width: "100%",
                    fontFamily: font?.fontFamily,
                    fontStyle: font?.fontStyle,
                    fontWeight: font?.fontWeight,
                    fontVariationSettings: font?.fontVariationSettings,
                    letterSpacing: font?.letterSpacing,
                    lineHeight: font?.lineHeight,
                    fontSize: computedFontSize,
                    color: isEmpty ? "rgba(0,0,0,0.35)" : color,
                    textAlign,
                    hyphens: hyphenate ? "auto" : "none",
                    WebkitHyphens: hyphenate ? "auto" : "none",
                    overflowWrap: "break-word",
                    wordBreak: "normal",
                }}
            >
                {isEmpty ? (
                    <p style={{ margin: 0, fontStyle: "italic" }}>
                        {isCanvas
                            ? "Multi-Column Text Box — add copy in the properties panel."
                            : ""}
                    </p>
                ) : (
                    paragraphs.map((paragraph, index) => (
                        <p
                            key={index}
                            style={{
                                margin: 0,
                                marginBottom:
                                    index < paragraphs.length - 1 ? paragraphSpacing : 0,
                                breakInside: "avoid",
                            }}
                        >
                            {paragraph}
                        </p>
                    ))
                )}
            </div>
        </div>
    )
}

MultiColumnTextBox.displayName = "Multi-Column Text Box"

// The published `framer` npm package's type declarations lag behind the
// current in-app Code Component API (e.g. they don't yet know about
// `ControlType.Padding` or the full set of Font control defaults). The
// object below matches what the real Framer editor expects at runtime;
// the cast just keeps local `tsc` from flagging those newer fields.
addPropertyControls(MultiColumnTextBox, {
    content: {
        type: ControlType.String,
        title: "Content",
        displayTextArea: true,
        defaultValue: DEFAULT_TEXT,
    },
    font: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultValue: {
            fontFamily: "Inter",
            fontWeight: 400,
            fontStyle: "normal",
            lineHeight: "1.5em",
            letterSpacing: "0em",
        },
    },
    color: {
        type: ControlType.Color,
        title: "Color",
        defaultValue: "#1A1A1A",
    },
    textAlign: {
        type: ControlType.Enum,
        title: "Align",
        options: ["left", "center", "right", "justify"],
        optionTitles: ["Left", "Center", "Right", "Justify"],
        defaultValue: "left",
    },
    fluidType: {
        type: ControlType.Boolean,
        title: "Fluid Type",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
    fontSize: {
        type: ControlType.Number,
        title: "Font Size",
        defaultValue: 16,
        min: 6,
        max: 200,
        step: 1,
        displayStepper: true,
    },
    referenceWidth: {
        type: ControlType.Number,
        title: "Reference Width",
        defaultValue: 600,
        min: 50,
        max: 4000,
        step: 10,
        hidden: (props: Props) => !props.fluidType,
    },
    minFontSize: {
        type: ControlType.Number,
        title: "Min Size",
        defaultValue: 12,
        min: 4,
        max: 200,
        step: 1,
        hidden: (props: Props) => !props.fluidType,
    },
    maxFontSize: {
        type: ControlType.Number,
        title: "Max Size",
        defaultValue: 32,
        min: 4,
        max: 400,
        step: 1,
        hidden: (props: Props) => !props.fluidType,
    },
    columnMode: {
        type: ControlType.Enum,
        title: "Columns",
        options: ["auto", "fixed"],
        optionTitles: ["Auto (Responsive)", "Fixed Count"],
        defaultValue: "auto",
    },
    minColumnWidth: {
        type: ControlType.Number,
        title: "Min Column Width",
        defaultValue: 180,
        min: 40,
        max: 2000,
        step: 10,
        hidden: (props: Props) => props.columnMode !== "auto",
    },
    columnCount: {
        type: ControlType.Number,
        title: "Column Count",
        defaultValue: 2,
        min: 1,
        max: 8,
        step: 1,
        displayStepper: true,
        hidden: (props: Props) => props.columnMode !== "fixed",
    },
    columnGap: {
        type: ControlType.Number,
        title: "Column Gap",
        defaultValue: 24,
        min: 0,
        max: 200,
        step: 1,
    },
    showRule: {
        type: ControlType.Boolean,
        title: "Divider",
        defaultValue: false,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
    ruleWidth: {
        type: ControlType.Number,
        title: "Divider Width",
        defaultValue: 1,
        min: 1,
        max: 20,
        step: 1,
        hidden: (props: Props) => !props.showRule,
    },
    ruleColor: {
        type: ControlType.Color,
        title: "Divider Color",
        defaultValue: "rgba(0,0,0,0.15)",
        hidden: (props: Props) => !props.showRule,
    },
    paragraphSpacing: {
        type: ControlType.Number,
        title: "Paragraph Gap",
        defaultValue: 12,
        min: 0,
        max: 200,
        step: 1,
    },
    padding: {
        type: "padding" as ControlType,
        title: "Padding",
        defaultValue: "0px",
    },
    hyphenate: {
        type: ControlType.Boolean,
        title: "Hyphenate",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
    overflowMode: {
        type: ControlType.Enum,
        title: "Overflow",
        options: ["clip", "scroll"],
        optionTitles: ["Clip", "Scroll"],
        defaultValue: "clip",
    },
} as any)
