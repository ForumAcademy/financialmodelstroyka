import { describe, expect, it } from "vitest";
import { spec } from "@fm/spec";
import { reducer } from "../lib/store";
import { loadSeed } from "../lib/seed";
import { referenceWhence, whence } from "../lib/whence";

const project = () => loadSeed().projects[0]!;

describe("изменение значения в проекте", () => {
  it("значение справочника меняется только в проекте, с «почему»; «вернуть исходное» снимает изменение", () => {
    const p = project();
    const before = spec.parameters.find((x) => x.id === "CAPEX.NCS_BENCH_TOLERANCE")!.default;
    const [changed] = reducer([p], { type: "change", id: p.id, param: "CAPEX.NCS_BENCH_TOLERANCE", before, value: 0.3, why: "класс «бизнес»", author: "Аналитик" });
    expect(changed!.input.values["CAPEX.NCS_BENCH_TOLERANCE"]).toBe(0.3);
    expect(changed!.changes?.["CAPEX.NCS_BENCH_TOLERANCE"]).toMatchObject({ before: 0.25, after: 0.3, why: "класс «бизнес»", author: "Аналитик", hadOwn: false });
    expect(whence("CAPEX.NCS_BENCH_TOLERANCE", changed)).toMatchObject({ text: "класс «бизнес»", kind: "changed" });
    // Справочник не меняется
    expect(spec.parameters.find((x) => x.id === "CAPEX.NCS_BENCH_TOLERANCE")!.default).toBe(0.25);

    const [reverted] = reducer([changed!], { type: "revert", id: p.id, param: "CAPEX.NCS_BENCH_TOLERANCE" });
    expect(reverted!.input.values["CAPEX.NCS_BENCH_TOLERANCE"]).toBeUndefined();
    expect(reverted!.changes?.["CAPEX.NCS_BENCH_TOLERANCE"]).toBeUndefined();
  });

  it("повторное изменение хранит исходное «было»; возврат своего значения проекта", () => {
    const p = project();
    const id = "LAND.AREA";
    const own = p.input.values[id];
    expect(own).not.toBeUndefined();
    const [a] = reducer([p], { type: "change", id: p.id, param: id, before: own, value: 1, why: "первое", author: "А" });
    const [b] = reducer([a!], { type: "change", id: p.id, param: id, before: 1, value: 2, why: "второе", author: "Б" });
    expect(b!.changes?.[id]).toMatchObject({ before: own, after: 2, why: "второе", hadOwn: true });
    const [c] = reducer([b!], { type: "revert", id: p.id, param: id });
    expect(c!.input.values[id]).toEqual(own);
  });
});

describe("«Откуда»", () => {
  it("значения без документа получили текст обоснования; ссылка — только если есть документ", () => {
    // 30 значений справочника (этап 3) + этап 4: рост цены, даты эскроу и конец поступлений исходного Excel
    // для расчёта «как в исходном Excel», лаг раскрытия эскроу (решение владельца продукта); этап 5: лимит и ключевая
    // ставка исходного Excel
    const withFrom = spec.parameters.filter((x) => x.from);
    expect(withFrom).toHaveLength(37);
    expect(referenceWhence("BENCH.PAIR_RADIUS_KM")).toMatchObject({ url: null });
    expect(referenceWhence("CAPEX.COST_INDEX").url).toMatch(/^https:/);
  });

  it("у значения из закона — название и ссылка на документ", () => {
    const w = referenceWhence("TAX.VAT_RATE");
    expect(w.url).toMatch(/^https?:/);
    expect(w.text.length).toBeGreaterThan(0);
  });
});
