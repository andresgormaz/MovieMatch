import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-20 text-center">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        Encuentra tu próxima película o serie favorita
      </h1>
      <p className="max-w-xl text-lg text-neutral-400">
        Calificá pelis y series que ya viste, decinos qué actores, directores y géneros te
        gustan, y te vamos a recomendar títulos hechos a tu medida. Todo se guarda automáticamente
        y mejora con el tiempo.
      </p>
      <div className="flex gap-3">
        <Link
          href="/register"
          className="rounded-full bg-white px-6 py-3 font-semibold text-neutral-900 hover:bg-neutral-200 transition-colors"
        >
          Empezar gratis
        </Link>
        <Link
          href="/login"
          className="rounded-full border border-neutral-700 px-6 py-3 font-semibold text-neutral-100 hover:border-neutral-500 transition-colors"
        >
          Ya tengo cuenta
        </Link>
      </div>
      <ol className="mt-10 grid gap-4 text-left text-sm text-neutral-400 sm:grid-cols-3">
        <li className="rounded-xl border border-neutral-800 p-4">
          <span className="mb-1 block text-2xl">1️⃣</span>
          Calificá títulos populares que probablemente ya viste.
        </li>
        <li className="rounded-xl border border-neutral-800 p-4">
          <span className="mb-1 block text-2xl">2️⃣</span>
          Decinos qué actores, directores y géneros te gustan.
        </li>
        <li className="rounded-xl border border-neutral-800 p-4">
          <span className="mb-1 block text-2xl">3️⃣</span>
          Recibí recomendaciones que se actualizan con cada calificación.
        </li>
      </ol>
    </div>
  );
}
