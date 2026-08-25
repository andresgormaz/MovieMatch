"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  // Every page that conceptually belongs under this tab, not just its own
  // landing page -- e.g. "Tus gustos" also lights up on /vs and /rate, not
  // only on /know-you itself. Pages outside all four (diary, news, top...)
  // correctly show nothing selected rather than forcing a fit.
  activePrefixes: string[];
}

const ICON_PROPS = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const ITEMS: NavItem[] = [
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

// Mobile-only tab bar (sm:hidden) -- the top Navbar already lists these as
// text links on desktop (see Navbar.tsx), but hides them on small screens to
// make room for the search bar. This is the mobile equivalent, always
// reachable without a round trip through the home screen.
export function BottomNavLinks() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/5 bg-black/95 backdrop-blur-md sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-5">
        {ITEMS.map((item) => {
          const active = item.activePrefixes.some(
            (prefix) => pathname === prefix || pathname?.startsWith(`${prefix}/`),
          );
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
                active ? "text-accent-hover" : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
