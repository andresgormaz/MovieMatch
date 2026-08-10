# 🎬 MovieMatch

App web para encontrar películas y series que te van a gustar. Calificas títulos que ya viste,
dices qué actores/directores te gustan y qué géneros/países prefieres, y MovieMatch te
recomienda contenido nuevo. Las recomendaciones se recalculan al instante con cada
calificación nueva, así que van mejorando a medida que usas la app.

## Cómo funciona

1. **Onboarding de títulos** (`/onboarding/titles`): se muestra un catálogo ordenado por
   popularidad (el "top" que más probablemente ya viste). Marcas "no la vi" o "la vi" + una
   nota del 1 al 10.
2. **Onboarding de personas** (`/onboarding/actors`): se prioriza actores y directores que
   aparecen en títulos que marcaste como vistos, y los calificas con 👍/😐/👎.
3. **Preferencias** (`/onboarding/preferences`): eliges qué tanto te gusta cada género y cada
   país de origen de las películas/series.
4. **Recomendaciones** (`/recommendations`): un motor de scoring basado en contenido combina
   tus preferencias de género/país con los actores y directores que calificaste, más un
   pequeño empujón por popularidad, para ordenar los títulos que todavía no calificaste. Ver
   `src/lib/recommend.ts`.

Puedes calificar directamente desde la pantalla de recomendaciones — eso también alimenta el
modelo, así que mientras más usas la app, mejor se pone.

## Stack

- **Next.js 16 (App Router) + TypeScript + Tailwind CSS 4** — full-stack en un solo proyecto.
- **Prisma 7 + SQLite** (vía `@prisma/adapter-libsql`) como base de datos. En local usa un
  archivo (`dev.db`); en producción apunta a [Turso](https://turso.tech) (SQLite alojado,
  gratis) sin cambiar el schema — es lo que permite desplegarla en un hosting serverless como
  Vercel. Multi-usuario ya está soportado desde el modelo de datos.
- **NextAuth (Auth.js) v5** con login por email/contraseña (JWT sessions). Pensado para escalar
  a múltiples usuarios, cada uno con su propio historial y recomendaciones.
- **TMDB (The Movie Database)** como fuente de datos — es el reemplazo estándar y gratuito a
  la API de IMDb (que no ofrece una API pública). Si no configuras una API key, la app carga un
  dataset local curado a mano (~100 películas/series muy conocidas, sin pósters) para que
  puedas probarla sin depender de servicios externos.

## Puesta en marcha

```bash
npm install
cp .env.example .env
# Genera un secreto real para AUTH_SECRET:
#   openssl rand -base64 32
npx prisma migrate dev
npm run db:seed     # carga el catálogo (TMDB si configuraste la key, si no el dataset local)
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

### Conectar TMDB (opcional, recomendado)

1. Crea una cuenta gratis en [themoviedb.org](https://www.themoviedb.org/signup).
2. Ve a Configuración → API → genera un **API Read Access Token (v4 auth)**.
3. Pégalo en `.env` como `TMDB_API_KEY`.
4. Corre `npm run db:seed` de nuevo — esta vez importa ~130 títulos reales (con pósters,
   elenco y país) desde TMDB en vez del dataset local.

## Desplegar en producción (link público permanente)

Para tener una URL fija accesible desde cualquier dispositivo, con los datos guardados de
verdad (no solo en tu compu), hace falta una base de datos alcanzable por red — Turso — y un
hosting — Vercel. Los dos tienen plan gratis y alcanza de sobra para uso personal.

Todo este flujo se puede hacer 100% desde el navegador (celular incluido) — no hace falta
computadora ni terminal.

### 1. Crear la base de datos en Turso

1. Entra a [turso.tech](https://turso.tech) y creá una cuenta gratis (con Google o GitHub, da
   igual — son cuentas independientes de la de Vercel).
2. En el dashboard, creá una base de datos nueva (botón "Create Database"). Cualquier nombre y
   región están bien.
3. Una vez creada, andá a la base de datos y buscá:
   - **Database URL** (empieza con `libsql://...`)
   - Generá un **Auth Token** (botón "Create Token")
4. Guardá esos dos valores, los vas a necesitar en el paso 2.

