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

  it("аренда и смена ВРИ без правил в спецификации — ошибка, а не выдуманный расчёт", () => {
    const rent = calculate({ values: { ...base, "LAND.TENURE": "аренда" } }, { horizonMonths: 12 }, ["F.LAND.TAX_OR_RENT"]);
    expect(rent.messages).toContainEqual(expect.objectContaining({ severity: "error", text: expect.stringContaining("вопрос владельцу продукта") }));
    const vri = calculate({ values: { ...base, "LAND.CADASTRAL_VALUE_AFTER_VRI": 7e9 } }, { horizonMonths: 12 }, ["F.LAND.TAX_OR_RENT"]);
    expect(vri.messages).toContainEqual(expect.objectContaining({ severity: "error", parameterId: "LAND.CADASTRAL_VALUE_AFTER_VRI" }));
  });

  it("плата за ВРИ: формула региона не выписана — обязательный ручной ввод", () => {
    const missing = calculate({ values: base }, {}, ["F.LAND.VRI_FEE"]);
    expect(missing.messages).toContainEqual(expect.objectContaining({ severity: "error", parameterId: "LAND.VRI_FEE" }));
    const given = calculate({ values: { ...base, "LAND.VRI_FEE": 1000 } }, {}, ["F.LAND.VRI_FEE"]);
    expect((given.formulas["F.LAND.VRI_FEE"]?.value as Decimal).toNumber()).toBe(1000);
  });
});
