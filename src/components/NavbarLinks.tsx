"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, getAppKeyForPathname } from "@/lib/appNav";

// Desktop top-nav link list (hidden on small screens, where BottomNavLinks
// takes over) -- extracted out of Navbar.tsx (an async server component with
// no access to the current path) so it can pick MovieMatch's or MiSuper's
// items based on the pathname, same split as BottomNav/BottomNavLinks.
export function NavbarLinks() {
  const pathname = usePathname();
  const appKey = getAppKeyForPathname(pathname);
  if (appKey === null) return null; // the hub itself borrows no app's links

  const items = NAV_ITEMS[appKey];

  return (
    <>
      {items.map((item) => (
        <Link key={item.href} href={item.href} className="hidden text-neutral-300 hover:text-white transition-colors sm:block">
          {item.label}
        </Link>
      ))}
    </>
  );
}
