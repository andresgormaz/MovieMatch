import Link from "next/link";
import { auth } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";

export async function Navbar() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-20 border-b border-neutral-800 bg-neutral-950/90 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight text-white">
          🎬 MovieMatch
        </Link>
        <div className="flex items-center gap-4 text-sm">
          {session?.user ? (
            <>
              <Link href="/dashboard" className="text-neutral-300 hover:text-white transition-colors">
                Panel
              </Link>
              <Link href="/recommendations" className="text-neutral-300 hover:text-white transition-colors">
                Recomendaciones
              </Link>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="text-neutral-300 hover:text-white transition-colors">
                Entrar
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-white px-3 py-1.5 font-medium text-neutral-900 hover:bg-neutral-200 transition-colors"
              >
                Crear cuenta
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
