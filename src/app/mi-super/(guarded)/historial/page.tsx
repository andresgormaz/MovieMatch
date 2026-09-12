import { BackToHomeLink } from "@/components/BackToHomeLink";

// Fase 3 of the spec: purchase history built from completed lists (what got
// bought, how often, price trends). Needs the product-catalog/purchase-
// session schema that phase introduces -- out of scope for Fase 0+1, which
// only covers list/item CRUD. This stub just reserves the nav slot and the
// URL.
export default function HistorialPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <BackToHomeLink href="/mi-super" />
      <div>
        <h1 className="text-2xl font-bold">Historial</h1>
        <p className="mt-1 text-sm text-muted">Lo que compraste, cuándo y cuánto gastaste.</p>
      </div>
      <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
        Próximamente vas a poder ver acá lo que compraste en cada lista, con qué frecuencia y
        cómo cambian los precios.
      </p>
    </div>
  );
}
