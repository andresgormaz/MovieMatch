"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
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
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-16">
      <h1 className="text-2xl font-bold">Creá tu cuenta</h1>
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="name" className="text-sm text-neutral-400">
            Nombre
          </label>
          <input
            id="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 outline-none focus:border-neutral-400"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm text-neutral-400">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 outline-none focus:border-neutral-400"
          />
        </div>
        <div className="flex flex-col gap-1">
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
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 outline-none focus:border-neutral-400"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-white px-6 py-2.5 font-semibold text-neutral-900 hover:bg-neutral-200 transition-colors disabled:opacity-50"
        >
          {loading ? "Creando…" : "Crear cuenta"}
        </button>
        <p className="text-center text-sm text-neutral-400">
          ¿Ya tenés cuenta?{" "}
          <Link href="/login" className="text-white underline">
            Entrá
          </Link>
        </p>
      </form>
    </div>
  );
}
