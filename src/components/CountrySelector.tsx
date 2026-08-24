"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STREAMING_REGIONS, countryName } from "@/lib/countries";

export function CountrySelector({ initialCountry }: { initialCountry: string | null }) {
  const router = useRouter();
  const [country, setCountry] = useState(initialCountry ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleChange(value: string) {
    setCountry(value);
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/me/country", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country: value }),
      });
      setSaved(true);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-4">
      <label htmlFor="country" className="text-sm font-medium text-white">
        País para disponibilidad de streaming
      </label>
      <p className="text-xs text-muted">Usamos esto para mostrarte en qué plataformas está cada título.</p>
      <select
        id="country"
        value={country}
        onChange={(e) => handleChange(e.target.value)}
        className="mt-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
      >
        <option value="" disabled>
          Selecciona tu país
        </option>
        {STREAMING_REGIONS.map((code) => (
          <option key={code} value={code}>
            {countryName(code)}
          </option>
        ))}
      </select>
      {saving && <p className="text-xs text-muted">Guardando…</p>}
      {saved && !saving && <p className="text-xs text-emerald-400">Guardado</p>}
    </div>
  );
}
