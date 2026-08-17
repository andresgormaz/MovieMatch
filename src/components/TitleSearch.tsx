"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Poster } from "@/components/Poster";

interface SearchResult {
  id: string;
  name: string;
  type: "MOVIE" | "SERIES";
  releaseYear: number | null;
  posterUrl: string | null;
}

export function TitleSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing stale results when the query is too short
      setResults([]);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results ?? []);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function goTo(id: string) {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(`/title/${id}`);
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-xs">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Buscar título…"
        aria-label="Buscar película o serie"
        className="w-full rounded-full border border-white/15 bg-black/40 px-3.5 py-1.5 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-accent transition-colors"
      />
      {open && (query.trim().length >= 2) && (
        <ul className="absolute top-full left-0 z-30 mt-1.5 w-full min-w-[16rem] overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
          {loading && results.length === 0 && (
            <li className="px-3 py-2.5 text-sm text-muted">Buscando…</li>
          )}
          {!loading && results.length === 0 && (
            <li className="px-3 py-2.5 text-sm text-muted">Sin resultados.</li>
          )}
          {results.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => goTo(r.id)}
                className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left hover:bg-surface-hover transition-colors"
              >
                <div className="h-11 w-8 flex-shrink-0 overflow-hidden rounded">
                  <Poster name={r.name} type={r.type} posterUrl={r.posterUrl} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{r.name}</p>
                  <p className="text-xs text-muted">
                    {r.type === "MOVIE" ? "Película" : "Serie"}
                    {r.releaseYear ? ` · ${r.releaseYear}` : ""}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
