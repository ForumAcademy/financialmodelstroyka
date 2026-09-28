import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getParameter, isParameterId, spec } from "@fm/spec";
import { computeProject } from "../lib/model";
import { firstMissing, inputSteps, inputsMissing, placeOfParam, tabChecks } from "../lib/project-nav";
import { fieldLabel, fromField, itemLabel, toField, unitOf } from "../lib/field-view";
import { loadSeed } from "../lib/seed";
import { INPUT_TABS, tabGroups } from "../lib/tab-inputs";
import type { DemoProject } from "../lib/types";

const [demo] = loadSeed().projects;
if (!demo) throw new Error("нет демо-проекта");
const variants = (p: DemoProject): DemoProject[] =>
  (["legacy", "normal"] as const).flatMap((mode) =>
    ["концепция", "оценка участка"].map((stage) => ({ ...p, input: { ...p.input, mode, values: { ...p.input.values, "GEN.PROJECT_STAGE": stage } } })),
  );
const stepParams = (p: DemoProject) => new Set(inputSteps(p).flatMap((s) => s.tabs.flatMap((g) => g.params)));
const stepItems = (p: DemoProject) => new Set(inputSteps(p).flatMap((s) => s.tabs.flatMap((g) => g.items ?? [])));

/** Карта значений исходного Excel: лист, ячейка, куда перенесено, решение. */
function legacyMap(): { cell: string; target: string; verdict: string }[] {
  const [, ...lines] = readFileSync(new URL("../../../legacy/legacy_values_map.csv", import.meta.url), "utf8").trim().split("\n");
  return lines.map((l) => {
    const [sheet = "", cell = "", , , target = "", verdict = ""] = l.split(",");
    return { cell: `${sheet}!${cell}`, target, verdict };
  });
}

describe("Меню проекта: шаги вводных", () => {
  it("семь шагов по порядку, вкладки как в задании", () => {
    const steps = inputSteps(demo);
    expect(steps.map((s) => s.title)).toEqual(["Проект и участок", "ТЭП", "График", "Продажи", "Затраты", "Финансирование", "Налоги и оценка"]);
    expect(steps.map((s) => s.tabs.map((g) => g.title))).toEqual([
      ["Проект", "Участок"],
      ["Площади", "Пределы ГПЗУ", "Квартирография", "Машино-места", "Благоустройство"],
      ["Подготовка", "Стройка и продажи"],
      ["Продукты и цены", "Темп продаж", "Рост цены", "Оплата"],
      ["Участок и права", "ПИР и ИРД", "Строительство", "Продажи", "Управление и резерв"],
      ["Кредит", "Ставки", "Эскроу"],
      ["Налоги", "Оценка"],
    ]);
  });

  it("ни одно поле вкладок листов не потерялось", () => {
    for (const p of variants(demo)) {
      const before = INPUT_TABS.flatMap((t) => tabGroups(t, p).flatMap((g) => g.params)).filter((id) => id !== "CAPEX.ITEMS");
      const after = stepParams(p);
      for (const id of before) expect(after.has(id), id).toBe(true);
    }
  });

  it("поле стоит на одной вкладке; график по очередям делится на две вкладки по столбцам", () => {
    for (const p of variants(demo)) {
      const tabs = inputSteps(p).flatMap((s) => s.tabs);
      const all = tabs.flatMap((g) => g.params).filter((id) => id !== "TIME.MILESTONES");
      expect(all.length).toBe(new Set(all).size);
      const cols = tabs.filter((g) => g.params.includes("TIME.MILESTONES")).flatMap((g) => g.columns ?? []);
      const keys = (getParameter("TIME.MILESTONES").columns ?? []).map((c) => c.key);
      expect(new Set(cols)).toEqual(new Set(keys));
    }
  });

  it("все значения исходного Excel из карты есть в шагах: параметры — полями, статьи бюджета — полями статей", () => {
    const params = stepParams(demo);
    const items = stepItems(demo) as Set<string>;
    const budgetParams = new Set<string>(spec.capexItems.filter((c) => c.rate_param && c.base === "фикс").map((c) => c.item_id));
    const lost: string[] = [];
    for (const r of legacyMap().filter((x) => x.verdict !== "remove" && x.target !== "—")) {
      const item = /^CAPEX\.ITEMS\[([A-Z_]+)\]/.exec(r.target)?.[1];
      if (item) {
        if (!items.has(item) && !budgetParams.has(item)) lost.push(`${r.cell} → ${r.target}`);
        continue;
      }
      if (r.target === "CAPEX.ITEMS") continue;
      if (!isParameterId(r.target)) continue;
      if (!params.has(r.target)) lost.push(`${r.cell} → ${r.target}`);
    }
    expect(lost).toEqual([]);
  });

  it("все статьи бюджета стоят на вкладках «Затрат»: суммой статьи или полем её параметра", () => {
    const costs = inputSteps(demo).find((s) => s.id === "costs")!;
    const items = new Set(costs.tabs.flatMap((g) => g.items ?? []));
    const params = new Set(costs.tabs.flatMap((g) => g.params));
    for (const c of spec.capexItems) expect(items.has(c.item_id) || (c.rate_param !== undefined && params.has(c.rate_param)), c.item_id).toBe(true);
  });

  it("поля расчёта «Как в исходном Excel» есть только у проекта из Excel", () => {
    const own: DemoProject = { ...demo };
    delete own.legacyCase;
    expect(stepParams(demo).has("FIN.LEGACY_KEY_RATE")).toBe(true);
    expect(stepParams(own).has("FIN.LEGACY_KEY_RATE")).toBe(false);
  });

  it("у каждого шага есть вкладки, у каждой вкладки есть поля", () => {
    for (const p of variants(demo))
      for (const s of inputSteps(p)) {
        expect(s.tabs.length).toBeGreaterThan(0);
        for (const g of s.tabs) expect(g.params.length + (g.items?.length ?? 0)).toBeGreaterThan(0);
      }
  });

  it("статус «Не хватает N значений» ведёт к первому незаполненному полю", () => {
    const m = computeProject(demo);
    const n = inputsMissing(demo, m);
    const first = firstMissing(demo, m);
    if (n === 0) expect(first).toBeNull();
    else {
      expect(first).not.toBeNull();
      expect(placeOfParam(demo, first!.id)).toEqual({ step: first!.step, tab: first!.tab });
    }
  });

  it("проверки в шаге: без «заполните …» и без расхождений с исходным Excel", () => {
    for (const p of variants(demo)) {
      const m = computeProject(p);
      for (const s of inputSteps(p))
        for (const g of s.tabs)
          for (const c of tabChecks(p, m, g)) {
            expect(c.text.startsWith("Заполните")).toBe(false);
            expect(c.key?.startsWith("LEGACY.") ?? false).toBe(false);
          }
    }
  });
});

