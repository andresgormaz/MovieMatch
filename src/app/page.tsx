import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tmdbPosterUrl } from "@/lib/tmdb";
import { Poster } from "@/components/Poster";

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const backdrop = await prisma.title.findMany({
    take: 42,
    orderBy: { onboardingRank: "asc" },
    select: { id: true, name: true, type: true, posterPath: true },
  });

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid grid-cols-6 gap-1 opacity-40 sm:grid-cols-7 md:grid-cols-9">
        {backdrop.map((t) => (
          <div key={t.id} className="aspect-[2/3]">
            <Poster name={t.name} type={t.type} posterUrl={tmdbPosterUrl(t.posterPath)} />
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-black/85 to-background" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-background via-transparent to-background" />

      <div className="relative mx-auto flex min-h-[calc(100vh-57px)] max-w-3xl flex-col items-center justify-center gap-6 px-4 py-16 text-center">
        <h1 className="text-4xl font-black tracking-tight sm:text-6xl">
          Encuentra tu próxima <span className="text-accent">película o serie</span> favorita
        </h1>
        <p className="max-w-xl text-lg text-neutral-300">
          Califica lo que ya viste, cuéntanos qué actores, directores y géneros te gustan, y te
          recomendamos títulos hechos a tu medida. Todo se guarda automáticamente y mejora con
          el tiempo.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/register"
            className="rounded-lg bg-accent px-8 py-3.5 text-lg font-bold text-white hover:bg-accent-hover transition-colors"
          >
            Empezar gratis
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-white/25 bg-white/5 px-8 py-3.5 text-lg font-semibold text-white backdrop-blur hover:bg-white/10 transition-colors"
          >
            Ya tengo cuenta
          </Link>
        </div>
        <ol className="mt-10 grid gap-4 text-left text-sm text-neutral-300 sm:grid-cols-3">
          <li className="rounded-xl border border-border bg-surface/80 p-4 backdrop-blur">
            <span className="mb-1 block text-2xl">1️⃣</span>
            Califica títulos populares que probablemente ya viste.
          </li>
          <li className="rounded-xl border border-border bg-surface/80 p-4 backdrop-blur">
            <span className="mb-1 block text-2xl">2️⃣</span>
            Cuéntanos qué actores, directores y géneros te gustan.
          </li>
          <li className="rounded-xl border border-border bg-surface/80 p-4 backdrop-blur">
            <span className="mb-1 block text-2xl">3️⃣</span>
            Recibe recomendaciones que se actualizan con cada calificación.
          </li>
        </ol>
      </div>
    </div>
  );
}
