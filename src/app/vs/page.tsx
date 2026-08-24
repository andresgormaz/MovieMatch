"use client";

import { useState } from "react";
import Link from "next/link";
import { BackToHomeLink } from "@/components/BackToHomeLink";
import { PairCompare } from "@/components/onboarding/PairCompare";
import { PageTour } from "@/components/PageTour";
import type { TourStep } from "@/components/TourOverlay";

const TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="tour-vs-page"]',
    title: "Elige la que más te gusta",
    body: '¿No has visto una? Usa "No la he visto, cambiar" -- no perjudica el puntaje de la que no elegiste.',
  },
];

// The same "which do you like more" mechanic from onboarding, but with no
// fixed round count -- a standing way to keep filling in genre/format/actor
// gaps whenever there's a spare minute, not just once at signup.
export default function VsPage() {
  const [round, setRound] = useState(0);
  const [exhausted, setExhausted] = useState(false);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <BackToHomeLink />
      <PageTour pageKey="vs" steps={TOUR_STEPS} />
      <div>
        <h1 className="text-2xl font-bold">¿Cuál te gusta más?</h1>
        <p className="mt-1 text-sm text-muted">
          Sigue completando tus gustos. Elige entre las que ya viste{round > 0 ? ` · llevas ${round}` : ""}.
        </p>
        <p className="mt-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-neutral-300">
          Si no has visto alguna de las dos, usa &quot;No la he visto, cambiar&quot; para reemplazarla. Eso no
          perjudica el puntaje de la película o serie que no elegiste.
        </p>
      </div>

      {exhausted ? (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center">
          <p className="text-sm text-white">Por ahora no hay más comparaciones nuevas para mostrarte.</p>
          <p className="mt-1 text-sm text-muted">Vuelve a intentarlo más adelante, a medida que el catálogo crezca.</p>
          <Link
            href="/dashboard"
            className="mt-4 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-white hover:bg-accent-hover transition-colors"
          >
            Volver al inicio →
          </Link>
        </div>
      ) : (
        <div data-tour="tour-vs-page">
          <PairCompare unlimited onRoundComplete={setRound} onExhausted={() => setExhausted(true)} />
        </div>
      )}
    </div>
  );
}
