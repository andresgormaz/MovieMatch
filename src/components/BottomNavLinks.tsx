"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
  // Exact match only for /dashboard -- every other page (diary, wishlist, vs,
  // etc) has no tab of its own and correctly shows nothing selected, rather
  // than "Inicio" lighting up everywhere that isn't one of the other four.
  matchPrefix?: boolean;
}

const ICON_PROPS = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Inicio",
    icon: () => (
      <svg {...ICON_PROPS}>
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9" />
      </svg>
    ),
  },
  {
    href: "/recommendations",
    label: "Recos",
    icon: () => (
      <svg {...ICON_PROPS}>
        <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.8z" />
      </svg>
    ),
  },
  {
    href: "/explore",
    label: "Explorar",
    icon: () => (
      <svg {...ICON_PROPS}>
        <circle cx="12" cy="12" r="9" />
        <path d="M15.5 8.5 13 13l-4.5 2.5L11 11z" />
      </svg>
    ),
  },
  {
    href: "/groups",
    label: "Grupos",
    matchPrefix: true,
    icon: () => (
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
    icon: () => (
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
          const active = item.matchPrefix
            ? pathname === item.href || pathname?.startsWith(`${item.href}/`)
            : pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
                active ? "text-accent-hover" : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {item.icon(active)}
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
