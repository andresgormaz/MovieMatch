import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// "Inicio" surfaces one list to jump back into: whichever is currently
// ACTIVE (mid-shop) takes priority over a DRAFT one waiting to be started,
// since resuming a trip in progress is the more urgent action. Quick add
// and pending suggestions (spec 4.1) arrive once items exist (PR6+).
export default async function MiSuperHomePage() {
  const session = await auth();
  const membership = await prisma.householdMember.findFirst({
    where: { userId: session!.user.id },
    include: { household: true },
    orderBy: { joinedAt: "asc" },
  });

  const highlightedList = membership
    ? ((await prisma.shoppingList.findFirst({
        where: { householdId: membership.householdId, status: "ACTIVE" },
        orderBy: { updatedAt: "desc" },
      })) ??
      (await prisma.shoppingList.findFirst({
        where: { householdId: membership.householdId, status: "DRAFT" },
        orderBy: { createdAt: "desc" },
      })))
    : null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Hola 👋</h1>
        <p className="mt-1 text-sm text-muted">
          {membership?.household.name ? `Hogar: ${membership.household.name}` : "Tu hogar está listo."}
        </p>
      </div>

      {highlightedList ? (
        <Link
          href={`/mi-super/listas/${highlightedList.id}`}
          className="rounded-2xl border border-border bg-surface p-6 transition-colors hover:border-accent"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {highlightedList.status === "ACTIVE" ? "Comprando ahora" : "Tu próxima lista"}
          </p>
          <p className="mt-1 text-lg font-semibold text-white">{highlightedList.title}</p>
        </Link>
      ) : (
        <Link
          href="/mi-super/listas"
          className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted transition-colors hover:border-accent"
        >
          Todavía no tienes listas. Crea la primera acá.
        </Link>
      )}
    </div>
  );
}
