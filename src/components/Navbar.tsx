import Link from "next/link";
import { auth } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";
import { TitleSearch } from "@/components/TitleSearch";

export async function Navbar() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-gradient-to-b from-black/95 to-black/70 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6">
        <Link href="/" className="flex flex-shrink-0 items-center gap-1.5 text-xl font-black tracking-tight text-white">
          <span className="text-accent">Movie</span>Match
        </Link>
        {session?.user && <TitleSearch />}
        <div className="ml-auto flex items-center gap-3 text-sm sm:gap-5">
          {session?.user ? (
            <>
              <Link href="/dashboard" className="hidden text-neutral-300 hover:text-white transition-colors sm:block">
                Inicio
              </Link>
              <Link href="/explore" className="hidden text-neutral-300 hover:text-white transition-colors sm:block">
                Explorar
              </Link>
              <Link href="/groups" className="hidden text-neutral-300 hover:text-white transition-colors sm:block">
                Grupos
              </Link>
              <Link href="/wishlist" className="hidden text-neutral-300 hover:text-white transition-colors sm:block">
                Mi lista
              </Link>
              <Link href="/diary" className="hidden text-neutral-300 hover:text-white transition-colors sm:block">
                Diario
              </Link>
              <Link href="/recommendations" className="hidden text-neutral-300 hover:text-white transition-colors sm:block">
                Recomendaciones
              </Link>
              <Link href="/profile" className="hidden text-neutral-300 hover:text-white transition-colors sm:block">
                Perfil
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
