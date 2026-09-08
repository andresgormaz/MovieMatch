import type { ChildActivityType, SleepType } from "@/generated/prisma/enums";

export const ACTIVITY_TYPE_LABEL: Record<ChildActivityType, string> = {
  MEAL: "Comida",
  SLEEP: "Dormir",
  MILK: "Leche",
  NIGHT_WAKE: "Despertada",
  DIAPER: "Pañal",
};

// Display label only -- the enum value stays NOCHE (matches the schema/
// migration history), but the user-facing category is called "Dormir" now
// that siesta and overnight sleep are two fully separate quick-log buttons
// instead of one "Dormir" button with a siesta/noche picker inside it.
export const SLEEP_TYPE_LABEL: Record<SleepType, string> = {
  SIESTA: "Siesta",
  NOCHE: "Dormir",
};

export type DetailField =
  | "mealQuality"
  | "milkOunces"
  | "wakeMood"
  | "diaperContent"
  | "diaperAmount"
  | "diaperConsistency"
  | "sleepType"
  | "sleepEndedAt"
  | "sleepAchievedAt";

export const DETAIL_FIELDS: DetailField[] = [
  "mealQuality",
  "milkOunces",
  "wakeMood",
  "diaperContent",
  "diaperAmount",
  "diaperConsistency",
  "sleepType",
  "sleepEndedAt",
  "sleepAchievedAt",
];

// MEAL/MILK/NIGHT_WAKE each have at most one detail field. DIAPER and SLEEP
// are the exceptions -- see validateDiaperDetail/validateSleepDetail below --
// so they're left out here and handled on their own.
const SIMPLE_REQUIRED_FIELD: Partial<Record<ChildActivityType, DetailField | null>> = {
  MEAL: "mealQuality",
  MILK: "milkOunces",
  NIGHT_WAKE: "wakeMood",
};

const SLEEP_ONLY_FIELDS = ["sleepType", "sleepEndedAt", "sleepAchievedAt"] as const;
const SIMPLE_DETAIL_FIELDS = DETAIL_FIELDS.filter(
  (f) => f !== "diaperAmount" && f !== "diaperConsistency" && !(SLEEP_ONLY_FIELDS as readonly string[]).includes(f),
) as Exclude<DetailField, "diaperAmount" | "diaperConsistency" | (typeof SLEEP_ONLY_FIELDS)[number]>[];

// `== null` (loose) on purpose everywhere below -- both an omitted field
// (undefined) and an explicit null (how a patch clears a field, e.g.
// dropping diaperAmount/diaperConsistency when a POOP diaper is edited back
// to PEE) mean "not present" here.
export function validateActivityDetail(
  type: ChildActivityType,
  data: Partial<Record<DetailField, unknown>>,
): string | null {
  if (type === "DIAPER") return validateDiaperDetail(data);
  if (type === "SLEEP") return validateSleepDetail(data);

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
  if (data.sleepType != null || data.sleepEndedAt != null || data.sleepAchievedAt != null) {
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
  if (data.sleepType != null || data.sleepEndedAt != null || data.sleepAchievedAt != null) {
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

// SLEEP always needs sleepType (siesta/noche). sleepEndedAt/sleepAchievedAt
// are optional -- present means that checkpoint already happened,
// absent/null means it hasn't yet -- so neither is checked for presence
// here. sleepAchievedAt (the "logrado" checkpoint, tracking how long it
// takes to fall asleep) only makes sense for NOCHE -- siesta has no such
// middle step.
function validateSleepDetail(data: Partial<Record<DetailField, unknown>>): string | null {
  if (
    data.mealQuality != null ||
    data.milkOunces != null ||
    data.wakeMood != null ||
    data.diaperContent != null ||
    data.diaperAmount != null ||
    data.diaperConsistency != null
  ) {
    return "Ese detalle no aplica a este tipo de registro";
  }
  if (data.sleepType == null) return "Elige si es siesta o noche";
  if (data.sleepType === "SIESTA" && data.sleepAchievedAt != null) {
    return "Eso no aplica a la siesta";
  }
  return null;
}
