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
- **Prisma 7 + SQLite** (vía `@prisma/adapter-better-sqlite3`) como base de datos. Fácil de
  migrar a Postgres más adelante si crece (multi-usuario ya está soportado desde el modelo de
  datos).
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
- Actualmente usa SQLite para simplicidad local; para producción con varios usuarios
  concurrentes conviene migrar el `datasource` de Prisma a Postgres.
