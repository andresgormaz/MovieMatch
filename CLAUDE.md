@AGENTS.md

# MiSuper (reglas permanentes)

Aplican a todo `src/app/mi-super/**`, `src/app/api/mi-super/**` y `src/lib/miSuper/**`:

- Toda escritura (POST/PATCH) valida el body con Zod antes de tocar la base de datos.
- Toda ruta que muta datos de un hogar/lista pasa primero por
  `requireHouseholdMember`/`requireListAccess`/`requireAnyHousehold` (`src/lib/miSuper/authz.ts`)
  — nunca filtrar por household/lista "a mano" en la query.
- Las mutaciones que puedan repetirse por una reconexión (offline, doble tap) llevan un
  `clientMutationId` y la ruta las trata como no-op si ya se aplicaron.
- Mobile-first: los targets táctiles (checkboxes, botones de fila) miden al menos 44×44px.
- Antes de dar una tarea de MiSuper por terminada: `npx tsc --noEmit`, `npm run lint`,
  `npm test` (Vitest), `npm run build`, y `npx playwright test` (e2e) — en ese orden.
