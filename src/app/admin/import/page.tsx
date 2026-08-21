"use client";

import { useRef, useState } from "react";

type Source = "auto" | "anime" | "votes" | "attributes" | "range";

const SOURCES: { value: Source; label: string; hint: string }[] = [
  { value: "auto", label: "Catálogo (2000 en adelante)", hint: "El import principal desde TMDB." },
  {
    value: "range",
    label: "Otro rango de años",
    hint: "Complementa el catálogo con películas y series de cualquier época, sin repetir lo que ya tienes.",
  },
  { value: "anime", label: "Anime", hint: "Importa anime desde Jikan/MyAnimeList." },
  { value: "votes", label: "Votos faltantes", hint: "Rellena puntaje/cantidad de votos en títulos que quedaron sin eso." },
  { value: "attributes", label: "Duración/colección faltante", hint: "Rellena duración, presupuesto y colección en títulos que quedaron sin eso." },
];

// Between calls, not for rate-limiting TMDB/Jikan (seedCatalog.ts already
// paces those internally) -- just a small buffer so this loop doesn't fire
// the next request the instant the previous one's response lands.
const DELAY_BETWEEN_CALLS_MS = 300;

interface LogEntry {
  text: string;
  isError: boolean;
}

// Automates what used to be "visit this URL, read the message, visit it
// again, ... dozens or hundreds of times by hand" -- keeps calling
// /api/admin/seed in a loop from the browser until that source reports
// `done`, so catching up a large catalog just means opening this page once
// and leaving the tab open instead of repeatedly tapping a link. Gated by
// SEED_SECRET the same way the API route itself is -- not behind login, on
// purpose, matching how the admin endpoints already work.
export default function AdminImportPage() {
  const [secret, setSecret] = useState("");
  const [source, setSource] = useState<Source>("auto");
  const [fromYear, setFromYear] = useState("");
  const [toYear, setToYear] = useState("");
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [callCount, setCallCount] = useState(0);
  const stopRequested = useRef(false);

  function appendLog(text: string, isError = false) {
    setLog((prev) => [...prev.slice(-49), { text, isError }]);
  }

  async function start() {
    if (!secret.trim()) {
      appendLog("Escribe el SEED_SECRET antes de iniciar.", true);
      return;
    }
    if (source === "range" && !fromYear.trim()) {
      appendLog("Escribe al menos el año de inicio para el rango.", true);
      return;
    }
    stopRequested.current = false;
    setRunning(true);
    setCallCount(0);
    const label =
      source === "range"
        ? `${fromYear}${toYear ? `-${toYear}` : " en adelante"}`
        : SOURCES.find((s) => s.value === source)?.label;
    appendLog(`Iniciando (${label})…`);

    let done = false;
    let calls = 0;
    while (!stopRequested.current && !done) {
      try {
        const params = new URLSearchParams({ secret: secret.trim() });
        if (source !== "auto") params.set("source", source);
        if (source === "range") {
          params.set("from", fromYear.trim());
          if (toYear.trim()) params.set("to", toYear.trim());
        }
        const res = await fetch(`/api/admin/seed?${params.toString()}`);
        const data = await res.json();
        calls += 1;
        setCallCount(calls);

        if (!res.ok || !data.ok) {
          appendLog(data.error ?? "Error desconocido, deteniendo.", true);
          break;
        }

        appendLog(data.message ?? "Lote completado.");
        done = Boolean(data.done) || Boolean(data.skipped);
      } catch {
        appendLog("Falló la conexión. Revisa tu internet e inténtalo de nuevo.", true);
        break;
      }

      if (!done && !stopRequested.current) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_CALLS_MS));
      }
    }

    if (done) appendLog("Listo -- no queda más por cargar en esta etapa.");
    else if (stopRequested.current) appendLog("Detenido.");
    setRunning(false);
  }

  function stop() {
    stopRequested.current = true;
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Importar catálogo</h1>
        <p className="mt-1 text-sm text-muted">
          Repite automáticamente el mismo llamado que antes había que hacer a mano visitando el link una y otra
          vez. Déjala corriendo con la pestaña abierta y la pantalla encendida -- si el navegador la manda a
          segundo plano (pantalla bloqueada en el celular) puede pausarse sola.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted" htmlFor="secret">
            SEED_SECRET
          </label>
          <input
            id="secret"
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            disabled={running}
            placeholder="El mismo secreto de siempre"
            className="rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none placeholder:text-neutral-500 focus:border-accent disabled:opacity-50"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted">Qué importar</label>
          <div className="flex flex-col gap-1.5">
            {SOURCES.map((s) => (
              <label
                key={s.value}
                className="flex items-start gap-2 rounded-md border border-white/10 px-3 py-2 text-sm text-neutral-300"
              >
                <input
                  type="radio"
                  name="source"
                  checked={source === s.value}
                  onChange={() => setSource(s.value)}
                  disabled={running}
                  className="mt-0.5 accent-[var(--accent)]"
                />
                <span>
                  <span className="block text-white">{s.label}</span>
                  <span className="block text-xs text-muted">{s.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {source === "range" && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted">Rango de años</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={fromYear}
                onChange={(e) => setFromYear(e.target.value)}
                disabled={running}
                placeholder="Desde (ej: 1980)"
                className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none placeholder:text-neutral-500 focus:border-accent disabled:opacity-50"
              />
              <span className="text-muted">a</span>
              <input
                type="number"
                value={toYear}
                onChange={(e) => setToYear(e.target.value)}
                disabled={running}
                placeholder="Hasta (opcional)"
                className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none placeholder:text-neutral-500 focus:border-accent disabled:opacity-50"
              />
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {!running ? (
            <button
              onClick={start}
              className="flex-1 rounded-md bg-accent px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-accent-hover"
            >
              Iniciar
            </button>
          ) : (
            <button
              onClick={stop}
              className="flex-1 rounded-md border border-white/15 px-4 py-2 text-sm font-bold text-white transition-colors hover:border-white/30"
            >
              Detener
            </button>
          )}
        </div>
        {running && <p className="text-xs text-muted">Corriendo… {callCount} lotes hechos hasta ahora.</p>}
      </div>

      {log.length > 0 && (
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-1 text-sm font-semibold text-white">Progreso</h2>
          <div className="flex max-h-80 flex-col gap-1 overflow-y-auto text-xs">
            {log.map((entry, i) => (
              <p key={i} className={entry.isError ? "text-red-400" : "text-neutral-300"}>
                {entry.text}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
