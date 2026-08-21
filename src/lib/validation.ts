import { z } from "zod";
import { STREAMING_REGIONS } from "./countries";

export const registerSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(80),
  email: z.string().trim().toLowerCase().email("Email inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(200),
  country: z.enum(STREAMING_REGIONS as [string, ...string[]], {
    message: "Selecciona tu país",
  }),
});

export const titleRatingSchema = z.object({
  titleId: z.string().min(1),
  seen: z.boolean(),
  score: z.number().int().min(1).max(5).nullable(),
});

export const titleUnrateSchema = z.object({
  titleId: z.string().min(1),
});

export const personRatingSchema = z.object({
  personId: z.string().min(1),
  score: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
});

// "Mis gustos" no longer sets an absolute weight -- every preference is a
// running total of +1/-1 clicks, added to whatever was derived from actual
// "vs"/rating activity (see preferenceCounts.ts). `key` means something
// different per category: a genreId (as a string), a TitleType, an
// AudienceTier, a BudgetTier, a RuntimeBucket, a PopularityRange, an
// ISO country code, or a Person id.
export const preferenceAdjustSchema = z.object({
  category: z.enum(["type", "genre", "audience", "budget", "runtime", "popularity", "country", "actor", "director"]),
  key: z.string().min(1),
  delta: z.union([z.literal(1), z.literal(-1)]),
});

export const wishlistSchema = z.object({
  titleId: z.string().min(1),
});

// Mirrors CatalogFilters (src/components/explore/FilterPanel.tsx) -- the
// same shape the filter panel already builds client-side, just validated
// and size-capped before it's JSON-stringified into SavedFilter.filters.
const personOptionSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  photoUrl: z.string().nullable(),
});

const catalogFiltersSchema = z.object({
  q: z.string().max(200),
  type: z.enum(["", "MOVIE", "SERIES"]),
  yearFrom: z.union([z.number(), z.literal("")]),
  yearTo: z.union([z.number(), z.literal("")]),
  scoreFrom: z.union([z.number(), z.literal("")]),
  scoreTo: z.union([z.number(), z.literal("")]),
  votesMin: z.union([z.number(), z.literal("")]),
  budgetFrom: z.union([z.number(), z.literal("")]),
  budgetTo: z.union([z.number(), z.literal("")]),
  genreIds: z.array(z.number()).max(200),
  countries: z.array(z.string()).max(200),
  providerIds: z.array(z.number()).max(200),
  actor: personOptionSchema.nullable(),
  director: personOptionSchema.nullable(),
  sort: z.enum(["popularity", "year", "score", "votes"]),
});

export const savedFilterSchema = z.object({
  name: z.string().trim().min(1, "Ponle un nombre al filtro").max(60, "Nombre muy largo (máx. 60 caracteres)"),
  filters: catalogFiltersSchema,
});
