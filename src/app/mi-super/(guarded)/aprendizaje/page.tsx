import { BackToHomeLink } from "@/components/BackToHomeLink";

// Fase 4 of the spec: suggested items learned from purchase history
// (frequency, seasonality) so a new list can pre-fill with what a household
// usually buys. Depends on Fase 3's history existing first -- out of scope
// for Fase 0+1. This stub just reserves the nav slot and the URL.
export default function AprendizajePage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <BackToHomeLink href="/mi-super" />
      <div>
        <h1 className="text-2xl font-bold">Aprendizaje</h1>
        <p className="mt-1 text-sm text-muted">Sugerencias basadas en lo que compras seguido.</p>
      </div>
      <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
        Próximamente MiSuper va a sugerirte productos según tus compras anteriores, para armar
        una lista nueva más rápido.
      </p>
    </div>
  );
}