### 2. Desplegar en Vercel

1. Entra a [vercel.com](https://vercel.com) y creá una cuenta gratis con GitHub (la misma
   cuenta de GitHub donde está el repo de MovieMatch).
2. "Add New" → "Project" → importá el repositorio `MovieMatch`, rama a publicar.
3. En "Environment Variables" agregá:
   - `DATABASE_URL` = la URL `libsql://...` de Turso
   - `TURSO_AUTH_TOKEN` = el token de Turso
   - `AUTH_SECRET` = un secreto random (cualquier texto largo)
   - `SEED_SECRET` = otro secreto inventado (lo usás en el paso 3)
   - `TMDB_API_KEY` = opcional, tu token de TMDB si lo tenés
4. Dale a "Deploy". A los pocos minutos te da una URL pública tipo
   `https://moviematch-tu-usuario.vercel.app`, accesible desde cualquier navegador.

### 3. Crear las tablas y cargar el catálogo

La base de Turso está vacía todavía. Con el sitio ya desplegado, abrí esta URL una vez (desde
el navegador, celular o donde sea) reemplazando el dominio y el secreto:

```
https://moviematch-tu-usuario.vercel.app/api/admin/seed?secret=EL_SEED_SECRET_QUE_PUSISTE
```

Esto crea las tablas y carga el catálogo (TMDB si configuraste `TMDB_API_KEY`, si no el
dataset local) directamente en Turso. Da un JSON como respuesta confirmando cuántos títulos y
personas cargó. Es seguro visitarla de nuevo — si ya hay datos, no hace nada (a menos que le
agregues `&force=1` al final para forzar una recarga, por ejemplo después de agregar una
`TMDB_API_KEY` que no tenías antes).

Con eso ya está: entrá a la URL de tu app y registrate.

### Alternativa con terminal (si tenés compu)

Si preferís aplicar las migraciones vos mismo en lugar de usar `/api/admin/seed`:

```bash
DATABASE_URL="libsql://tu-base-xxxx.turso.io" TURSO_AUTH_TOKEN="tu-token" npx prisma migrate deploy
DATABASE_URL="libsql://tu-base-xxxx.turso.io" TURSO_AUTH_TOKEN="tu-token" npm run db:seed
```

Cada vez que hagas push a la rama conectada, Vercel vuelve a desplegar solo.

### Scripts útiles

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Build de producción |
| `npm run lint` | Lint (ESLint) |
| `npm run db:migrate` | Aplica migraciones de Prisma |
| `npm run db:seed` | Importa/actualiza el catálogo de títulos, personas y géneros |

## Estructura del proyecto

```
prisma/schema.prisma        # Modelo de datos (usuarios, títulos, personas, ratings, prefs)
prisma/seed.ts               # Importa desde TMDB o carga el dataset local de respaldo
prisma/seed-data/fallback.ts # Dataset curado a mano (sin API key)
src/lib/auth.ts               # Config de NextAuth (Credentials + Prisma)
src/lib/recommend.ts          # Motor de recomendaciones basado en contenido
src/lib/tmdb.ts               # Cliente de la API de TMDB
src/app/onboarding/*          # Flujo de onboarding (títulos, actores, preferencias)
src/app/recommendations/      # Pantalla de recomendaciones
src/app/api/*                 # Endpoints (ratings, preferencias, recomendaciones, auth)
```

## Notas / roadmap

- El modelo de datos ya soporta múltiples usuarios (cada rating/preferencia está atado a un
  `userId`), aunque el arranque está pensado para uso individual.
- Es una app web responsive (mobile-first) — funciona igual desde el navegador en Android o
  iOS sin necesidad de instalar nada nativo. Incluye un manifest básico por si quieres
  "agregarla a la pantalla de inicio".
- El motor de recomendaciones es content-based (géneros, país, actores/directores calificados
  + popularidad). Una mejora futura natural sería sumar filtrado colaborativo una vez haya
  varios usuarios con historial.
- Para uso personal o con pocos usuarios, Turso (SQLite alojado) alcanza perfectamente. Si en
  algún momento crece mucho el volumen de escrituras concurrentes, migrar a Postgres es sencillo
  cambiando el `datasource` de Prisma y el adapter del cliente.
