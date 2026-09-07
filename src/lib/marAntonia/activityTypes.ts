import type { ChildActivityType } from "@/generated/prisma/enums";

export const ACTIVITY_TYPE_LABEL: Record<ChildActivityType, string> = {
  MEAL: "Comida",
  NAP: "Siesta",
  MILK: "Leche",
  NIGHT_WAKE: "Despertada",
  DIAPER: "Pañal",
};

export type DetailField = "mealQuality" | "milkOunces" | "wakeMood" | "diaperContent";

export const DETAIL_FIELDS: DetailField[] = ["mealQuality", "milkOunces", "wakeMood", "diaperContent"];

// Which detail field (if any) each activity type requires -- NAP has none,
// every other type has exactly one. Enforced on create (this file's
// validateActivityDetail, used by the API route) so a MEAL log can't
// silently carry a wakeMood, and a MILK log can't be saved without ounces.
export const REQUIRED_DETAIL_FIELD: Record<ChildActivityType, DetailField | null> = {
  MEAL: "mealQuality",
  NAP: null,
  MILK: "milkOunces",
  NIGHT_WAKE: "wakeMood",
  DIAPER: "diaperContent",
};

export function validateActivityDetail(
  type: ChildActivityType,
  data: Partial<Record<DetailField, unknown>>,
): string | null {
  const required = REQUIRED_DETAIL_FIELD[type];
  for (const field of DETAIL_FIELDS) {
    const present = data[field] !== undefined;
    if (field === required && !present) {
      return `Falta el detalle de ${ACTIVITY_TYPE_LABEL[type].toLowerCase()}`;
    }
    if (field !== required && present) {
      return "Ese detalle no aplica a este tipo de registro";
    }
  }
  return null;
}
