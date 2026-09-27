import { describe, expect, it } from "vitest";
import { getFormula, spec, type FormulaId } from "@fm/spec";
import { compatDiff, exampleFocus, howExample, inputFields, shortSource, templateExample } from "../lib/how-example";
import { computeProject, modePair } from "../lib/model";
import { loadSeed } from "../lib/seed";

/** Пояснение — не больше трёх предложений. */
const MAX_SENTENCES = 3;

describe("Панель «Как посчитано»: пример на цифрах проекта", () => {
  const [demo] = loadSeed().projects;
  if (!demo) throw new Error("нет демо-проекта");
  const m = computeProject(demo);
  const computed = Object.keys(m.result.formulas) as FormulaId[];

  it("у каждой формулы есть название и короткое пояснение простым языком", () => {
    for (const f of spec.formulas) {
      expect(f.plain?.title, f.id).toBeTruthy();
      const how = f.plain?.how ?? "";
      expect(how, f.id).not.toMatch(/[A-Za-z]/);
      expect(how, f.id).not.toMatch(/\n/);
      expect(how.split(/[.!?](\s|$)/).filter((s) => s.trim()).length, f.id).toBeLessThanOrEqual(MAX_SENTENCES);
    }
  });

  it("у каждого посчитанного показателя пример одной строкой, все подстановки заполнены", () => {
    for (const id of computed) {
      const ex = howExample(id, demo, m);
      if (getFormula(id).plain?.example) expect(templateExample(id, demo, m), id).not.toBeNull();
      if (ex !== null) expect(ex, id).not.toMatch(/\n/);
    }
  });

  it("«Продано в месяце»: пример из расчёта сервиса — ПСН распродан к марту 2033", () => {
    const pair = modePair(demo, m)!;
    expect(howExample("F.SALES.SOLD_AREA", pair.normalProject, pair.normal)).toBe("ПСН 10\u00a0322 м². Продажи начинаются в апреле 2029 года, вся площадь продана к марту 2033 года.");
    expect(pair.normal.result.messages.map((x) => x.text)).toContain("По плану продаж ПСН получается 10\u00a0888 м², а построено 10\u00a0322 м². Лишние 566 м² в расчёт не попали. Уменьшите темп или проверьте площадь ПСН в ТЭПах.");
  });

  it("«Продаваемая площадь»: нулевые слагаемые не пишутся, площади без дробей", () => {
    expect(howExample("F.TEP.SALEABLE_AREA", demo, m)).toMatch(/^Квартиры 143\s560 м² \+ ПСН 10\s322 м² = 153\s882 м²\.$/);
  });

  it("«В исходном Excel»: одна строка с цифрами, только если отличается от расчёта сервиса", () => {
    const pair = modePair(demo, m)!;
    expect(compatDiff("F.SALES.SOLD_AREA", pair.legacy, pair.normal, exampleFocus(pair.normalProject, pair.normal))).toMatch(/^В исходном Excel ПСН продано 10\s888 м² — больше, чем построено\.$/);
    expect(compatDiff("F.TEP.SALEABLE_AREA", pair.legacy, pair.normal)).toBeNull();
  });

  it("«Что влияет» — не больше пяти полей, которые вводит пользователь", () => {
    const fields = inputFields("F.TEP.SALEABLE_AREA", m);
    expect(fields.length).toBeLessThanOrEqual(5);
    expect(fields).toContain("TEP.COMM_AREA");
    expect(inputFields("F.SALES.SOLD_AREA", m)).not.toContain("GEN.MODEL_START_DATE");
  });

  it("короткое название источника", () => {
    expect(shortSource("Приказ Росреестра от 23.10.2020 № П/0393 (ред. от 01.01.2024) — требования к площади")).toBe("Приказ Росреестра П/0393");
  });
});
