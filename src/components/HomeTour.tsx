"use client";

import { useRef, useState } from "react";
import { TourOverlay, type TourStep } from "@/components/TourOverlay";

// Selectors match `data-tour="..."` attributes sprinkled on the real
// buttons/cards elsewhere (Navbar, dashboard's 3 home sections: Para ti,
// Conócete, Social).
const STEPS: TourStep[] = [
  {
    selector: '[data-tour="tour-search"]',
    title: "Busca lo que quieras",
    body: "Escribe el nombre de una película o serie para ir directo a su ficha.",
  },
  {
    selector: '[data-tour="tour-foryou"]',
    title: "Para ti",
    body: 'Varias recomendaciones a la vez, no solo una -- si calificas una, quedan las demás. También desde acá: catálogo completo, tu lista y las novedades.',
  },
  {
    selector: '[data-tour="tour-vs"]',
    title: '"¿Cuál te gusta más?"',
    body: "Compara pares de títulos que ya viste. Entre más compares, mejores serán tus recomendaciones.",
  },
  {
    selector: '[data-tour="tour-populares"]',
    title: "Calificar populares",
    body: "Títulos muy populares que probablemente ya viste -- calificarlos es de lo más rápido para afinar tus recomendaciones.",
  },
  {
    selector: '[data-tour="tour-social"]',
    title: "Amigos y grupos",
    body: "Agrega amigos para mandarles recomendaciones puntuales, o vincula cuentas en un grupo para recomendaciones conjuntas.",
  },
  {
    selector: '[data-tour="tour-quicklinks"]',
    title: "El resto de la app",
    body: "Tu diario, noticias, tu top 5, tus gustos y tu perfil.",
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
          className="fixed right-4 bottom-24 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-sm font-bold text-neutral-300 shadow-lg transition-colors hover:border-accent hover:text-white sm:bottom-4"
        >
          ?
        </button>
      )}
    </>
  );
}
