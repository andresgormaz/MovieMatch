"use client";

import { useEffect, useRef, useState } from "react";

interface TourStep {
  selector: string;
  title: string;
  body: string;
}

// Selectors match `data-tour="..."` attributes sprinkled on the real
// buttons/cards elsewhere (Navbar, HomeHero, dashboard). Steps whose target
// isn't currently visible (e.g. the desktop-only nav links on a phone) are
// skipped automatically -- see findVisibleStep -- so the same step list
// works on mobile and desktop without a separate mobile variant.
const STEPS: TourStep[] = [
  {
    selector: '[data-tour="tour-search"]',
    title: "Busca lo que quieras",
    body: "Escribe el nombre de una película o serie para ir directo a su ficha.",
  },
  {
    selector: '[data-tour="tour-hero"]',
    title: "Tu recomendación del día",
    body: 'Dinos si ya la viste, si "la vas a ver" o si no te interesa. Así seguimos aprendiendo tu gusto.',
  },
  {
    selector: '[data-tour="tour-vs"]',
    title: '"¿Cuál te gusta más?"',
    body: "Compara pares de títulos que ya viste. Entre más compares, mejores serán tus recomendaciones.",
  },
  {
    selector: '[data-tour="tour-rate"]',
    title: "Calificar lo que ya viste",
    body: "Ponle estrellas a todo lo que hayas visto, aunque no haya salido como recomendación.",
  },
  {
    selector: '[data-tour="tour-quicklinks"]',
    title: "El resto de la app",
    body: "Desde aquí entras a todas tus recomendaciones, tu lista, tu diario, tus grupos y tus gustos.",
  },
];

function findVisibleStep(from: number): number | null {
  for (let i = from; i < STEPS.length; i++) {
    const el = document.querySelector(STEPS[i].selector) as HTMLElement | null;
    if (el && el.offsetParent !== null) return i;
  }
  return null;
}

// Skippable, step-by-step coach-mark tutorial shown once on the home screen
// right after onboarding (see dashboard/page.tsx's `showTour`, gated on
// User.tourSeenAt). Dims the screen except for a spotlight cutout around the
// current target, with a tooltip explaining what it does.
export function HomeTour() {
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const finishing = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first visible step depends on post-mount DOM layout
    setStepIndex(findVisibleStep(0));
  }, []);

  useEffect(() => {
    if (stepIndex === null) return;
    const el = document.querySelector(STEPS[stepIndex].selector) as HTMLElement | null;
    if (!el) {
      goNext();
      return;
    }
    function update() {
      setRect(el!.getBoundingClientRect());
    }
    update();
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- goNext is stable enough for this effect's purpose
  }, [stepIndex]);

  async function finish() {
    if (finishing.current) return;
    finishing.current = true;
    setDismissed(true);
    try {
      await fetch("/api/tour/complete", { method: "POST" });
    } catch {
      // Best effort -- worst case the tour shows again on the next visit.
    }
  }

  function goNext() {
    setStepIndex((current) => {
      if (current === null) return null;
      const next = findVisibleStep(current + 1);
      if (next === null) {
        finish();
        return current;
      }
      return next;
    });
  }

  if (dismissed || stepIndex === null || !rect || typeof window === "undefined") return null;

  const step = STEPS[stepIndex];
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
          {stepIndex + 1} / {STEPS.length}
        </p>
        <p className="mt-1 text-sm font-bold text-white">{step.title}</p>
        <p className="mt-1 text-sm text-muted">{step.body}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button onClick={finish} className="text-xs text-muted transition-colors hover:text-white">
            Saltar tutorial
          </button>
          <button
            onClick={goNext}
            className="rounded-md bg-accent px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-accent-hover"
          >
            {stepIndex + 1 === STEPS.length ? "Entendido" : "Siguiente →"}
          </button>
        </div>
      </div>
    </div>
  );
}
