"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STREAMING_REGIONS, countryName } from "@/lib/countries";

// Only reached by a brand-new Google account (see /auth/after-google) --
// registering with email/password already asks for this in the form
// itself, so Google is the one path that skips it.
export default function OnboardingCountryPage() {
  const router = useRouter();
  const [country, setCountry] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!country) return;
    setLoading(true);
    setError(null);
    const res = await fetch("/api/me/country", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country }),
    });
    if (!res.ok) {
      setError("No se pudo guardar. Probá de nuevo.");
      setLoading(false);
      return;
    }
    router.push("/onboarding/titles");
  }

  return (
    <div className="relative flex min-h-[calc(100vh-57px)] items-center justify-center px-4 py-16">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl border border-border bg-surface/90 p-8 backdrop-blur"
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold">¿Desde qué país nos ves?</h1>
          <p className="mt-2 text-sm text-neutral-400">
            Lo usamos para mostrarte en qué plataformas de streaming está cada título.
          </p>
        </div>
        <select
          required
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 outline-none focus:border-accent transition-colors"
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
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading || !country}
          className="w-full rounded-md bg-accent px-6 py-3 font-bold text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          {loading ? "Guardando…" : "Continuar →"}
        </button>
      </form>
    </div>
  );
}
