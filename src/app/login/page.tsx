"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

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
    router.push(searchParams.get("callbackUrl") || "/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
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
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          required
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
        {loading ? "Entrando…" : "Entrar"}
      </button>
      <p className="text-center text-sm text-neutral-400">
        ¿No tenés cuenta?{" "}
        <Link href="/register" className="text-white underline">
          Creá una
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-16">
      <h1 className="text-2xl font-bold">Entrar a MovieMatch</h1>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
