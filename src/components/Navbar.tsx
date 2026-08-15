import Link from "next/link";
import { auth } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";

export async function Navbar() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-gradient-to-b from-black/95 to-black/70 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-1.5 text-xl font-black tracking-tight text-white">
          <span className="text-accent">Movie</span>Match
        </Link>
        <div className="flex items-center gap-3 text-sm sm:gap-5">
          {session?.user ? (
            <>
              <Link href="/dashboard" className="hidden text-neutral-300 hover:text-white transition-colors sm:block">
                Mi panel
              </Link>
              <Link href="/explore" className="hidden text-neutral-300 hover:text-white transition-colors sm:block">
                Explorar
              </Link>
              <Link href="/groups" className="hidden text-neutral-300 hover:text-white transition-colors sm:block">
                Grupos
              </Link>
              <Link href="/recommendations" className="text-neutral-300 hover:text-white transition-colors">
                Recomendaciones
              </Link>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="text-neutral-300 hover:text-white transition-colors">
                Iniciar sesión
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-accent px-3.5 py-1.5 font-semibold text-white hover:bg-accent-hover transition-colors"
              >
                Registrarme
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
