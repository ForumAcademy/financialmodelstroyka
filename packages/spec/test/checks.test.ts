import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { checkSpec, LAG_DEPENDENCIES, spec, type SpecData } from "../src/index";

const clone = (): SpecData => structuredClone(spec) as unknown as SpecData;

describe("справочник проходит все проверки", () => {
  const result = checkSpec(spec as unknown as SpecData);

  it("ошибок нет", () => {
    expect(result.errors).toEqual([]);
  });

  it("все source_ids параметров, формул, статей и регионов существуют", () => {
    const ids = new Set(spec.sources.map((s) => s.id));
    const refs = [
      ...spec.parameters.flatMap((p) => p.source_ids),
      ...spec.formulas.flatMap((f) => f.source_ids),
      ...spec.capexItems.flatMap((c) => c.source_ids),
      ...spec.regions.flatMap((r) => [
        ...r.ncs_k_per_source_ids,
        ...r.land_tax_source_ids,
        ...r.land_rent_source_ids,
        ...r.vri_fee.source_ids,
        ...r.parking_norm.source_ids,
        ...r.ngp_source_ids,
      ]),
    ];
    expect(refs.filter((id) => !ids.has(id))).toEqual([]);
  });

  it("у источников уровня 1–3 есть URL", () => {
    const withoutUrl = spec.sources.filter((s) => s.level <= 3 && !s.url).map((s) => s.id);
    expect(withoutUrl).toEqual([]);
  });

  it("у каждого параметра и формулы есть хотя бы один источник", () => {
    expect(spec.parameters.filter((p) => p.source_ids.length === 0)).toEqual([]);
    expect(spec.formulas.filter((f) => f.source_ids.length === 0)).toEqual([]);
  });
});

describe("проверки ловят ошибки", () => {
  it("несуществующий источник у параметра", () => {
    const s = clone();
    s.parameters[0]!.source_ids = ["S_НЕТ_ТАКОГО"];
    expect(checkSpec(s).errors).toContainEqual(expect.stringContaining("источник S_НЕТ_ТАКОГО отсутствует"));
  });

  it("источник уровня 2 без URL", () => {
    const s = clone();
    const src = s.sources.find((x) => x.level === 2)!;
    src.url = null;
    expect(checkSpec(s).errors).toContainEqual(`источник ${src.id} уровня 2 без URL`);
  });

  it("зависимость формулы на несуществующий ID", () => {
    const s = clone();
    s.formulas[0]!.depends_on.push("GEN.НЕТ_ТАКОГО");
    expect(checkSpec(s).errors).toContainEqual(expect.stringContaining("зависимость GEN.НЕТ_ТАКОГО не найдена"));
  });

  it("цикл без лага в графе формул", () => {
    const s = clone();
    const date = s.formulas.find((f) => f.id === "F.TIME.DATE")!;
    date.depends_on.push("F.TIME.DAYS");
    expect(checkSpec(s).errors).toContainEqual(expect.stringContaining("цикл без лага"));
  });

  it("дубль ID параметра", () => {
    const s = clone();
    s.parameters.push(structuredClone(s.parameters[0]!));
    expect(checkSpec(s).errors).toContainEqual(`параметр: дубль ID ${s.parameters[0]!.id}`);
  });
});

describe("лаговые зависимости совпадают с scripts/validate_spec.py", () => {
  it("LAG_DEPENDENCIES = LAG_OK", () => {
    const py = readFileSync(resolve(import.meta.dirname, "../../../scripts/validate_spec.py"), "utf8");
    const block = /LAG_OK = \{([\s\S]*?)\}/.exec(py)?.[1] ?? "";
    const pairs = [...block.matchAll(/\("([^"]+)", "([^"]+)"\)/g)].map((m) => `${m[1]}|${m[2]}`).sort();
    expect(pairs.length).toBeGreaterThan(0);
    expect(LAG_DEPENDENCIES.map(([f, d]) => `${f}|${d}`).sort()).toEqual(pairs);
  });
});
