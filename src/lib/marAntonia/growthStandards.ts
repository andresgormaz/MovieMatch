// Approximate WHO Child Growth Standards (0-24 months), used only to draw a
// "typical range" reference band behind the child's own measurements -- NOT
// a precise percentile calculator. The median (P50) values below are the
// well-published WHO figures; the band around them is derived from a
// roughly constant coefficient of variation per measure (a standard
// simplification -- the real WHO tables use a slightly skewed LMS
// distribution, not a symmetric one), so treat the shaded band as "this is
// broadly the range most babies fall in," not as a diagnostic percentile
// line. Always defer to the pediatrician's own reading of the growth chart.
export type GrowthMeasure = "weight" | "height" | "headCircumference";
export type ChildSex = "MALE" | "FEMALE";

// Approximate coefficient of variation (SD / mean) per measure, roughly
// constant across 0-24 months for these three indicators.
const CV: Record<GrowthMeasure, number> = {
  weight: 0.13,
  height: 0.045,
  headCircumference: 0.035,
};

// z-scores for the percentiles used to draw the band (symmetric approximation).
const Z_LOW = -1.881; // ~P3
const Z_HIGH = 1.881; // ~P97

// WHO median (P50) by month (0-24), boys then girls.
const MEDIANS: Record<GrowthMeasure, Record<ChildSex, number[]>> = {
  weight: {
    // kg, months 0-24
    MALE: [
      3.3, 4.5, 5.6, 6.4, 7.0, 7.5, 7.9, 8.3, 8.6, 8.9, 9.2, 9.4, 9.6, 9.9, 10.1, 10.3, 10.5, 10.7, 10.9, 11.1, 11.3,
      11.5, 11.8, 12.0, 12.2,
    ],
    FEMALE: [
      3.2, 4.2, 5.1, 5.8, 6.4, 6.9, 7.3, 7.6, 7.9, 8.2, 8.5, 8.7, 8.9, 9.2, 9.4, 9.6, 9.8, 10.0, 10.2, 10.4, 10.6,
      10.9, 11.1, 11.3, 11.5,
    ],
  },
  height: {
    // cm, months 0-24
    MALE: [
      49.9, 54.7, 58.4, 61.4, 63.9, 65.9, 67.6, 69.2, 70.6, 72.0, 73.3, 74.5, 75.7, 76.9, 78.0, 79.1, 80.2, 81.2,
      82.3, 83.2, 84.2, 85.1, 86.0, 86.9, 87.8,
    ],
    FEMALE: [
      49.1, 53.7, 57.1, 59.8, 62.1, 64.0, 65.7, 67.3, 68.7, 70.1, 71.5, 72.8, 74.0, 75.2, 76.4, 77.5, 78.6, 79.7,
      80.7, 81.7, 82.7, 83.7, 84.6, 85.5, 86.4,
    ],
  },
  headCircumference: {
    // cm, months 0-24
    MALE: [
      34.5, 37.3, 39.1, 40.5, 41.6, 42.6, 43.3, 44.0, 44.5, 45.0, 45.4, 45.8, 46.1, 46.3, 46.6, 46.8, 47.0, 47.2,
      47.4, 47.5, 47.7, 47.8, 48.0, 48.1, 48.3,
    ],
    FEMALE: [
      33.9, 36.5, 38.3, 39.5, 40.6, 41.5, 42.2, 42.8, 43.4, 43.8, 44.2, 44.6, 44.9, 45.2, 45.4, 45.6, 45.8, 46.0,
      46.2, 46.3, 46.5, 46.6, 46.8, 46.9, 47.0,
    ],
  },
};

export interface ReferencePoint {
  months: number;
  low: number;
  median: number;
  high: number;
}

// Linearly interpolates between whole-month medians so the reference band
// isn't visibly kinked at every integer month.
function medianAt(measure: GrowthMeasure, sex: ChildSex, months: number): number {
  const table = MEDIANS[measure][sex];
  const clamped = Math.max(0, Math.min(months, table.length - 1));
  const lowerIndex = Math.floor(clamped);
  const upperIndex = Math.min(lowerIndex + 1, table.length - 1);
  const frac = clamped - lowerIndex;
  return table[lowerIndex] + (table[upperIndex] - table[lowerIndex]) * frac;
}

export function referenceBand(measure: GrowthMeasure, sex: ChildSex, maxMonths: number, stepMonths = 1): ReferencePoint[] {
  const points: ReferencePoint[] = [];
  for (let m = 0; m <= maxMonths; m += stepMonths) {
    const median = medianAt(measure, sex, m);
    const sd = median * CV[measure];
    points.push({ months: m, low: median + Z_LOW * sd, median, high: median + Z_HIGH * sd });
  }
  return points;
}

export const MEASURE_LABEL: Record<GrowthMeasure, string> = {
  weight: "Peso",
  height: "Estatura",
  headCircumference: "Circunferencia de cabeza",
};

export const MEASURE_UNIT: Record<GrowthMeasure, string> = {
  weight: "kg",
  height: "cm",
  headCircumference: "cm",
};
