import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { calculate } from "@fm/engine";
import { aggregate, compatWarnings, computeProject, periodKey, provisionalHorizon } from "../lib/model";
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

  it("бюджет считается ядром: «Компенсация городу» в денежном потоке, УДС — как в исходнике, только в бюджете", () => {
    const cash = m.result.formulas["F.CAPEX.ITEM_CASH"]?.value as Record<string, Decimal[]>;
    const sum = (xs: Decimal[] | undefined) => (xs ?? []).reduce((a, b) => a.add(b), new Decimal(0)).toNumber();
    expect(sum(cash.CITY_CASH_COMPENSATION)).toBe(1260033986.66);
    expect(sum(cash.ROADS_UDS)).toBe(0);
    expect(compatWarnings(demo, m).map((w) => w.key)).toContain("CAPEX.SCHEDULE_SUM:ROADS_UDS");
    expect((m.result.formulas["F.CAPEX.TOTAL"]?.value as Decimal).gt(0)).toBe(true);
  });

  it("незаполненные обязательные параметры подсвечиваются", () => {
    expect(m.missing.has("TAX.LAND_RATE")).toBe(true);
    expect(m.missing.has("LAND.AREA")).toBe(false);
  });

  it("горизонт (предварительно) — до последней вехи + лаг раскрытия эскроу, но не короче ручных графиков бюджета и темпа продаж", () => {
    // старт 31.12.2025, последняя веха 31.03.2032 → 75 мес. + 1 + лаг 3 = 79;
    // продажи ПСН исходника — по 4 кв 2033 → декабрь 2033 = 96 мес. + 1 = 97;
    // маркетинг в CF1 (строка 79, сдвиг на 7 кварталов) — по 3 кв 2035 → сентябрь 2035 = 117 мес. + 1
    expect(provisionalHorizon(demo)).toBe(118);
  });

  it("раскрытие эскроу: в расчёте «как в исходном Excel» — дата исходника, в расчёте сервиса — РНВ + 3 месяца, и перенос РНВ его сдвигает", () => {
    const rows = demo.input.values["TIME.MILESTONES"] as { phase: number; rnv_date: string }[];
    const moved = { ...demo, input: { ...demo.input, values: { ...demo.input.values, "TIME.MILESTONES": rows.map((r) => (r.phase === 1 ? { ...r, rnv_date: "2029-12-31" } : r)) } } };
    const release = (p: DemoProject) => {
      const r = computeProject(p).result.formulas;
      const t = (r["F.TIME.FLAG_ESCROW_RELEASE"]?.value as number[][])[0]!.indexOf(1);
      return (r["F.TIME.DATE"]?.value as string[])[t];
    };
    expect(release(demo)).toBe("2031-09-30");
    expect(release(moved)).toBe("2031-09-30");
    // расчёт сервиса: только флаги (для полного расчёта у демо-проекта нет вводных расчёта сервиса)
    const normal = (p: DemoProject) => {
      const r = calculate({ ...p.input, mode: "normal" }, { horizonMonths: provisionalHorizon(p) ?? 0 }, ["F.TIME.FLAG_ESCROW_RELEASE"]).formulas;
      const t = (r["F.TIME.FLAG_ESCROW_RELEASE"]?.value as number[][])[0]!.indexOf(1);
      return (r["F.TIME.DATE"]?.value as string[])[t];
    };
    expect(normal(demo)).toBe("2029-12-31");
    expect(normal(moved)).toBe("2030-03-31");
  });

  it("периоды как в Excel: квартал по умолчанию, суммирование месяцев", () => {
    const dates = ["2025-12-31", "2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"];
    expect(periodKey("2026-02-28", "quarter")).toBe("1 кв 2026");
    expect(aggregate([1, 2, 3, 4, 5], dates, "quarter")).toEqual({ keys: ["4 кв 2025", "1 кв 2026", "2 кв 2026"], sums: [1, 9, 5] });
    expect(aggregate([1, 2, 3, 4, 5], dates, "year").sums).toEqual([1, 14]);
  });
});
