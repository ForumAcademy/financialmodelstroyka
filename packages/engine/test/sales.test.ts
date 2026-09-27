import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { spec } from "@fm/spec";
import { calculate, type ResultSet } from "../src";
import { legacyInput, loadCase } from "./support/cases";

type RowSeries = Record<string, Decimal[]>;

const sum = (xs: Decimal[]) => xs.reduce((a, b) => a.add(b), new Decimal(0));
const rows = (r: ResultSet, id: "F.SALES.SOLD_AREA" | "F.SALES.PRICE" | "F.SALES.CONTRACT_VALUE") => r.formulas[id]?.value as RowSeries;
const nums = (xs: Decimal[] | undefined) => (xs ?? []).map((x) => Number(x.toFixed(6)));

// Горизонт — до 4 кв 2033 (последний квартал продаж ПСН исходника): t = 0 — декабрь 2025
const LEGACY_HORIZON = 100;

describe("SALES: Дербеневская в режиме совместимости", () => {
  const c = loadCase("derbenevskaya_legacy");
  const r = calculate(legacyInput(c), { horizonMonths: LEGACY_HORIZON });
  const rev = r.formulas["F.SALES.REVENUE_TOTAL"]?.value as { gross: Decimal; byRow: Record<string, Decimal> };
  const t = c.reconciliation_targets as Record<string, number>;

  it("выручка по типам совпадает с исходником с точностью 1 руб (reconciliation_targets)", () => {
    const expected: [string, number][] = [
      ["Квартиры Тип 1", t.sales_value_type1 as number],
      ["Квартиры Тип 2", t.sales_value_type2 as number],
      ["Квартиры Тип 3", t.sales_value_type3 as number],
      ["ПСН", t.sales_value_psn as number],
      ["Машино-места", t.sales_value_parking as number],
    ];
    for (const [key, value] of expected) expect(rev.byRow[key]?.sub(value).abs().lt(1), key).toBe(true);
    expect(rev.gross.sub(t.sales_value_total as number).abs().lt(1)).toBe(true);
  });

  it("поступления от покупателей = выручке плана продаж (исходник CF1 — 117 514 091 710,14)", () => {
    const cash = r.formulas["F.SALES.CASH_IN"]?.value as { total: RowSeries };
    expect(sum(Object.values(cash.total).flat()).sub(rev.gross).abs().lt(1e-6)).toBe(true);
  });

  it("ПСН продано больше запаса, как в исходнике, — с предупреждением", () => {
    expect(sum(rows(r, "F.SALES.SOLD_AREA").ПСН as Decimal[]).toNumber()).toBeCloseTo(10888.608, 6);
    expect(r.messages).toContainEqual(expect.objectContaining({ severity: "warning", formulaId: "F.SALES.SOLD_AREA", text: expect.stringMatching(/«ПСН»: по темпу исходника продано 10\s888,61 м² при запасе 10\s322 м²/) }));
    expect(r.messages.filter((m) => m.formulaId === "F.SALES.SOLD_AREA")).toHaveLength(1);
  });

  it("цена растёт на 2% в квартал ступенькой: 1 кв 2026 — стартовая, 2 кв 2026 — × 1,02", () => {
    const p = rows(r, "F.SALES.PRICE")["Квартиры Тип 1"] as Decimal[];
    expect(nums(p.slice(0, 5))).toEqual([497703, 497703, 497703, 497703, 507657.06]);
  });

  it("брокеридж и маркетинг в CF = 3,5% × выручка по месяцам продаж (исходник CF1 — 2 733 176 548,21)", () => {
    const cash = r.formulas["F.CAPEX.ITEM_CASH"]?.value as Record<string, Decimal[]>;
    expect(sum(cash.BROKERAGE as Decimal[]).toFixed(2)).toBe("4134560080.86");
    expect(sum(cash.MARKETING as Decimal[]).toFixed(2)).toBe("4134560080.86");
    // график — как договоры: в месяце с продажами доля = доле выручки месяца
    const value = Object.values(rows(r, "F.SALES.CONTRACT_VALUE"));
    const month1 = sum(value.map((s) => s[1] as Decimal));
    expect((cash.BROKERAGE?.[1] as Decimal).sub(month1.mul(0.035)).abs().lt(1e-6)).toBe(true);
  });

  it("эскроу: всё, что поступило, раскрыто после РНВ очереди, остаток в конце — 0", () => {
    const dep = r.formulas["F.ESC.DEPOSIT"]?.value as Decimal[][];
    const esc = r.formulas["F.ESC.BALANCE"]?.value as { balance: Decimal[][]; release: Decimal[][] };
    // продажи исходника не разделены по очередям — все в последней очереди (РНВ 01.07.2031, раскрытие — август 2031)
    expect(dep.map((d) => sum(d).isZero())).toEqual([true, true, false]);
    expect(sum(esc.release[2] as Decimal[]).sub(sum(dep[2] as Decimal[])).abs().lt(1e-6)).toBe(true);
    expect(esc.balance[2]?.at(-1)?.isZero()).toBe(true);
    const date = r.formulas["F.TIME.DATE"]?.value as string[];
    const first = (esc.release[2] as Decimal[]).findIndex((x) => !x.isZero());
    expect(date[first]).toBe("2031-08-31");
  });
});

