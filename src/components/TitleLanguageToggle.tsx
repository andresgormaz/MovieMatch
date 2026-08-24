"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TitleLanguageToggle({ initialOriginal }: { initialOriginal: boolean }) {
  const router = useRouter();
  const [original, setOriginal] = useState(initialOriginal);
  const [saving, setSaving] = useState(false);

  async function handleChange(value: boolean) {
    setOriginal(value);
    setSaving(true);
    try {
      await fetch("/api/me/title-language", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originalTitles: value }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-4">
      <label className="text-sm font-medium text-white">Idioma de los títulos</label>
      <p className="text-xs text-muted">
        Elige si prefieres ver el nombre en español o el título original de cada película/serie.
      </p>
      <div className="mt-1 flex gap-2">
        <button
          disabled={saving}
          onClick={() => handleChange(false)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
            !original ? "bg-accent text-white" : "border border-white/15 text-neutral-300 hover:border-white/30"
          }`}
        >
          En español
        </button>
        <button
          disabled={saving}
          onClick={() => handleChange(true)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
            original ? "bg-accent text-white" : "border border-white/15 text-neutral-300 hover:border-white/30"
          }`}
        >
          Título original
        </button>
      </div>
    </div>
  );
}
