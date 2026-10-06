import type { ReactNode } from "react"

const paths: Record<string, ReactNode> = {
    open: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
    save: (
        <>
            <path d="M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
            <path d="M7 3v5h8V3M7 21v-7h10v7" />
        </>
    ),
    download: <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M4 19h16" />,
    print: (
        <>
            <path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2" />
            <path d="M6 14h12v7H6z" />
        </>
    ),
    undo: <path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />,
    redo: <path d="m15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />,
    zoomIn: (
        <>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4M11 8v6M8 11h6" />
        </>
    ),
    zoomOut: (
        <>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4M8 11h6" />
        </>
    ),
    search: (
        <>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" />
        </>
    ),
    sidebar: (
        <>
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M9 4v16" />
        </>
    ),
    pages: (
        <>
            <rect x="4" y="3" width="7" height="9" rx="1" />
            <rect x="13" y="3" width="7" height="9" rx="1" />
            <rect x="4" y="14" width="7" height="7" rx="1" />
            <rect x="13" y="14" width="7" height="7" rx="1" />
        </>
    ),
    bookmark: <path d="M6 3h12v18l-6-4-6 4z" />,
    comment: <path d="M4 5h16v11H9l-5 4z" />,
    cursor: <path d="m5 3 14 7-6 2-2 6z" />,
    hand: (
        <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12m0-7.5a1.5 1.5 0 0 1 3 0V12m0-6a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7h-.5a6 6 0 0 1-4.9-2.5L3.5 15a1.5 1.5 0 0 1 2.4-1.8L8 15.5" />
    ),
    highlight: (
        <>
            <path d="m9 11-5 5v3h6l5-5" />
            <path d="m14 4 6 6-6 6-6-6z" />
        </>
    ),
    underline: <path d="M7 4v6a5 5 0 0 0 10 0V4M5 20h14" />,
    strike: <path d="M16 6.5C15 5 13.6 4 12 4c-2.5 0-4.5 1.4-4.5 3.5 0 4.5 9 3 9 8 0 2.2-2 3.5-4.5 3.5-1.9 0-3.4-.8-4.5-2.5M4 12h16" />,
    pen: <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19zM14.5 6.5l3 3" />,
    text: <path d="M5 6V4h14v2M12 4v16M9 20h6" />,
    note: (
        <>
            <path d="M5 4h14v11l-5 5H5z" />
            <path d="M14 20v-5h5M8 9h8M8 12h5" />
        </>
    ),
    square: <rect x="4" y="5" width="16" height="14" rx="1" />,
    circle: <ellipse cx="12" cy="12" rx="8.5" ry="7" />,
    line: <path d="M5 19 19 5" />,
    arrow: <path d="M5 19 19 5m0 0h-8m8 0v8" />,
    whiteout: (
        <>
            <path d="m7 21-4-4 11-11 7 7-8 8z" />
            <path d="M10 21h11M9 11l6 6" />
        </>
    ),
    signature: <path d="M3 17c3-1 4-9 6-9s-1 9 1 9 3-5 4-5 0 4 1.5 4S19 13 21 13M3 21h18" />,
    image: (
        <>
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="9" cy="10" r="2" />
            <path d="m21 16-5-5-9 9" />
        </>
    ),
    stamp: (
        <>
            <path d="M9 13V9.5a3 3 0 1 1 6 0V13M4 13h16v4H4zM6 21h12" />
        </>
    ),
    rotateCw: <path d="M20 4v5h-5M20 9a8 8 0 1 0 0 6" />,
    rotateCcw: <path d="M4 4v5h5M4 9a8 8 0 1 1 0 6" />,
    trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    chevronUp: <path d="m6 15 6-6 6 6" />,
    chevronDown: <path d="m6 9 6 6 6-6" />,
    chevronLeft: <path d="m15 6-6 6 6 6" />,
    chevronRight: <path d="m9 6 6 6-6 6" />,
    close: <path d="M6 6l12 12M18 6 6 18" />,
    moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
    sun: (
        <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </>
    ),
    info: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v6M12 7.5v.01" />
        </>
    ),
    copy: (
        <>
            <rect x="8" y="8" width="12" height="12" rx="2" />
            <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
        </>
    ),
    help: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7M12 17v.01" />
        </>
    ),
    twoPage: (
        <>
            <rect x="3" y="5" width="8" height="14" rx="1" />
            <rect x="13" y="5" width="8" height="14" rx="1" />
        </>
    ),
    onePage: <rect x="7" y="4" width="10" height="16" rx="1" />,
    fitWidth: <path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4" />,
    fitPage: (
        <>
            <rect x="6" y="3" width="12" height="18" rx="1" />
            <path d="M9 9l3-3 3 3M9 15l3 3 3-3" />
        </>
    ),
    file: (
        <>
            <path d="M6 3h8l5 5v13H6z" />
            <path d="M14 3v5h5" />
        </>
    ),
    filePlus: (
        <>
            <path d="M6 3h8l5 5v13H6z" />
            <path d="M14 3v5h5M12 11v6M9 14h6" />
        </>
    ),
    extract: (
        <>
            <path d="M6 3h8l5 5v13H6z" />
            <path d="M14 3v5h5M12 17v-6m0 0-2.5 2.5M12 11l2.5 2.5" />
        </>
    ),
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    check: <path d="m5 12 5 5 9-10" />,
}

export type IconName = keyof typeof paths

export function Icon({ name, size = 18 }: { name: IconName | string; size?: number }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {paths[name]}
        </svg>
    )
}
