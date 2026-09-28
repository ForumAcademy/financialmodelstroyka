import { describe, expect, it } from "vitest";
import { computeProject } from "../lib/model";
import { firstMissing, inputSteps, inputsMissing, placeOfParam } from "../lib/project-nav";
import { loadSeed } from "../lib/seed";
import { INPUT_TABS, tabGroups } from "../lib/tab-inputs";
import type { DemoProject } from "../lib/types";

const [demo] = loadSeed().projects;
if (!demo) throw new Error("нет демо-проекта");
const variants = (p: DemoProject): DemoProject[] =>
  (["legacy", "normal"] as const).flatMap((mode) =>
    ["концепция", "оценка участка"].map((stage) => ({ ...p, input: { ...p.input, mode, values: { ...p.input.values, "GEN.PROJECT_STAGE": stage } } })),
  );

describe("Меню проекта: шаги вводных", () => {
  it("семь шагов по порядку", () => {
    expect(inputSteps(demo).map((s) => s.title)).toEqual(["Проект и участок", "ТЭП", "График", "Продажи", "Затраты", "Финансирование", "Налоги и оценка"]);
  });

  it("ни одно поле вкладок листов не потерялось и не задвоилось в шагах", () => {
    for (const p of variants(demo)) {
      const before = new Set(INPUT_TABS.flatMap((t) => tabGroups(t, p).flatMap((g) => g.params)));
      const after = inputSteps(p).flatMap((s) => s.tabs.flatMap((g) => g.params));
      expect(new Set(after)).toEqual(before);
      expect(after.length).toBe(new Set(after).size);
    }
  });

  it("у каждого шага есть вкладки, у каждой вкладки есть поля", () => {
    for (const p of variants(demo)) for (const s of inputSteps(p)) {
      expect(s.tabs.length).toBeGreaterThan(0);
      for (const g of s.tabs) expect(g.params.length).toBeGreaterThan(0);
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
});
