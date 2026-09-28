import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { buildSheet, cell, periodLabel, rowByPeriod } from "../lib/calc-sheets";
import { computeProject } from "../lib/model";
import { SHEETS } from "../lib/project-nav";
import { loadSeed } from "../lib/seed";
import type { DemoProject } from "../lib/types";

const demo = loadSeed().projects[0] as DemoProject;
const legacy = { ...demo, input: { ...demo.input, mode: "legacy" as const } };
const normal = { ...demo, input: { ...demo.input, mode: "normal" as const } };
const ml = computeProject(legacy);
const mn = computeProject(normal);
const sp = (t: string | null) => (t ?? "").replace(/\u00a0|\u202f/g, " ");
const sum = (xs: number[] | null) => (xs ?? []).reduce((a, b) => a + b, 0);
const row = (id: Parameters<typeof buildSheet>[0], label: string, p = legacy, m = ml) => buildSheet(id, p, m).rows.find((r) => r.label === label)!;

describe("листы «Расчёта»", () => {
  it("итоги листов — те же числа, что посчитало ядро «Как в исходном Excel»", () => {
    const revenue = (ml.result.formulas["F.SALES.REVENUE_TOTAL"]?.value as { gross: Decimal }).gross.toNumber();
    expect(sum(row("sales", "Выручка").series)).toBeCloseTo(revenue, 0);
    expect(sum(row("budget", "Итого затраты").series)).toBeCloseTo((ml.result.formulas["F.CAPEX.TOTAL"]?.value as Decimal).toNumber(), 0);
    expect(sum(row("escrow", "Раскрыто").series)).toBeCloseTo(sum(row("escrow", "Поступило на эскроу").series), 0);
    // выручка = деньги на эскроу + продажи после ввода + то, что покупатели заплатят позже
    expect(sum(row("escrow", "Поступило на эскроу").series) + sum(row("escrow", "Продано после ввода").series)).toBeCloseTo(sum(row("sales", "Поступления от покупателей").series), 0);
  });

  it("на экране нет служебных рядов и кодов, у каждой строки есть пояснение", () => {
    for (const { id } of SHEETS) {
      for (const r of buildSheet(id, legacy, ml).rows) {
        expect(r.label).not.toMatch(/F\.|CF1|флаг|дней|шкала|этап/i);
        expect(r.how).not.toMatch(/F\.[A-Z]|CHECK\./);
        expect(r.how.length).toBeGreaterThan(0);
        if (r.series && sum(r.series.map(Math.abs))) expect(r.example, r.label).toBeTruthy();
      }
    }
  });

  it("«На цифрах проекта»: продано × средняя цена = выручка продукта", () => {
    expect(sp(row("sales", "Квартиры Тип 1").example)).toBe("33 739 м² × средняя цена 656 931 руб/м² = 22,2 млрд руб.");
    expect(sp(row("sales", "Машино-места").example)).toMatch(/^862 шт × средняя цена .* руб\/шт = 13,6 млрд руб\.$/);
    expect(row("budget", "Участок и права").links[0]).toMatchObject({ step: "costs", tab: 0 });
  });

  it("в расчёте сервиса листы без цен продаж ещё не рассчитываются, бюджет — рассчитывается", () => {
    expect(buildSheet("sales", normal, mn).ready).toBe(false);
    expect(buildSheet("escrow", normal, mn).ready).toBe(false);
    expect(buildSheet("cf", normal, mn).ready).toBe(false);
    expect(buildSheet("budget", normal, mn).ready).toBe(true);
    // строки, которые ядро ещё не считает, помечаются, а не показываются нулями
    expect(row("cf", "Налоги").series).toBeNull();
  });

  it("период: год и квартал в млрд руб, месяц в млн руб; остаток — на конец периода, без итога; раскрытие — в месяц раскрытия", () => {
    const dates = buildSheet("escrow", legacy, ml).dates;
    const balance = row("escrow", "Остаток на конец периода");
    const y = rowByPeriod(balance, dates, "year");
    expect(y.total).toBeNull();
    const last = balance.series!.map((_, t) => t).filter((t) => dates[t]!.startsWith("2030")).at(-1)!;
    expect(y.values[y.keys.indexOf("2030")]).toBe(balance.series![last]);
    const rel = rowByPeriod(row("escrow", "Раскрыто"), dates, "month");
    expect(rel.values.filter((v) => v !== 0)).toHaveLength(1);
    expect(periodLabel(rel.keys[rel.values.findIndex((v) => v !== 0)]!, "month")).toBe("сен 2031");
    expect(cell(89_012_345_678, "year")).toBe("89,0");
    expect(cell(89_012_345_678, "quarter")).toBe("89,01");
    expect(sp(cell(-1_234_567_890, "month"))).toBe("−1 235");
    expect(cell(1_000, "year")).toBe("—");
  });
});
