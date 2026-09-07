import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Minimal for now -- becomes the real "Inicio" (quick-log buttons + today's
// feed) once activity logging exists (PR5+). Just confirms the child
// profile is set up correctly for this slice.
export default async function MarAntoniaHomePage() {
  const session = await auth();
  const caregiver = await prisma.childCaregiver.findFirst({
    where: { userId: session!.user.id },
    include: { child: true },
    orderBy: { joinedAt: "asc" },
  });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Hola 👋</h1>
        <p className="mt-1 text-sm text-muted">{caregiver ? caregiver.child.name : "Tu perfil está listo."}</p>
      </div>
      <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
        Pronto vas a poder registrar comidas, siestas, leches, despertadas y pañales acá.
      </p>
    </div>
  );
}
