"use client";

import { useEffect, useRef, useState } from "react";
import { Poster } from "@/components/Poster";

interface SearchResult {
  id: string;
  name: string;
  releaseYear: number | null;
  posterUrl: string | null;
  type: "MOVIE" | "SERIES";
}

export function FavoritePicker({ label, type }: { label: string; type: "MOVIE" | "SERIES" }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing stale results when the query is too short
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=${type}`);
      const data = await res.json();
      setResults(data.results ?? []);
      setOpen(true);
    }, 300);
    return () => clearTimeout(handle);
  }, [query, type]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function pick(result: SearchResult) {
    setSelected(result);
    setOpen(false);
    setSaving(true);
    await fetch("/api/onboarding/favorite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titleId: result.id }),
    });
    setSaving(false);
  }

  if (selected) {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted">{label}</label>
        <div className="flex items-center gap-3 rounded-lg border border-white/15 bg-black/40 p-2">
          <div className="h-14 w-10 flex-shrink-0 overflow-hidden rounded">
            <Poster name={selected.name} type={selected.type} posterUrl={selected.posterUrl} />
          </div>
          <span className="flex-1 text-sm text-white">{selected.name}</span>
          <button
            onClick={() => {
              setSelected(null);
              setQuery("");
            }}
            disabled={saving}
            className="px-2 text-xs text-muted hover:text-white"
          >
            Cambiar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1.5">
      <label className="text-xs text-muted">{label}</label>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Buscar…"
        className="rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-sm outline-none focus:border-accent"
      />
      {open && results.length > 0 && (
        <ul className="absolute top-full z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-surface shadow-xl">
          {results.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => pick(r)}
                className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left hover:bg-surface-hover"
              >
                <div className="h-11 w-8 flex-shrink-0 overflow-hidden rounded">
                  <Poster name={r.name} type={r.type} posterUrl={r.posterUrl} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm text-white">{r.name}</p>
                  <p className="text-xs text-muted">{r.releaseYear ?? ""}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
