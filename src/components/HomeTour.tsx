"use client";

import { useRef, useState } from "react";
import { TourOverlay, type TourStep } from "@/components/TourOverlay";

// Selectors match `data-tour="..."` attributes sprinkled on the real
// buttons/cards elsewhere (Navbar, HomeHero, dashboard).
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
    selector: '[data-tour="tour-populares"]',
    title: "Calificar populares",
    body: "Títulos muy populares que probablemente ya viste -- calificarlos es de lo más rápido para afinar tus recomendaciones.",
  },
  {
    selector: '[data-tour="tour-novedades"]',
    title: "Novedades para ti",
    body: "Estrenos recientes, series que retomar y sagas por completar, elegidos según tu gusto.",
  },
  {
    selector: '[data-tour="tour-quicklinks"]',
    title: "El resto de la app",
    body: "Desde aquí entras a todas tus recomendaciones, tu lista, tu diario, tus grupos y tus gustos.",
  },
];

// Skippable, step-by-step coach-mark tutorial shown once on the home screen
// right after onboarding (see dashboard/page.tsx's `showTour`, gated on
// User.tourSeenAt). Also renders its own small "Ver tutorial" trigger so it
// can be replayed on demand -- dashboard/page.tsx always mounts this now,
// passing `startOpen` for whether it should auto-open on this load.
export function HomeTour({ startOpen }: { startOpen: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const finishing = useRef(false);

  async function finish() {
    if (finishing.current) return;
    finishing.current = true;
    setOpen(false);
    try {
      await fetch("/api/tour/complete", { method: "POST" });
    } catch {
      // Best effort -- worst case the tour shows again on the next visit.
    } finally {
      finishing.current = false;
    }
  }

  return (
    <>
      {open && <TourOverlay steps={STEPS} onFinish={finish} />}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Ver el tutorial de inicio"
          title="Ver tutorial"
          className="fixed bottom-4 right-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-sm font-bold text-neutral-300 shadow-lg transition-colors hover:border-accent hover:text-white"
        >
          ?
        </button>
      )}
    </>
  );
}
