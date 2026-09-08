import { describe, expect, it } from "vitest";
import { validateActivityDetail } from "./activityTypes";

describe("validateActivityDetail: SLEEP", () => {
  it("requires a sleepType", () => {
    expect(validateActivityDetail("SLEEP", {})).toBe("Elige si es siesta o noche");
  });

  it("accepts a sleepType with no end time (session in progress)", () => {
    expect(validateActivityDetail("SLEEP", { sleepType: "SIESTA" })).toBeNull();
  });

  it("accepts a sleepType with an end time (session already closed)", () => {
    expect(
      validateActivityDetail("SLEEP", { sleepType: "NOCHE", sleepEndedAt: "2026-09-08T06:00:00.000Z" }),
    ).toBeNull();
  });

  it("rejects a detail field from another activity type", () => {
    expect(validateActivityDetail("SLEEP", { sleepType: "SIESTA", milkOunces: 4 })).toBe(
      "Ese detalle no aplica a este tipo de registro",
    );
  });

  it("rejects sleepType/sleepEndedAt on a non-SLEEP activity", () => {
    expect(validateActivityDetail("MILK", { milkOunces: 4, sleepType: "SIESTA" })).toBe(
      "Ese detalle no aplica a este tipo de registro",
    );
    expect(
      validateActivityDetail("DIAPER", { diaperContent: "PEE", sleepEndedAt: "2026-09-08T06:00:00.000Z" }),
    ).toBe("Ese detalle no aplica a este tipo de registro");
  });
});
