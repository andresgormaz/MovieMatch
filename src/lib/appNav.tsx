import type { ReactNode } from "react";

export interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  // Every page that conceptually belongs under this tab, not just its own
  // landing page -- e.g. MovieMatch's "Tus gustos" also lights up on /vs and
  // /rate. Pages outside every tab's prefixes correctly show nothing
  // selected rather than forcing a fit.
  activePrefixes: string[];
}

export type AppKey = "moviematch" | "mi-super" | "mar-antonia";

const ICON_PROPS = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const MOVIEMATCH_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Inicio",
    activePrefixes: ["/dashboard"],
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M4 11.5 12 4l8 7.5" />
        <path d="M6 10v9.5a.5.5 0 0 0 .5.5H10v-5.5h4V20h3.5a.5.5 0 0 0 .5-.5V10" />
      </svg>
    ),
  },
  {
    href: "/recommendations",
    label: "Para ti",
    activePrefixes: ["/recommendations", "/explore", "/wishlist", "/whats-new"],
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.8z" />
      </svg>
    ),
  },
  {
    href: "/know-you",
    label: "Tus gustos",
    activePrefixes: ["/know-you", "/vs", "/rate", "/tastes"],
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M12 20s-7-4.3-9.5-9C1 7.5 2.5 4.5 5.5 4.5c1.8 0 3.2 1 4 2.3.8-1.3 2.2-2.3 4-2.3 3 0 4.5 3 3 6.5-2.5 4.7-9.5 9-9.5 9Z" />
      </svg>
    ),
  },
  {
    href: "/social",
    label: "Social",
    activePrefixes: ["/social", "/friends", "/groups"],
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="9" cy="8.5" r="3" />
        <path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
        <path d="M15.5 6a3 3 0 0 1 0 5.8" />
        <path d="M17 14.8c2.4.5 3.8 2.2 3.8 4.7" />
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "Perfil",
    activePrefixes: ["/profile"],
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c0-3.5 3-6.3 7-6.3s7 2.8 7 6.3" />
      </svg>
    ),
  },
];

const MI_SUPER_ITEMS: NavItem[] = [
  {
    href: "/mi-super",
    label: "Inicio",
    activePrefixes: ["/mi-super"],
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M4 11.5 12 4l8 7.5" />
        <path d="M6 10v9.5a.5.5 0 0 0 .5.5H10v-5.5h4V20h3.5a.5.5 0 0 0 .5-.5V10" />
      </svg>
    ),
  },
  {
    href: "/mi-super/listas",
    label: "Listas",
    activePrefixes: ["/mi-super/listas"],
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="5" cy="6.5" r="1.3" fill="currentColor" stroke="none" />
        <path d="M9.5 6.5h10" />
        <circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none" />
        <path d="M9.5 12h10" />
        <circle cx="5" cy="17.5" r="1.3" fill="currentColor" stroke="none" />
        <path d="M9.5 17.5h10" />
      </svg>
    ),
  },
  {
    href: "/mi-super/historial",
    label: "Historial",
    activePrefixes: ["/mi-super/historial"],
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3.2 2" />
      </svg>
    ),
  },
  {
    href: "/mi-super/aprendizaje",
    label: "Aprendizaje",
    activePrefixes: ["/mi-super/aprendizaje"],
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M12 3.5a6 6 0 0 0-3.5 10.9c.5.4.8 1 .8 1.6v.5h5.4V16c0-.6.3-1.2.8-1.6A6 6 0 0 0 12 3.5Z" />
        <path d="M9.7 18.5h4.6" />
        <path d="M10.5 21h3" />
      </svg>
    ),
  },
  {
    href: "/mi-super/ajustes",
    label: "Ajustes",
    activePrefixes: ["/mi-super/ajustes"],
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.4-2-3.4-2.3.8a7.7 7.7 0 0 0-1.7-1L15 3.6h-4l-.4 2.4a7.7 7.7 0 0 0-1.7 1l-2.3-.8-2 3.4L6.6 11a7.6 7.6 0 0 0 0 2l-2 1.4 2 3.4 2.3-.8c.5.4 1.1.8 1.7 1l.4 2.4h4l.4-2.4c.6-.2 1.2-.6 1.7-1l2.3.8 2-3.4-2-1.4Z" />
      </svg>
    ),
  },
];

const MAR_ANTONIA_ITEMS: NavItem[] = [
  {
    href: "/mar-antonia",
    label: "Inicio",
    activePrefixes: ["/mar-antonia"],
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M4 11.5 12 4l8 7.5" />
        <path d="M6 10v9.5a.5.5 0 0 0 .5.5H10v-5.5h4V20h3.5a.5.5 0 0 0 .5-.5V10" />
      </svg>
    ),
  },
  {
    href: "/mar-antonia/ajustes",
    label: "Ajustes",
    activePrefixes: ["/mar-antonia/ajustes"],
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.4-2-3.4-2.3.8a7.7 7.7 0 0 0-1.7-1L15 3.6h-4l-.4 2.4a7.7 7.7 0 0 0-1.7 1l-2.3-.8-2 3.4L6.6 11a7.6 7.6 0 0 0 0 2l-2 1.4 2 3.4 2.3-.8c.5.4 1.1.8 1.7 1l.4 2.4h4l.4-2.4c.6-.2 1.2-.6 1.7-1l2.3.8 2-3.4-2-1.4Z" />
      </svg>
    ),
  },
];

export const NAV_ITEMS: Record<AppKey, NavItem[]> = {
  moviematch: MOVIEMATCH_ITEMS,
  "mi-super": MI_SUPER_ITEMS,
  "mar-antonia": MAR_ANTONIA_ITEMS,
};

// Null means "no app-specific nav" -- just the hub itself ("/"), which sits
// above every app and shouldn't borrow either one's tabs. Every other
// logged-in route defaults to MovieMatch's nav, matching this app's
// pre-existing routes exactly (zero behavior change for any of them).
export function getAppKeyForPathname(pathname: string | null): AppKey | null {
  if (pathname?.startsWith("/mi-super")) return "mi-super";
  if (pathname?.startsWith("/mar-antonia")) return "mar-antonia";
  if (pathname === "/") return null;
  return "moviematch";
}

// Longest-matching-prefix wins so a base path like "/mi-super" (Inicio)
// doesn't stay "active" once the pathname moves into a more specific
// sibling section like "/mi-super/listas" -- every prefix in
// MOVIEMATCH_ITEMS today happens to be mutually exclusive already, so this
// is a pure generalization, not a behavior change there.
export function pickActiveIndex(pathname: string | null, items: NavItem[]): number {
  const path = pathname ?? "";
  const matchLength = (prefix: string) => (path === prefix || path.startsWith(`${prefix}/`) ? prefix.length : -1);
  const lengths = items.map((item) => Math.max(-1, ...item.activePrefixes.map(matchLength)));
  const maxLength = Math.max(...lengths);
  return maxLength >= 0 ? lengths.indexOf(maxLength) : -1;
}
