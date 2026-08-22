import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

function base(props: P) {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export const IconPlus = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconChild = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="9" width="7" height="6" rx="2" />
    <rect x="14" y="9" width="7" height="6" rx="2" />
    <path d="M10 12h4" />
  </svg>
);

export const IconSibling = (p: P) => (
  <svg {...base(p)}>
    <rect x="4" y="4" width="6" height="5" rx="1.5" />
    <rect x="4" y="15" width="6" height="5" rx="1.5" />
    <path d="M14 12h6M18 9.5 20.5 12 18 14.5" />
  </svg>
);

export const IconTrash = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6.5 7l.8 12a1 1 0 0 0 1 .9h7.4a1 1 0 0 0 1-.9l.8-12M10 11v6M14 11v6" />
  </svg>
);

export const IconImage = (p: P) => (
  <svg {...base(p)}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="M4.5 17.5 10 12.5l3.5 3 2.5-2 4 3.5" />
  </svg>
);

export const IconNote = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-4 3.5v-3.5H5A1.5 1.5 0 0 1 3.5 15V6A1.5 1.5 0 0 1 5 4.5Z" />
    <path d="M8 9.5h8M8 12.5h5" />
  </svg>
);

export const IconPalette = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-.9 2-1.8 0-.8-.6-1.2-.6-2 0-1 .8-1.7 2-1.7h1.8A4.8 4.8 0 0 0 21 11c0-4.4-4.2-8-9-8Z" />
    <circle cx="7.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="16.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export const IconUndo = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 5 4 9l4 4" />
    <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
  </svg>
);

export const IconRedo = (p: P) => (
  <svg {...base(p)}>
    <path d="m16 5 4 4-4 4" />
    <path d="M20 9H10a6 6 0 0 0 0 12h3" />
  </svg>
);

export const IconFit = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
  </svg>
);

export const IconZoomIn = (p: P) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.5-4.5M8 11h6M11 8v6" />
  </svg>
);

export const IconZoomOut = (p: P) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.5-4.5M8 11h6" />
  </svg>
);

export const IconImport = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3v12M8 11l4 4 4-4" />
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </svg>
);

export const IconExport = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 21V9M8 13l4-4 4 4" />
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </svg>
);

export const IconTree = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="10" width="5" height="4" rx="1.2" />
    <rect x="16" y="4" width="5" height="4" rx="1.2" />
    <rect x="16" y="16" width="5" height="4" rx="1.2" />
    <path d="M8 12h4v-4h4M12 12v8h4" />
  </svg>
);

export const IconRadial = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="2.5" />
    <circle cx="12" cy="4" r="1.6" />
    <circle cx="12" cy="20" r="1.6" />
    <circle cx="4" cy="12" r="1.6" />
    <circle cx="20" cy="12" r="1.6" />
    <path d="M12 9.5V6M12 14.5v3.5M9.5 12H6M14.5 12H18" />
  </svg>
);

export const IconForce = (p: P) => (
  <svg {...base(p)}>
    <circle cx="7" cy="7" r="2" />
    <circle cx="17" cy="6" r="2" />
    <circle cx="12" cy="14" r="2" />
    <circle cx="5" cy="18" r="2" />
    <circle cx="19" cy="18" r="2" />
    <path d="m8.5 8 2.5 4.5M15.5 7.5 13.5 12M8 17l2.5-1.5M17 16.5 14 15" />
  </svg>
);

export const IconClose = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const IconGrid = (p: P) => (
  <svg {...base(p)}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
  </svg>
);

export const IconPrev = (p: P) => (
  <svg {...base(p)}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
);

export const IconNext = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);

export const IconTarget = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="7" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
  </svg>
);

export const IconHelp = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.8.3-.9.9-.9 1.7" />
    <circle cx="12" cy="16.8" r="0.4" fill="currentColor" stroke="none" />
  </svg>
);

export const IconCollapse = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 9l4 4 4-4" />
  </svg>
);

export const IconExpand = (p: P) => (
  <svg {...base(p)}>
    <path d="M16 9l-4 4-4-4" />
  </svg>
);

export const LogoMark = (p: P) => (
  <svg viewBox="0 0 48 48" fill="none" {...p}>
    <defs>
      <linearGradient id="lg1" x1="0" y1="0" x2="48" y2="48">
        <stop offset="0" stopColor="#8b7cff" />
        <stop offset="1" stopColor="#5ee7ff" />
      </linearGradient>
    </defs>
    <circle cx="24" cy="24" r="6.5" fill="url(#lg1)" />
    <circle cx="9" cy="12" r="4" fill="none" stroke="url(#lg1)" strokeWidth="2.4" />
    <circle cx="39" cy="12" r="4" fill="none" stroke="url(#lg1)" strokeWidth="2.4" />
    <circle cx="9" cy="36" r="4" fill="none" stroke="url(#lg1)" strokeWidth="2.4" />
    <circle cx="39" cy="36" r="4" fill="none" stroke="url(#lg1)" strokeWidth="2.4" />
    <path
      d="M12.5 14.5 19 20.5M35.5 14.5 29 20.5M12.5 33.5 19 27.5M35.5 33.5 29 27.5"
      stroke="url(#lg1)"
      strokeWidth="2.4"
      strokeLinecap="round"
    />
  </svg>
);

export const IconSun = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

export const IconMoon = (p: P) => (
  <svg {...base(p)}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);