describe("SALES: Дербеневская в обычном режиме", () => {
  const c = loadCase("derbenevskaya_legacy");
  const base = legacyInput(c);
  const r = calculate(
    {
      mode: "normal",
      values: {
        ...base.values,
        "SALES.PRICE_MARKET_GROWTH": { by_year: { 2026: 0.05 }, after_last: "last" },
        "SALES.PRICE_STAGE_UPLIFT": [{ stage: "РНВ", uplift: 0.05 }],
      },
    },
    { horizonMonths: LEGACY_HORIZON },
    ["F.SALES.SOLD_AREA", "F.SALES.REVENUE_TOTAL"],
  );

  it("ПСН продано не больше запаса 10 322 м² (исходник 10 888,6 м²)", () => {
    expect(sum(rows(r, "F.SALES.SOLD_AREA").ПСН as Decimal[]).toNumber()).toBeCloseTo(10322, 6);
    expect(r.messages).toContainEqual(expect.objectContaining({ severity: "warning", text: expect.stringContaining("«ПСН»: из ручного темпа не продано") }));
  });
});

/** Небольшой проект: одна очередь, продажи с февраля, РНВ в мае, горизонт 10 месяцев. */
const project = (extra: Record<string, unknown> = {}) => ({
  values: {
    "GEN.MODEL_START_DATE": "2025-12-31",
    "TIME.MILESTONES": [{ phase: 1, sales_start: "2026-02-10", construction_start: "2026-01-15", construction_end: "2026-06-30", rnv_date: "2026-05-20" }],
    "SALES.PRODUCTS": [
      { name: "Квартиры", product: "квартиры", phase: 1, stock_area: 1000, start_price: 100, price_date: "2025-12-31", sale_channel_before_rnv: "ДДУ_эскроу" },
      { name: "Кладовые", product: "кладовые", phase: 1, stock_units: 10, start_price: 50, sale_channel_before_rnv: "не_продаётся" },
    ],
    "SALES.PACE": [
      { name: "Квартиры", method: "в_месяц", value: 300 },
      { name: "Кладовые", method: "доля_остатка", value: 0.5 },
    ],
    "SALES.PRICE_MARKET_GROWTH": { by_year: { 2026: 0.12 }, after_last: "last" },
    "SALES.PRICE_STAGE_UPLIFT": [
      { stage: "старт продаж", uplift: 0.5 },
      { stage: "РНВ", uplift: 0.1 },
    ],
    "SALES.PAYMENT_MIX": [
      { product: "квартиры", mortgage_share: 0.5, full_payment_share: 0, installment_share: 0.5, installment_months: 4, installment_down_payment: 0.2 },
      { product: "кладовые", mortgage_share: 0, full_payment_share: 1, installment_share: 0 },
    ],
    ...extra,
  },
});

