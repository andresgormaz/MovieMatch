"use client";

import { useEffect, useRef, useState } from "react";

interface PersonOption {
  id: string;
  name: string;
  photoUrl: string | null;
}

export function PersonAutocomplete({
  label,
  placeholder,
  selected,
  onSelect,
}: {
  label: string;
  placeholder: string;
  selected: PersonOption | null;
  onSelect: (person: PersonOption | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PersonOption[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing stale results when the query is too short
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      const res = await fetch(`/api/people/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.people);
      setOpen(true);
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

  if (selected) {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted">{label}</label>
        <div className="flex items-center justify-between rounded-lg border border-white/15 bg-black/40 px-3 py-2">
          <span className="text-sm text-white">{selected.name}</span>
          <button
            onClick={() => {
              onSelect(null);
              setQuery("");
            }}
            className="text-xs text-muted hover:text-white"
          >
            Quitar ✕
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
        placeholder={placeholder}
        className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-accent"
      />
      {open && results.length > 0 && (
        <ul className="absolute top-full z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
          {results.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => {
                  onSelect(p);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white hover:bg-surface-hover"
              >
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
