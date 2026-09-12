import { HomeBlocksSkeleton } from "./page";

// Next.js wraps the whole page in an implicit Suspense boundary keyed off
// this file, so navigating to /dashboard shows this immediately -- before
// this session's own (fast, but not instant) auth/user lookup even runs --
// instead of leaving the previous screen looking frozen while the tap
// registers. Shaped like the real page (minus the "Hola, X" name, which
// isn't known yet) so nothing jumps around once the real content replaces it.
export default function DashboardLoading() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <div className="h-8 w-40 animate-pulse rounded bg-white/10" />
      <HomeBlocksSkeleton />
      <div className="grid grid-cols-2 gap-2.5">
        <div className="h-[46px] animate-pulse rounded-xl border border-border bg-surface" />
        <div className="h-[46px] animate-pulse rounded-xl border border-border bg-surface" />
      </div>
    </div>
  );
}
