import { describe, expect, it } from "vitest";
import { isStale, sourceStatus } from "../lib/sources";

describe("устаревание источника (квартальный цикл актуализации)", () => {
  it("проверка в пределах 3 месяцев — актуальна", () => {
    expect(isStale("2026-09-25", new Date("2026-12-24"))).toBe(false);
  });
  it("проверка старше 3 месяцев — устарела", () => {
    expect(isStale("2026-09-25", new Date("2026-12-26"))).toBe(true);
  });
});

describe("статус источника с выбором пользователя", () => {
  const today = new Date("2026-10-01");
  it("не сверен без выбора", () => {
    expect(sourceStatus({ verified: false, accessed: "2026-09-25" }, undefined, today).issue).toBe("unverified");
  });
  it("«Сверен» делает источник сверенным и обновляет дату", () => {
    const st = sourceStatus({ verified: false, accessed: "2026-01-10" }, { verified: true, date: "2026-09-30" }, today);
    expect(st).toEqual({ verified: true, accessed: "2026-09-30", issue: null });
  });
  it("«Не сверен» у сверенного источника — требует сверки", () => {
    expect(sourceStatus({ verified: true, accessed: "2026-09-25" }, { verified: false, date: "2026-10-01" }, today).issue).toBe("unverified");
  });
  it("сверенный, но старый — устарел; повторный выбор «Сверен» обновляет дату", () => {
    expect(sourceStatus({ verified: true, accessed: "2026-05-01" }, undefined, today).issue).toBe("stale");
    expect(sourceStatus({ verified: true, accessed: "2026-05-01" }, { verified: true, date: "2026-10-01" }, today).issue).toBeNull();
  });
});
