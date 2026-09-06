import Link from "next/link";

// On mobile the navbar hides its nav links to make room for the search bar
// (see Navbar.tsx), so each app's own home screen is the only way in -- this
// is the way back out, on every page they lead to. Defaults to MovieMatch's
// own home (unchanged behavior); MiSuper pages pass their own href/label.
export function BackToHomeLink({ href = "/dashboard", label = "Inicio" }: { href?: string; label?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex w-fit items-center gap-1.5 text-sm text-muted transition-colors hover:text-white"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </Link>
  );
}
