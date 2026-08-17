"use client";

import { useEffect, useState } from "react";
import { WishlistCard, type WishlistItem } from "@/components/WishlistCard";
import { BackToHomeLink } from "@/components/BackToHomeLink";

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/wishlist");
        if (!res.ok) throw new Error("No se pudo cargar tu lista");
        const data = await res.json();
        setItems(data.items);
      } catch {
        setError("No se pudo cargar tu lista. Probá de nuevo en un momento.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function handleRemoved(titleId: string) {
    setItems((prev) => prev.filter((i) => i.id !== titleId));
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <BackToHomeLink />
      <div>
        <h1 className="text-2xl font-bold">Mi lista</h1>
        <p className="mt-1 text-sm text-muted">
          Títulos que marcaste como &quot;la voy a ver&quot;. Cuando la veas, marcala como vista para que deje de
          aparecer acá y afine tus próximas recomendaciones.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {loading && <p className="text-center text-sm text-muted">Cargando…</p>}
        {error && (
          <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">{error}</p>
        )}
        {!loading && !error && items.length === 0 && (
          <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
            Todavía no agregaste nada. Desde tus recomendaciones, tocá &quot;La voy a ver&quot; para guardar algo acá.
          </p>
        )}
        {items.map((item) => (
          <WishlistCard key={item.id} item={item} onRemoved={handleRemoved} />
        ))}
      </div>
    </div>
  );
}
