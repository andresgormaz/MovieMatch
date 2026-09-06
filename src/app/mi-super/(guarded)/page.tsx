import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Minimal for now -- becomes the real "Inicio" (active list preview, quick
// add, pending suggestions per spec 4.1) once Listas (PR5+) exists. Just
// confirms the household is set up correctly for this slice.
export default async function MiSuperHomePage() {
  const session = await auth();
  const membership = await prisma.householdMember.findFirst({
    where: { userId: session!.user.id },
    include: { household: true },
    orderBy: { joinedAt: "asc" },
  });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Hola 👋</h1>
        <p className="mt-1 text-sm text-muted">
          {membership?.household.name ? `Hogar: ${membership.household.name}` : "Tu hogar está listo."}
        </p>
      </div>
      <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
        Pronto vas a poder armar tu lista de supermercado acá.
      </p>
    </div>
  );
}
