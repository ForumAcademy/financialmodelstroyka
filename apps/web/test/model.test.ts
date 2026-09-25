import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { aggregate, computeProject, periodKey, provisionalHorizon } from "../lib/model";
import { loadSeed } from "../lib/seed";
import type { DemoProject } from "../lib/types";

const demo = loadSeed().projects[0] as DemoProject;

describe("модель проекта в интерфейсе", () => {
  const m = computeProject(demo);

  it("ТЭП и машино-места показываются на стадии «Концепция»", () => {
    expect((m.result.formulas["F.TEP.SALEABLE_AREA"]?.value as Decimal).toNumber()).toBe(153882.388);
    expect((m.result.formulas["F.TEP.PARKING_COUNT"]?.value as Decimal).toNumber()).toBe(862);
    expect((m.result.formulas["F.TEP.GFA_SPLIT"]?.value as { res: Decimal }).res.toNumber()).toBe(210458);
  });

  it("незаполненные обязательные параметры подсвечиваются", () => {
    expect(m.missing.has("TAX.LAND_RATE")).toBe(true);
    expect(m.missing.has("LAND.AREA")).toBe(false);
  });

  it("горизонт (предварительно) — до последней вехи + лаг раскрытия эскроу", () => {
    // старт 31.12.2025, последняя веха 31.03.2032 → 75 мес. + 1 + лаг 1
    expect(provisionalHorizon(demo)).toBe(77);
  });

  it("перенос РНВ меняет месяц раскрытия эскроу, посчитанный ядром", () => {
    const rows = demo.input.values["TIME.MILESTONES"] as { phase: number; rnv_date: string }[];
    const moved = { ...demo, input: { ...demo.input, values: { ...demo.input.values, "TIME.MILESTONES": rows.map((r) => (r.phase === 1 ? { ...r, rnv_date: "2029-12-31" } : r)) } } };
    const release = (p: DemoProject) => {
      const r = computeProject(p).result.formulas;
      const t = (r["F.TIME.FLAG_ESCROW_RELEASE"]?.value as number[][])[0]!.indexOf(1);
      return (r["F.TIME.DATE"]?.value as string[])[t];
    };
    expect(release(demo)).toBe("2029-10-31");
    expect(release(moved)).toBe("2030-01-31");
  });

  it("периоды как в Excel: квартал по умолчанию, суммирование месяцев", () => {
    const dates = ["2025-12-31", "2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"];
    expect(periodKey("2026-02-28", "quarter")).toBe("1 кв 2026");
    expect(aggregate([1, 2, 3, 4, 5], dates, "quarter")).toEqual({ keys: ["4 кв 2025", "1 кв 2026", "2 кв 2026"], sums: [1, 9, 5] });
    expect(aggregate([1, 2, 3, 4, 5], dates, "year").sums).toEqual([1, 14]);
  });
});
