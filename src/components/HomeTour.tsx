"use client";

import { useRef, useState } from "react";
import { TourOverlay, type TourStep } from "@/components/TourOverlay";

// Selectors match `data-tour="..."` attributes sprinkled on the real
// buttons/cards elsewhere (Navbar, dashboard's 3 compact teaser blocks).
const STEPS: TourStep[] = [
  {
    selector: '[data-tour="tour-search"]',
    title: "Busca lo que quieras",
    body: "Escribe el nombre de una película o serie para ir directo a su ficha.",
  },
  {
    selector: '[data-tour="tour-block-foryou"]',
    title: "Para ti",
    body: "Toca para ver tus recomendaciones, el catálogo completo y tu lista -- este bloque es solo un adelanto, no se califica desde acá.",
  },
  {
    selector: '[data-tour="tour-block-knowyou"]',
    title: "Tus gustos",
    body: 'Compara pares en "¿cuál te gusta más?" o califica títulos populares -- ambas afinan tus recomendaciones rápido.',
  },
  {
    selector: '[data-tour="tour-block-social"]',
    title: "Social",
    body: "Amigos para mandar un título puntual, o grupos para recomendaciones conjuntas.",
  },
  {
    selector: '[data-tour="tour-quicklinks"]',
    title: "El resto de la app",
    body: "Tu diario, noticias y tu top 5. Recomendaciones, gustos, social y tu perfil siempre están abajo, en la barra de navegación.",
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
