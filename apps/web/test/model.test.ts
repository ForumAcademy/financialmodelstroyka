import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { attentionItems } from "../lib/attention";
import { computeProject, provisionalHorizon, STATUS_ORDER } from "../lib/model";
import { loadSeed } from "../lib/seed";
import type { DemoProject } from "../lib/types";

const demo = loadSeed().projects[0] as DemoProject;

describe("модель проекта в интерфейсе", () => {
  const m = computeProject(demo);

  it("счётчики карточки делят параметры расчёта без остатка", () => {
    const total = STATUS_ORDER.reduce((s, k) => s + m.counters[k], 0);
    expect(total).toBe(m.used.length);
    expect(m.readiness).toBeCloseTo(m.counters.ok / m.used.length);
  });

  it("значения исходника без проектного источника — «без источника», с источником — «с источником»", () => {
    expect(m.used.find((r) => r.param.id === "LAND.AREA")?.status).toBe("no_source");
    const withSource = computeProject({ ...demo, sources: { "LAND.AREA": { level: 4, title: "Выписка ЕГРН", author: "Аналитик", date: "2026-09-25" } } });
    expect(withSource.used.find((r) => r.param.id === "LAND.AREA")?.status).toBe("ok");
  });

  it("ТЭП и машино-места показываются на стадии «Концепция»", () => {
    expect((m.result.formulas["F.TEP.SALEABLE_AREA"]?.value as Decimal).toNumber()).toBe(153882.388);
    expect((m.result.formulas["F.TEP.PARKING_COUNT"]?.value as Decimal).toNumber()).toBe(862);
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

  it("лента «Требует внимания» ведёт к параметрам без источника и к ошибкам расчёта", () => {
    const items = attentionItems([demo], computeProject);
    expect(items.find((i) => i.kind === "no_source")?.href).toBe("/projects/derbenevskaya?tab=inputs&status=no_source");
    expect(items.some((i) => i.kind === "calc_error")).toBe(true);
    expect(attentionItems([{ ...demo, archived: true }], computeProject)).toEqual([]);
  });
});
