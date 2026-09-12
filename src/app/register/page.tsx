"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { STREAMING_REGIONS, countryName } from "@/lib/countries";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, country }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo crear la cuenta");
      setLoading(false);
      return;
    }

    const signInRes = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (signInRes?.error) {
      router.push("/login");
      return;
    }
    router.push("/onboarding/titles");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-[calc(100vh-57px)] items-center justify-center overflow-hidden px-4 py-16">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/25 via-background to-background" />
      <div className="relative flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl border border-border bg-surface/90 p-8 backdrop-blur">
        <h1 className="text-2xl font-bold">Crea tu cuenta</h1>
        <GoogleSignInButton label="Registrarme con Google" />
        <div className="flex w-full items-center gap-3 text-xs text-neutral-500">
          <div className="h-px flex-1 bg-white/10" />
          o con tu correo
          <div className="h-px flex-1 bg-white/10" />
        </div>
        <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-sm text-neutral-400">
              Nombre
            </label>
            <input
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 outline-none focus:border-accent transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm text-neutral-400">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 outline-none focus:border-accent transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm text-neutral-400">
              Contraseña (mín. 8 caracteres)
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 outline-none focus:border-accent transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="country" className="text-sm text-neutral-400">
              ¿Desde qué país nos ves?
            </label>
            <select
              id="country"
              required
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 outline-none focus:border-accent transition-colors"
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
            <p className="text-xs text-neutral-500">
              Lo usamos para mostrarte en qué plataformas de streaming está cada título.
            </p>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-accent px-6 py-3 font-bold text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {loading ? "Creando…" : "Crear cuenta"}
          </button>
          <p className="text-center text-sm text-neutral-400">
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="text-white underline">
              Inicia sesión
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
