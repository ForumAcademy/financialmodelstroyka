import { describe, expect, it } from "vitest";
import { isStale } from "../lib/sources";

describe("устаревание источника (квартальный цикл актуализации)", () => {
  it("проверка в пределах 3 месяцев — актуальна", () => {
    expect(isStale("2026-09-25", new Date("2026-12-24"))).toBe(false);
  });
  it("проверка старше 3 месяцев — устарела", () => {
    expect(isStale("2026-09-25", new Date("2026-12-26"))).toBe(true);
  });
});
