import { describe, expect, it } from "vitest";
import { spec } from "@fm/spec";
import { baseName, humanize, isYearSeries } from "../lib/humanize";
import { compositeSummary } from "../components/DataView";

describe("карточки справочника без служебных ключей", () => {
  it("ID параметров, формул, источников и статей заменяются названиями", () => {
    const out = humanize("ставка TAX.VAT_RATE, формула F.CAPEX.INDEX, источник S_EXPERT, статья SMR_ABOVE, index_type = investment");
    expect(out).not.toMatch(/TAX\.VAT_RATE|F\.CAPEX|S_EXPERT|SMR_ABOVE|index_type/);
    expect(out).toContain("«Экспертная оценка»");
  });

  it("в текстах параметров не остаётся ID справочника", () => {
    const ids = new Set<string>([...spec.parameters.map((p) => p.id), ...spec.sources.map((s) => s.id), ...spec.capexItems.map((c) => c.item_id)]);
    for (const p of spec.parameters) {
      const words = humanize(`${p.basis} ${p.how_to_fill ?? ""}`).split(/[^A-Za-z0-9_.]+/);
      expect(words.filter((w) => ids.has(w)), p.id).toEqual([]);
    }
  });

  it("прогноз по годам описан словами, а не «2 значения»", () => {
    const v = spec.parameters.find((p) => p.id === "CAPEX.COST_INDEX")!.default;
    expect(isYearSeries(v)).toBe(true);
    expect(compositeSummary(v)).toBe("Прогноз по годам: 2026–2029");
  });

  it("база статьи — название показателя", () => {
    expect(baseName("F.CAPEX.SMR_TOTAL")).not.toContain("F.CAPEX");
    expect(baseName("фикс")).toBe("фиксированная сумма");
  });
});

describe("вознаграждение девелопера", () => {
  it("база указана явно — выручка, без «(указать)»", () => {
    const p = spec.parameters.find((x) => x.id === "OPEX.DEV_FEE_RATE")!;
    expect(p.basis).toContain("от выручки");
    expect(p.basis).not.toContain("указать");
  });
});
