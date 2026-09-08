import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// One-time fix for a specific data trap: before the create/join guards in
// src/app/api/mar-antonia/children/{route.ts,join/[code]/route.ts} existed,
// a caregiver could end up belonging to two disconnected Child profiles --
// their own accidental one, plus the real shared one they later joined.
// requireAnyChild (src/lib/marAntonia/authz.ts) always resolves to whichever
// one they joined *first*, so the shared profile everyone actually uses can
// end up permanently hidden from them even though they're still a caregiver
// of it. This moves that person's stray-profile activities into the real
// shared profile and removes the stray profile, reachable by visiting a URL
// (like /api/admin/seed) since there's no computer/terminal involved in
// running this app day to day.
//
// Query params:
//   secret       required, must match SEED_SECRET
//   keepEmail    the account whose current profile is the real, shared one
//   mergeEmail   the account with the stray extra profile to fold in
//   confirm=FUSIONAR   required to actually write anything -- omit it (or
//                      get it wrong) and this only *previews* what it would
//                      do, same "confirm or it's a dry run" shape as
//                      /api/admin/reset-users's confirm=BORRAR.
export async function GET(request: Request) {
  const secret = process.env.SEED_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "SEED_SECRET no está configurada en el servidor. Agrégala en las variables de entorno." },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(request.url);
  if (searchParams.get("secret") !== secret) {
    return NextResponse.json({ error: "Secreto incorrecto." }, { status: 401 });
  }

  const keepEmail = searchParams.get("keepEmail")?.trim().toLowerCase();
  const mergeEmail = searchParams.get("mergeEmail")?.trim().toLowerCase();
  if (!keepEmail || !mergeEmail) {
    return NextResponse.json(
      { error: "Faltan parámetros: agrega &keepEmail=...&mergeEmail=... a la URL." },
      { status: 400 },
    );
  }
  if (keepEmail === mergeEmail) {
    return NextResponse.json({ error: "keepEmail y mergeEmail no pueden ser el mismo correo." }, { status: 400 });
  }

  const dryRun = searchParams.get("confirm") !== "FUSIONAR";

  const [keepUser, mergeUser] = await Promise.all([
    prisma.user.findUnique({ where: { email: keepEmail } }),
    prisma.user.findUnique({ where: { email: mergeEmail } }),
  ]);
  if (!keepUser) return NextResponse.json({ error: `No existe ninguna cuenta con ${keepEmail}` }, { status: 404 });
  if (!mergeUser) return NextResponse.json({ error: `No existe ninguna cuenta con ${mergeEmail}` }, { status: 404 });

  const target = await prisma.childCaregiver.findFirst({
    where: { userId: keepUser.id },
    include: { child: { select: { id: true, name: true } } },
    orderBy: { joinedAt: "asc" },
  });
  if (!target) {
    return NextResponse.json({ error: `${keepEmail} no pertenece a ningún perfil de MarAntonia.` }, { status: 400 });
  }

  const mergeUserOnTarget = await prisma.childCaregiver.findUnique({
    where: { childId_userId: { childId: target.childId, userId: mergeUser.id } },
  });
  if (!mergeUserOnTarget) {
    return NextResponse.json(
      {
        error: `${mergeEmail} no es cuidador del perfil "${target.child.name}" (el de ${keepEmail}) todavía -- únete primero con el link de invitación antes de fusionar.`,
      },
      { status: 400 },
    );
  }

  const strayMemberships = await prisma.childCaregiver.findMany({
    where: { userId: mergeUser.id, childId: { not: target.childId } },
    include: { child: { select: { id: true, name: true } } },
  });
  if (strayMemberships.length === 0) {
    return NextResponse.json({
      ok: true,
      dryRun,
      message: `${mergeEmail} ya solo pertenece al perfil compartido "${target.child.name}". No hay nada que fusionar.`,
    });
  }

  // Refuse to touch a stray profile that has caregivers other than
  // mergeUser -- that's someone else's real profile, not an accidental
  // solo one, and deleting it would kick them out of it entirely.
  const strayChildIds = strayMemberships.map((m) => m.childId);
  const otherCaregiversOnStrayProfiles = await prisma.childCaregiver.findMany({
    where: { childId: { in: strayChildIds }, userId: { not: mergeUser.id } },
    select: { childId: true, userId: true },
  });
  if (otherCaregiversOnStrayProfiles.length > 0) {
    return NextResponse.json(
      {
        error: `${mergeEmail} comparte un perfil "extra" con otras personas (no es una cuenta accidental solitaria) -- esto no se puede fusionar automáticamente. Revísalo a mano.`,
        strayProfiles: strayMemberships.map((m) => m.child),
        otherCaregivers: otherCaregiversOnStrayProfiles,
      },
      { status: 400 },
    );
  }

  const activityCounts = await Promise.all(
    strayChildIds.map((childId) => prisma.childActivity.count({ where: { childId } })),
  );
  const perProfile = strayMemberships.map((m, i) => ({
    childId: m.childId,
    childName: m.child.name,
    activitiesMoved: activityCounts[i],
  }));
  const totalActivitiesMoved = activityCounts.reduce((a, b) => a + b, 0);

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      target: { childId: target.childId, childName: target.child.name },
      wouldMerge: perProfile,
      totalActivitiesMoved,
      message: `Vista previa: se moverían ${totalActivitiesMoved} registro(s) de ${strayMemberships.length} perfil(es) sobrante(s) de ${mergeEmail} hacia "${target.child.name}", y esos perfiles sobrantes se borrarían. Agrega &confirm=FUSIONAR a la URL para aplicarlo de verdad.`,
    });
  }

  // Deleted in dependency order (children before parents) rather than
  // relying on the schema's ON DELETE CASCADE actually being enforced by
  // the underlying SQLite/Turso connection -- same reasoning as
  // /api/admin/reset-users.
  await prisma.$transaction([
    ...strayChildIds.map((childId) =>
      prisma.childActivity.updateMany({ where: { childId }, data: { childId: target.childId } }),
    ),
    prisma.childCaregiver.deleteMany({ where: { childId: { in: strayChildIds } } }),
    prisma.child.deleteMany({ where: { id: { in: strayChildIds } } }),
  ]);

  return NextResponse.json({
    ok: true,
    dryRun: false,
    target: { childId: target.childId, childName: target.child.name },
    merged: perProfile,
    totalActivitiesMoved,
    message: `Listo: se movieron ${totalActivitiesMoved} registro(s) de ${mergeEmail} hacia "${target.child.name}" y se borraron ${strayMemberships.length} perfil(es) sobrante(s). Ambos deberían ver todo junto ahora.`,
  });
}