describe("Подписи полей", () => {
  it("без технических слов и кодов (правила текста, раздел 5 задания)", () => {
    const bad = /due diligence|term sheet|спред|ядро|этап \d|CF1|ДДУ_|\bфи\b|концепц|[A-Z]+\.[A-Z_]+/i;
    for (const p of variants(demo))
      for (const s of inputSteps(p))
        for (const g of s.tabs) {
          for (const id of g.params) expect(fieldLabel(id), id).not.toMatch(bad);
          for (const item of g.items ?? []) expect(itemLabel(spec.capexItems.find((c) => c.item_id === item)!), item).not.toMatch(bad);
        }
  });
});

describe("Единицы полей", () => {
  it("доли — в процентах, надбавки — в п.п., площади — целые м²", () => {
    expect(toField(0.0575, unitOf("%годовых", "FIN.RATE_BASE_SPREAD"))).toBe("5,75");
    expect(unitOf("%годовых", "FIN.RATE_BASE_SPREAD").label).toBe("п.п.");
    expect(toField(-0.02, unitOf("%годовых", "FIN.RATE_DISCOUNT_COEF"))).toBe("−2");
    expect(toField(0.05, unitOf("%годовых", "FIN.RATE_PREFERENTIAL"))).toBe("5");
    expect(unitOf("%годовых", "FIN.RATE_PREFERENTIAL").label).toBe("% годовых");
    expect(toField(0.02, unitOf("доля", "LAND.AGENT_FEE_RATE"))).toBe("2");
    expect(toField(35294.59, unitOf("м2"))).toBe("35 295");
    expect(toField(5834907660, unitOf("руб"))).toBe("5 834 907 660");
    expect(toField(825124525.273, unitOf("руб"))).toBe("825 124 525");
  });

  it("введённое на экране читается обратно в доли без потери точности", () => {
    expect(fromField("5,75", unitOf("%годовых", "FIN.RATE_BASE_SPREAD"))).toBe(0.0575);
    expect(fromField("14,25", unitOf("%годовых"))).toBe(0.1425);
    expect(fromField("−2", unitOf("%годовых", "FIN.RATE_DISCOUNT_COEF"))).toBe(-0.02);
    expect(fromField("0,1", unitOf("%годовых"))).toBe(0.001);
    expect(fromField("1 330 355 898", unitOf("руб"))).toBe(1330355898);
    expect(fromField("abc", unitOf("руб"))).toBeNull();
  });
});
