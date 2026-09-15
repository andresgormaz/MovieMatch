// Chile's Programa Nacional de Inmunizaciones (PNI) -- a fixed reference
// schedule, not per-child data, so it lives here as static content rather
// than in the database (see ChildVaccineDose, which only tracks *whether* a
// given dose has been applied to this child, keyed by each entry's `key`).
//
// This is a general reference based on the publicly known PNI schedule, not
// a live feed from MINSAL -- ages, doses, or eligibility can change over
// time (and some vaccines are only for certain birth cohorts). Always
// confirm the exact scheme with your pediatrician, your child's carné de
// vacunación, or https://vacunas.minsal.cl before making any decision.
export interface VaccineDose {
  key: string;
  vaccine: string;
  doseLabel: string;
  protectsAgainst: string;
  notes?: string;
}

export interface VaccineStage {
  ageLabel: string;
  ageMonths: number; // for sorting/upcoming-dose logic -- approximate for multi-year stages
  doses: VaccineDose[];
}

export const CHILE_VACCINE_SCHEDULE: VaccineStage[] = [
  {
    ageLabel: "Recién nacido",
    ageMonths: 0,
    doses: [
      {
        key: "bcg-rn",
        vaccine: "BCG",
        doseLabel: "Dosis única",
        protectsAgainst: "Formas graves de tuberculosis (meníngea y miliar)",
        notes: "Se aplica antes del alta de la maternidad.",
      },
    ],
  },
  {
    ageLabel: "2 meses",
    ageMonths: 2,
    doses: [
      {
        key: "pentavalente-2m",
        vaccine: "Pentavalente",
        doseLabel: "1ª dosis",
        protectsAgainst: "Difteria, tétanos, tos convulsiva (coqueluche), hepatitis B y Haemophilus influenzae tipo b",
      },
      { key: "polio-2m", vaccine: "Polio inactivada (IPV)", doseLabel: "1ª dosis", protectsAgainst: "Poliomielitis" },
      {
        key: "neumococo-2m",
        vaccine: "Neumocócica conjugada",
        doseLabel: "1ª dosis",
        protectsAgainst: "Neumonía, meningitis y otitis por neumococo",
      },
      {
        key: "rotavirus-2m",
        vaccine: "Rotavirus",
        doseLabel: "1ª dosis",
        protectsAgainst: "Diarrea y deshidratación grave por rotavirus",
        notes: "Vacuna oral.",
      },
    ],
  },
  {
    ageLabel: "4 meses",
    ageMonths: 4,
    doses: [
      { key: "pentavalente-4m", vaccine: "Pentavalente", doseLabel: "2ª dosis", protectsAgainst: "Difteria, tétanos, tos convulsiva, hepatitis B y Haemophilus influenzae tipo b" },
      { key: "polio-4m", vaccine: "Polio inactivada (IPV)", doseLabel: "2ª dosis", protectsAgainst: "Poliomielitis" },
      { key: "neumococo-4m", vaccine: "Neumocócica conjugada", doseLabel: "2ª dosis", protectsAgainst: "Neumonía, meningitis y otitis por neumococo" },
      { key: "rotavirus-4m", vaccine: "Rotavirus", doseLabel: "2ª dosis (última)", protectsAgainst: "Diarrea y deshidratación grave por rotavirus", notes: "Vacuna oral." },
    ],
  },
  {
    ageLabel: "6 meses",
    ageMonths: 6,
    doses: [
      { key: "pentavalente-6m", vaccine: "Pentavalente", doseLabel: "3ª dosis", protectsAgainst: "Difteria, tétanos, tos convulsiva, hepatitis B y Haemophilus influenzae tipo b" },
      { key: "polio-6m", vaccine: "Polio inactivada (IPV)", doseLabel: "3ª dosis", protectsAgainst: "Poliomielitis" },
      {
        key: "influenza-6m",
        vaccine: "Influenza",
        doseLabel: "Campaña anual",
        protectsAgainst: "Influenza (gripe) estacional",
        notes: "Se repite cada año durante la campaña de invierno, desde los 6 meses en adelante.",
      },
    ],
  },
  {
    ageLabel: "12 meses",
    ageMonths: 12,
    doses: [
      {
        key: "srp-12m",
        vaccine: "Tresvírica (SRP)",
        doseLabel: "1ª dosis",
        protectsAgainst: "Sarampión, rubéola y paperas (parotiditis)",
      },
      { key: "neumococo-12m", vaccine: "Neumocócica conjugada", doseLabel: "Refuerzo", protectsAgainst: "Neumonía, meningitis y otitis por neumococo" },
      { key: "varicela-12m", vaccine: "Varicela", doseLabel: "Dosis única", protectsAgainst: "Varicela" },
    ],
  },
  {
    ageLabel: "18 meses",
    ageMonths: 18,
    doses: [
      { key: "pentavalente-18m", vaccine: "Pentavalente", doseLabel: "Refuerzo", protectsAgainst: "Difteria, tétanos, tos convulsiva, hepatitis B y Haemophilus influenzae tipo b" },
      { key: "polio-18m", vaccine: "Polio inactivada (IPV)", doseLabel: "Refuerzo", protectsAgainst: "Poliomielitis" },
    ],
  },
  {
    ageLabel: "Entre 4 y 6 años (antes de 1° básico)",
    ageMonths: 54,
    doses: [
      { key: "dtp-4-6a", vaccine: "DTP", doseLabel: "Refuerzo", protectsAgainst: "Difteria, tétanos y tos convulsiva" },
      { key: "polio-4-6a", vaccine: "Polio inactivada (IPV)", doseLabel: "Refuerzo", protectsAgainst: "Poliomielitis" },
      { key: "srp-4-6a", vaccine: "Tresvírica (SRP)", doseLabel: "2ª dosis", protectsAgainst: "Sarampión, rubéola y paperas" },
    ],
  },
  {
    ageLabel: "1° básico (escolar)",
    ageMonths: 72,
    doses: [
      {
        key: "vph-1basico",
        vaccine: "VPH (virus papiloma humano)",
        doseLabel: "1ª dosis",
        protectsAgainst: "Cánceres asociados al VPH (cuello uterino y otros)",
        notes: "Se administra tanto a niñas como a niños.",
      },
      {
        key: "influenza-escolar",
        vaccine: "Influenza",
        doseLabel: "Campaña anual",
        protectsAgainst: "Influenza (gripe) estacional",
      },
    ],
  },
];

export function allVaccineKeys(): string[] {
  return CHILE_VACCINE_SCHEDULE.flatMap((stage) => stage.doses.map((d) => d.key));
}
