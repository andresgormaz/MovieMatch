import type { ChildActivityType } from "@/generated/prisma/enums";

export const ACTIVITY_TYPE_LABEL: Record<ChildActivityType, string> = {
  MEAL: "Comida",
  NAP: "Siesta",
  MILK: "Leche",
  NIGHT_WAKE: "Despertada",
  DIAPER: "Pañal",
};

export type DetailField =
  | "mealQuality"
  | "milkOunces"
  | "wakeMood"
  | "diaperContent"
  | "diaperAmount"
  | "diaperConsistency";

export const DETAIL_FIELDS: DetailField[] = [
  "mealQuality",
  "milkOunces",
  "wakeMood",
  "diaperContent",
  "diaperAmount",
  "diaperConsistency",
];

// MEAL/NAP/MILK/NIGHT_WAKE each have at most one detail field. DIAPER is the
// exception -- see validateDiaperDetail below -- so it's left out here and
// handled on its own.
const SIMPLE_REQUIRED_FIELD: Partial<Record<ChildActivityType, DetailField | null>> = {
  MEAL: "mealQuality",
  NAP: null,
  MILK: "milkOunces",
  NIGHT_WAKE: "wakeMood",
};

const SIMPLE_DETAIL_FIELDS = DETAIL_FIELDS.filter(
  (f) => f !== "diaperAmount" && f !== "diaperConsistency",
) as Exclude<DetailField, "diaperAmount" | "diaperConsistency">[];

// `== null` (loose) on purpose everywhere below -- both an omitted field
// (undefined) and an explicit null (how a patch clears a field, e.g.
// dropping diaperAmount/diaperConsistency when a POOP diaper is edited back
// to PEE) mean "not present" here.
export function validateActivityDetail(
  type: ChildActivityType,
  data: Partial<Record<DetailField, unknown>>,
): string | null {
  if (type === "DIAPER") return validateDiaperDetail(data);

  const required = SIMPLE_REQUIRED_FIELD[type] ?? null;
  for (const field of SIMPLE_DETAIL_FIELDS) {
    const present = data[field] != null;
    if (field === required && !present) {
      return `Falta el detalle de ${ACTIVITY_TYPE_LABEL[type].toLowerCase()}`;
    }
    if (field !== required && present) {
      return "Ese detalle no aplica a este tipo de registro";
    }
  }
  if (data.diaperAmount != null || data.diaperConsistency != null) {
    return "Ese detalle no aplica a este tipo de registro";
  }
  return null;
}

// DIAPER always needs diaperContent. When it's POOP, it also needs
// diaperAmount (poca/mucha) and diaperConsistency (normal/dura/diarrea);
// when it's PEE, neither applies -- a pee diaper has no amount/consistency
// to report.
function validateDiaperDetail(data: Partial<Record<DetailField, unknown>>): string | null {
  if (data.mealQuality != null || data.milkOunces != null || data.wakeMood != null) {
    return "Ese detalle no aplica a este tipo de registro";
  }
  if (data.diaperContent == null) return "Falta el detalle de pañal";

  if (data.diaperContent === "POOP") {
    if (data.diaperAmount == null) return "Elige cuánta caca tenía";
    if (data.diaperConsistency == null) return "Elige cómo era la caca";
  } else if (data.diaperAmount != null || data.diaperConsistency != null) {
    return "La cantidad y consistencia solo aplican cuando el pañal tiene caca";
  }
  return null;
}
