"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, getAppKeyForPathname, pickActiveIndex } from "@/lib/appNav";

// Mobile-only tab bar (sm:hidden) -- the top Navbar already lists these as
// text links on desktop (see Navbar.tsx), but hides them on small screens to
// make room for the search bar. This is the mobile equivalent, always
// reachable without a round trip through the home screen. Which 5 items show
// depends on which app section the current path belongs to (see appNav.ts).
export function BottomNavLinks() {
  const pathname = usePathname();
  const appKey = getAppKeyForPathname(pathname);
  if (appKey === null) return null; // the hub itself borrows no app's tabs

  const items = NAV_ITEMS[appKey];
  const activeIndex = pickActiveIndex(pathname, items);

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/5 bg-black/95 backdrop-blur-md sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-5">
        {items.map((item, i) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
              i === activeIndex ? "text-accent-hover" : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