describe("SALES и ESCROW: правила обычного режима", () => {
  const r = calculate(project(), { horizonMonths: 10 }, ["F.SALES.REVENUE_TOTAL", "F.SALES.END_PRICE", "F.SALES.WAVG_PRICE", "F.ESC.COVERAGE"]);
  const sold = rows(r, "F.SALES.SOLD_AREA");
  const price = rows(r, "F.SALES.PRICE");

  it("продажи — с месяца старта продаж, не больше запаса", () => {
    // старт 10.02 → с конца февраля (t = 2); 300 м² в месяц, запас 1000 → 300, 300, 300, 100
    expect(nums(sold.Квартиры)).toEqual([0, 0, 300, 300, 300, 100, 0, 0, 0, 0]);
  });

  it("продукт, который до РНВ не продаётся, продаётся с РНВ по ДКП; доля остатка — от остатка прошлого месяца", () => {
    // РНВ 20.05 → с конца мая (t = 5): 5, 2,5, 1,25 …
    expect(nums(sold.Кладовые?.slice(4, 8))).toEqual([0, 5, 2.5, 1.25]);
  });

  it("цена: рыночный рост помесячно от даты цены; надбавка «РНВ» — с месяца РНВ; «старт продаж» не применяется", () => {
    const g = new Decimal(1.12).pow(new Decimal(1).div(12));
    expect(price.Квартиры?.[0]?.toNumber()).toBe(100);
    expect(price.Квартиры?.[4]?.sub(g.pow(4).mul(100)).abs().lt(1e-9)).toBe(true);
    expect(price.Квартиры?.[5]?.sub(g.pow(5).mul(100).mul(1.1)).abs().lt(1e-9)).toBe(true);
  });

  it("средневзвешенная цена и цена в конце продаж", () => {
    const value = rows(r, "F.SALES.CONTRACT_VALUE").Квартиры as Decimal[];
    const wavg = (r.formulas["F.SALES.WAVG_PRICE"]?.value as Record<string, Decimal>).Квартиры as Decimal;
    expect(wavg.sub(sum(value).div(1000)).abs().lt(1e-9)).toBe(true);
    expect((r.formulas["F.SALES.END_PRICE"]?.value as Record<string, Decimal>).Квартиры?.eq(price.Квартиры?.[5] as Decimal)).toBe(true);
  });

  it("рассрочка: первый взнос в месяц договора, остаток — равными долями 4 месяца; ДДУ — на эскроу", () => {
    const cash = r.formulas["F.SALES.CASH_IN"]?.value as { total: RowSeries; ddu: RowSeries };
    const v = (rows(r, "F.SALES.CONTRACT_VALUE").Квартиры as Decimal[])[2] as Decimal;
    // договор февраля (t = 2): 0,5 ипотека + 0,5 × 0,2 первый взнос = 0,6 сразу; 0,5 × 0,8 / 4 = 0,1 в марте…июне
    const feb = (t: number) => (cash.ddu.Квартиры?.[t] as Decimal).sub(t === 2 ? v.mul(0.6) : v.mul(0.1));
    expect(feb(2).abs().lt(1e-6)).toBe(true);
    // по кладовым (ДКП после РНВ) на эскроу ничего не идёт
    expect(sum(cash.ddu.Кладовые as Decimal[]).isZero()).toBe(true);
    expect(sum(cash.total.Кладовые as Decimal[]).gt(0)).toBe(true);
  });

  it("эскроу: весь остаток раскрывается в месяц после РНВ, поступления после — транзитом в том же месяце", () => {
    const dep = (r.formulas["F.ESC.DEPOSIT"]?.value as Decimal[][])[0] as Decimal[];
    const esc = r.formulas["F.ESC.BALANCE"]?.value as { balance: Decimal[][]; release: Decimal[][] };
    const rel = esc.release[0] as Decimal[];
    // РНВ в мае (t = 5) + лаг 1 месяц → раскрытие в июне (t = 6)
    expect(rel.slice(0, 6).every((x) => x.isZero())).toBe(true);
    expect(rel[6]?.sub(sum(dep.slice(0, 7))).abs().lt(1e-6)).toBe(true);
    expect(rel[7]?.eq(dep[7] as Decimal)).toBe(true);
    expect(esc.balance[0]?.slice(6).every((x) => x.isZero())).toBe(true);
    expect(esc.balance[0]?.[5]?.sub(sum(dep.slice(0, 6))).abs().lt(1e-6)).toBe(true);
  });

  it("покрытие долга эскроу — на этапе 5", () => {
    expect(r.messages).toContainEqual(expect.objectContaining({ formulaId: "F.ESC.COVERAGE", severity: "info" }));
  });

  it("сумма долей оплат не 1 — ошибка", () => {
    const bad = calculate(
      project({ "SALES.PAYMENT_MIX": [{ product: "квартиры", mortgage_share: 0.7, full_payment_share: 0.1, installment_share: 0 }] }),
      { horizonMonths: 10 },
      ["F.SALES.CASH_IN"],
    );
    expect(bad.messages).toContainEqual(expect.objectContaining({ severity: "error", parameterId: "SALES.PAYMENT_MIX", text: expect.stringContaining("должна быть 1") }));
  });

  it("надбавка по готовности СМР: «котлован» — с первого платежа по СМР", () => {
    const smr = calculate(
      project({
        "SALES.PRICE_MARKET_GROWTH": { by_year: { 2026: 0 } },
        "SALES.PRICE_STAGE_UPLIFT": [{ stage: "котлован", uplift: 0.1 }, { stage: "50%", uplift: 0.2 }],
        // все статьи групп СМР — нулевые, кроме СМР надземной части
        "CAPEX.ITEMS": spec.capexItems
          .filter((i) => ["СМР", "сети", "благоустройство", "соцобъекты"].includes(i.group))
          .map((i) =>
            i.item_id === "SMR_ABOVE"
              ? { item_id: i.item_id, base: "фикс", rate: 1000, price_date: "2025-12-31", schedule_rule: "uniform", schedule_from: "construction_start", schedule_to: "construction_end" }
              : { item_id: i.item_id, base: "фикс", rate: 0, price_date: "2025-12-31" },
          ),
      }),
      { horizonMonths: 10 },
      ["F.SALES.PRICE"],
    );
    expect(smr.messages.filter((m) => m.severity === "error")).toEqual([]);
    const progress = smr.formulas["F.CAPEX.SMR_PROGRESS"]?.value as Decimal[];
    // СМР равномерно январь…май (5 месяцев): готовность 0,2 / 0,4 / 0,6 / 0,8 / 1
    expect(nums(progress.slice(0, 7))).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1, 1]);
    expect(nums(rows(smr, "F.SALES.PRICE").Квартиры?.slice(0, 5))).toEqual([100, 110, 110, 132, 132]);
  });
});
