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
// User.tourSeenAt).
export function HomeTour() {
  const [dismissed, setDismissed] = useState(false);
  const finishing = useRef(false);

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

  if (dismissed) return null;
  return <TourOverlay steps={STEPS} onFinish={finish} />;
}
