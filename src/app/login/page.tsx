"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);
    if (res?.error) {
      setError("Email o contraseña incorrectos");
      return;
    }
    router.push(searchParams.get("callbackUrl") || "/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
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
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 outline-none focus:border-accent transition-colors"
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-accent px-6 py-3 font-bold text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
      >
        {loading ? "Entrando…" : "Iniciar sesión"}
      </button>
      <p className="text-center text-sm text-neutral-400">
        ¿No tienes cuenta?{" "}
        <Link href="/register" className="text-white underline">
          Regístrate
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-[calc(100vh-57px)] items-center justify-center overflow-hidden px-4 py-16">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/25 via-background to-background" />
      <div className="relative flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl border border-border bg-surface/90 p-8 backdrop-blur">
        <h1 className="text-2xl font-bold">Iniciar sesión</h1>
        <GoogleSignInButton label="Continuar con Google" />
        <div className="flex w-full max-w-sm items-center gap-3 text-xs text-neutral-500">
          <div className="h-px flex-1 bg-white/10" />
          o con tu correo
          <div className="h-px flex-1 bg-white/10" />
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
