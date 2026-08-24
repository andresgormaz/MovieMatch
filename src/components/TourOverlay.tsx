"use client";

import { useEffect, useLayoutEffect, useState } from "react";

export interface TourStep {
  selector: string;
  title: string;
  body: string;
}

// useLayoutEffect warns when it runs during SSR -- TourOverlay can end up
// in the server-rendered HTML (HomeTour's `open` state starts from a
// server-computed prop), so this falls back to useEffect there and only
// upgrades to the synchronous, pre-paint version in the browser.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Steps whose target isn't currently rendered/visible (e.g. a section that
// only shows when there's data, or the desktop-only nav links on a phone)
// are skipped automatically, so the same step list works everywhere without
// a separate mobile/empty-state variant.
function findVisibleStep(steps: TourStep[], from: number): number | null {
  for (let i = from; i < steps.length; i++) {
    const el = document.querySelector(steps[i].selector) as HTMLElement | null;
    if (el && el.offsetParent !== null) return i;
  }
  return null;
}

// Pure presentational spotlight/tooltip coach-mark -- dims the screen except
// for a cutout around the current step's target, with a tooltip explaining
// it. No opinion on *whether* to show or how "seen" gets persisted -- that's
// the caller's job (see HomeTour and PageTour), so this same rendering logic
// serves both the original home tour and every per-page tour.
export function TourOverlay({ steps, onFinish }: { steps: TourStep[]; onFinish: () => void }) {
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first visible step depends on post-mount DOM layout
    setStepIndex(findVisibleStep(steps, 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- steps is a stable literal per caller
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (stepIndex === null) return;
    const el = document.querySelector(steps[stepIndex].selector) as HTMLElement | null;
    if (!el) {
      goNext();
      return;
    }
    function update() {
      setRect(el!.getBoundingClientRect());
    }
    // Jump instantly rather than scrollIntoView's own "smooth" -- that fires
    // a scroll event on nearly every frame of its animation, and each one
    // re-triggers the spotlight's own CSS transition toward a slightly
    // different mid-scroll target, so the two animations fight and the
    // result looks like it jerks around instead of moving cleanly. Scrolling
    // instantly and measuring once afterward leaves exactly one motion
    // source: the spotlight's own eased transition to its settled position.
    el.scrollIntoView({ block: "center", behavior: "instant" });
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [stepIndex]);

  function goNext() {
    setStepIndex((current) => {
      if (current === null) return null;
      const next = findVisibleStep(steps, current + 1);
      if (next === null) {
        onFinish();
        return current;
      }
      return next;
    });
  }

  if (stepIndex === null || !rect || typeof window === "undefined") return null;

  const step = steps[stepIndex];
  const pad = 8;
  const spotTop = rect.top - pad;
  const spotLeft = rect.left - pad;
  const spotWidth = rect.width + pad * 2;
  const spotHeight = rect.height + pad * 2;

  const tooltipWidth = Math.min(320, window.innerWidth - 32);
  const spaceBelow = window.innerHeight - (spotTop + spotHeight);
  const tooltipBelow = spaceBelow > 170 || spotTop < 170;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div
        className="fixed rounded-2xl border-2 border-accent transition-all duration-300"
        style={{
          top: spotTop,
          left: spotLeft,
          width: spotWidth,
          height: spotHeight,
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.78)",
        }}
      />
      <div
        className="fixed z-50 rounded-xl border border-border bg-surface p-4 shadow-xl transition-all duration-300"
        style={{
          width: tooltipWidth,
          left: Math.min(Math.max(16, spotLeft), window.innerWidth - tooltipWidth - 16),
          ...(tooltipBelow
            ? { top: Math.min(spotTop + spotHeight + 12, window.innerHeight - 180) }
            : { top: Math.max(12, spotTop - 12 - 168) }),
        }}
      >
        <p className="text-xs font-semibold text-accent-hover">
          {stepIndex + 1} / {steps.length}
        </p>
        <p className="mt-1 text-sm font-bold text-white">{step.title}</p>
        <p className="mt-1 text-sm text-muted">{step.body}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button onClick={onFinish} className="text-xs text-muted transition-colors hover:text-white">
            Saltar tutorial
          </button>
          <button
            onClick={goNext}
            className="rounded-md bg-accent px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-accent-hover"
          >
            {stepIndex + 1 === steps.length ? "Entendido" : "Siguiente →"}
          </button>
        </div>
      </div>
    </div>
  );
}
