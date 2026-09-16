"use client";

import { useEffect, useRef, useState } from "react";
import { TourOverlay, type TourStep } from "@/components/TourOverlay";

// Same coach-mark as HomeTour, generalized to any page: checks for itself
// (via /api/tour/status) whether this user has already seen *this specific
// page's* tutorial, so it can just be dropped into any page -- server or
// client component -- without that page having to compute/pass a
// `showTour` boolean itself. Also renders its own small "Ver tutorial"
// trigger so a user can replay it any time, not just on first visit.
export function PageTour({ pageKey, steps }: { pageKey: string; steps: TourStep[] }) {
  const [open, setOpen] = useState(false);
  const finishing = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/tour/status?pageKey=${encodeURIComponent(pageKey)}`);
        const data = await res.json();
        // Only ever auto-*open* from this check, never force-close -- a user
        // who already tapped the manual trigger before this resolves
        // shouldn't get the overlay yanked away from under them.
        if (!cancelled && !data.seen) setOpen(true);
      } catch {
        // Best effort -- if the check fails, just don't show it this time
        // rather than risk an error loop.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pageKey]);

  async function finish() {
    if (finishing.current) return;
    finishing.current = true;
    setOpen(false);
    try {
      await fetch("/api/tour/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageKey }),
      });
    } catch {
      // Best effort -- worst case the tour shows again on the next visit.
    } finally {
      finishing.current = false;
    }
  }

  return (
    <>
      {open && <TourOverlay steps={steps} onFinish={finish} />}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Ver el tutorial de esta página"
          title="Ver tutorial"
          className="fixed right-4 bottom-24 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-sm font-bold text-neutral-300 shadow-lg transition-colors hover:border-accent hover:text-white sm:bottom-4"
        >
          ?
        </button>
      )}
    </>
  );
}
