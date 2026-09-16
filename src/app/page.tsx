import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tmdbPosterUrl } from "@/lib/tmdb";
import { Poster } from "@/components/Poster";

const ICON_PROPS = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export default async function Home() {
  const session = await auth();
  if (session?.user) return <Hub name={session.user.name} />;

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

// The super-app landing for anyone already signed in -- one shared account
// across every app below. Kept inline here (not its own component file)
// since it's this small, same as dashboard/page.tsx's own local helpers.
function Hub({ name }: { name?: string | null }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Hola{name ? `, ${name}` : ""} 👋</h1>
        <p className="mt-1 text-sm text-muted">¿Qué quieres abrir?</p>
      </div>
      <div className="flex flex-col gap-2.5">
        <HubTile
          href="/dashboard"
          label="MovieMatch"
          description="Recomendaciones de películas y series a tu medida."
          icon={
            <svg {...ICON_PROPS}>
              <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.8z" />
            </svg>
          }
        />
        <HubTile
          href="/mi-super"
          label="MiSuper"
          description="Lista de supermercado inteligente para tu hogar."
          icon={
            <svg {...ICON_PROPS}>
              <path d="M4.5 7h15l-1.4 9.3a2 2 0 0 1-2 1.7H7.9a2 2 0 0 1-2-1.7L4.5 7Z" />
              <path d="M8 7V5.5a4 4 0 0 1 8 0V7" />
            </svg>
          }
        />
        <HubTile
          href="/mar-antonia"
          label="MarAntonia"
          description="Comidas, siestas, leches y despertadas de nuestra hija."
          icon={
            <svg {...ICON_PROPS}>
              <path d="M12 20.5s-7.2-4.4-9.6-9C.8 7.5 2.4 4.3 5.6 4.3c1.9 0 3.4 1 4.4 2.5 1-1.5 2.5-2.5 4.4-2.5 3.2 0 4.8 3.2 3.2 7.2-2.4 4.6-9.6 9-9.6 9Z" />
            </svg>
          }
        />
        <HubTile
          label="MisCuentas"
          description="Cuentas del hogar y gastos compartidos -- próximamente."
          icon={
            <svg {...ICON_PROPS}>
              <rect x="3" y="6" width="18" height="13" rx="2" />
              <path d="M3 10h18" />
              <circle cx="16" cy="14.5" r="1.4" fill="currentColor" stroke="none" />
            </svg>
          }
          disabled
        />
        <HubTile
          label="MiAgenda"
          description="Permisos y puntos familiares -- próximamente."
          icon={
            <svg {...ICON_PROPS}>
              <rect x="3.5" y="5" width="17" height="16" rx="2" />
              <path d="M3.5 9.5h17" />
              <path d="M8 3v4M16 3v4" />
            </svg>
          }
          disabled
        />
      </div>
    </div>
  );
}

function HubTile({
  href,
  label,
  description,
  icon,
  disabled,
}: {
  href?: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  disabled?: boolean;
}) {
  const content = (
    <>
      <span
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
          disabled ? "bg-white/5 text-muted" : "bg-accent/15 text-accent-hover"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm font-bold ${disabled ? "text-muted" : "text-white"}`}>{label}</span>
        <span className="block truncate text-xs text-muted">{description}</span>
      </span>
      {!disabled && (
        <span aria-hidden className="flex-shrink-0 text-muted">
          →
        </span>
      )}
    </>
  );

  if (disabled || !href) {
    return (
      <div className="flex cursor-default items-center gap-3 rounded-xl border border-border/60 bg-surface/40 px-4 py-3.5">
        {content}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3.5 transition-colors hover:border-accent"
    >
      {content}
    </Link>
  );
}
