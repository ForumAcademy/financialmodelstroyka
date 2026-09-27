import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { calculate } from "../src";

const base = {
  "GEN.MODEL_START_DATE": "2025-12-31",
  "GEN.REGION_CODE": "77",
  "LAND.CADASTRAL_VALUE": 5834907660,
  "TAX.LAND_RATE": 0.015,
  "TIME.MILESTONES": [{ phase: 1, land_acquired: "2025-12-31", handover_end: "2030-06-30" }],
};

describe("LAND", () => {
  it("пример F.LAND.TAX_OR_RENT: 5 834 907 660 × 1,5% × 2 / 12 = 14 587 269,15 руб/мес", () => {
    const r = calculate({ values: base }, { horizonMonths: 60 }, ["F.LAND.TAX_OR_RENT"]);
    const pay = r.formulas["F.LAND.TAX_OR_RENT"]?.value as Decimal[];
    expect(pay[1]?.toDecimalPlaces(2).toNumber()).toBe(14587269.15);
  });

  it("коэффициент 2 первые 3 года, затем 4, после передачи последней очереди — налога нет", () => {
    const r = calculate({ values: base }, { horizonMonths: 60 }, ["F.LAND.TAX_OR_RENT"]);
    const coef = (r.formulas["F.LAND.TAX_COEF"]?.value as Decimal[]).map((c) => c.toNumber());
    expect(coef[36]).toBe(2); // 31.12.2028 — ровно 3 года
    expect(coef[37]).toBe(4);
    const pay = r.formulas["F.LAND.TAX_OR_RENT"]?.value as Decimal[];
    expect(pay[54]?.gt(0)).toBe(true); // 30.06.2030
    expect(pay[55]?.isZero()).toBe(true);
  });

  it("аренда: поквартально авансом, индексация раз в год, до передачи первого помещения", () => {
    const rent = {
      ...base,
      "LAND.TENURE": "аренда",
      "LAND.RENT_ANNUAL": 1200,
      "LAND.RENT_INDEXATION": 0.1,
      "TIME.MILESTONES": [{ phase: 1, land_acquired: "2025-12-31", handover_start: "2027-05-31", handover_end: "2030-06-30" }],
    };
    const r = calculate({ values: rent }, { horizonMonths: 24 }, ["F.LAND.TAX_OR_RENT"]);
    const pay = (r.formulas["F.LAND.TAX_OR_RENT"]?.value as Decimal[]).map((x) => x.toDecimalPlaces(6).toNumber());
    expect(pay[0]).toBe(0); // декабрь 2025 — не первый месяц квартала: по expr платёж авансом только в первом месяце квартала
    expect(pay.slice(1, 10)).toEqual([300, 0, 0, 300, 0, 0, 300, 0, 0]);
    expect(pay[10]).toBe(310); // октябрь 2026: декабрь — уже второй год аренды, +10%
    expect(pay[13]).toBe(330);
    expect(pay[16]).toBe(110); // апрель 2027: аренда до 31.05.2027 — только апрель
    expect(pay[19]).toBe(0);
    const monthly = calculate({ values: { ...rent, "LAND.RENT_PAYMENT_FREQ": "ежемесячно" } }, { horizonMonths: 24 }, ["F.LAND.TAX_OR_RENT"]);
    expect((monthly.formulas["F.LAND.TAX_OR_RENT"]?.value as Decimal[])[1]?.toNumber()).toBe(100);
  });

  it("смена ВРИ: до вехи — прежняя стоимость без коэффициента, с вехи — новая с коэффициентом", () => {
    const vri = {
      ...base,
      "LAND.CADASTRAL_VALUE_AFTER_VRI": 12e9,
      "TIME.MILESTONES": [{ phase: 1, land_acquired: "2025-12-31", vri_change_date: "2026-06-30", handover_end: "2030-06-30" }],
    };
    const r = calculate({ values: vri }, { horizonMonths: 12 }, ["F.LAND.TAX_OR_RENT"]);
    const pay = r.formulas["F.LAND.TAX_OR_RENT"]?.value as Decimal[];
    expect(pay[5]?.toNumber()).toBeCloseTo(5834907660 * 0.015 / 12, 6); // май 2026
    expect(pay[6]?.toNumber()).toBeCloseTo(12e9 * 0.015 * 2 / 12, 6); // июнь 2026
    const noDate = calculate({ values: { ...base, "LAND.CADASTRAL_VALUE_AFTER_VRI": 12e9 } }, { horizonMonths: 12 }, ["F.LAND.TAX_OR_RENT"]);
    expect(noDate.messages).toContainEqual(expect.objectContaining({ severity: "error", text: expect.stringContaining("смена ВРИ") }));
  });

  it("плата за ВРИ: формула региона не выписана — обязательный ручной ввод", () => {
    const missing = calculate({ values: base }, {}, ["F.LAND.VRI_FEE"]);
    expect(missing.messages).toContainEqual(expect.objectContaining({ severity: "error", parameterId: "LAND.VRI_FEE" }));
    const given = calculate({ values: { ...base, "LAND.VRI_FEE": 1000 } }, {}, ["F.LAND.VRI_FEE"]);
    expect((given.formulas["F.LAND.VRI_FEE"]?.value as Decimal).toNumber()).toBe(1000);
  });
});
