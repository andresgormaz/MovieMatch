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
  score: z.number().int().min(1).max(10).nullable(),
});

export const personRatingSchema = z.object({
  personId: z.string().min(1),
  score: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
});

export const genrePreferenceSchema = z.object({
  genreId: z.number().int(),
  weight: z.number().int().min(-2).max(2),
});

export const countryPreferenceSchema = z.object({
  countryCode: z.string().trim().length(2),
  weight: z.number().int().min(-2).max(2),
});
