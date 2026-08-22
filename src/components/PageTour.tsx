"use client";

import { useEffect, useRef, useState } from "react";
import { TourOverlay, type TourStep } from "@/components/TourOverlay";

// Same coach-mark as HomeTour, generalized to any page: checks for itself
// (via /api/tour/status) whether this user has already seen *this specific
// page's* tutorial, so it can just be dropped into any page -- server or
// client component -- without that page having to compute/pass a
// `showTour` boolean itself. Renders nothing while checking or once seen.
export function PageTour({ pageKey, steps }: { pageKey: string; steps: TourStep[] }) {
  const [shouldShow, setShouldShow] = useState(false);
  const finishing = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/tour/status?pageKey=${encodeURIComponent(pageKey)}`);
        const data = await res.json();
        if (!cancelled) setShouldShow(!data.seen);
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
    setShouldShow(false);
    try {
      await fetch("/api/tour/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageKey }),
      });
    } catch {
      // Best effort -- worst case the tour shows again on the next visit.
    }
  }

  if (!shouldShow) return null;
  return <TourOverlay steps={steps} onFinish={finish} />;
}
