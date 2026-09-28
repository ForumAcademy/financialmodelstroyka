import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ParameterId } from "@fm/spec";
import { readByMap, readModelFile, workbookReader } from "../lib/excel-import";
import { buildProject, checkFile, EMPTY_FORM, formValues, validateForm } from "../lib/new-project";
import { computeProject } from "../lib/model";
import { whence } from "../lib/whence";
import { loadSeed } from "../lib/seed";

const file = readFileSync(new URL("../../../legacy/Кальк Саевой привязка КОД.xlsx", import.meta.url));
const buf = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);

describe("загрузка финмодели в Excel", () => {
  it("исходный Excel: подставлены значения карты, как в тестовом кейсе", async () => {
    const r = readByMap(await workbookReader(buf), new Set());
    const got = Object.fromEntries(r.applied.map((a) => [a.param, a.value]));
    const seed = loadSeed().projects[0]!.legacyCase!.project_inputs;
    expect(got["LAND.AREA"]).toBe(seed["LAND.AREA"]);
    expect(got["LAND.CADASTRAL_VALUE"]).toBe(seed["LAND.CADASTRAL_VALUE"]);
    expect(got["TEP.GFA_ABOVE"]).toBe(seed["TEP.GFA_ABOVE"]);
    expect(got["OPEX.MARKETING_RATE"]).toBe(seed["OPEX.MARKETING_RATE"]);
    expect(got["GEN.MODEL_START_DATE"]).toBe("2025-12-31");
    expect(got["TEP.APT_MIX"]).toEqual((seed["TEP.APT_MIX"] as { type_name: string; count: number; avg_area: number }[]).map(({ type_name, count, avg_area }) => ({ type_name, count, avg_area })));
    expect(r.applied.find((a) => a.param === "LAND.AREA")).toMatchObject({ sheet: "ТЭПы", cell: "C15" });
    // ставки по закону не подставляются
    expect(got["TAX.VAT_RATE"]).toBeUndefined();
    expect(r.skipped.find((s) => s.cells === "D54")?.reason).toMatch(/по закону/);
    // темп продаж не подставлен, но показан
    expect(r.skipped.some((s) => s.sheet === "План продаж")).toBe(true);
    // в списке — названия, а не коды параметров
    expect(r.skipped.filter((s) => /^[A-Z_]+\./.test(s.label))).toEqual([]);
  });

  it("значения формы важнее файла", async () => {
    const r = readByMap(await workbookReader(buf), new Set(["LAND.AREA", "GEN.MODEL_START_DATE"]));
    expect(r.applied.some((a) => a.param === "LAND.AREA")).toBe(false);
    expect(r.skipped.find((s) => s.cells === "C15")?.reason).toBe("указано в форме");
  });

  it("не Excel — null", async () => {
    expect(await readModelFile(new TextEncoder().encode("не таблица").buffer, new Set())).toBeNull();
  });
});

describe("форма «Новый проект»", () => {
  const form = { ...EMPTY_FORM, name: "ЖК Тест", region: "77", start: "2026-01-01" };

  it("обязательные поля и порядок дат", () => {
    expect(Object.keys(validateForm(EMPTY_FORM)).sort()).toEqual(["name", "region", "start"]);
    expect(validateForm(form)).toEqual({});
    const e = validateForm({ ...form, salesStart: "2025-12-01", commissioning: "2025-06-30", areaHa: "abc" });
    expect(e).toEqual({ salesStart: "Не раньше даты начала", commissioning: "Не раньше даты начала", areaHa: "Введите число, например 9,66" });
  });

  it("файл: формат и размер", () => {
    expect(checkFile({ name: "модель.XLSM", size: 1000 })).toBeNull();
    expect(checkFile({ name: "модель.pdf", size: 1000 })).toMatch(/Excel/);
    expect(checkFile({ name: "модель.xlsx", size: 21 * 1024 * 1024 })).toMatch(/20 МБ/);
  });

  it("проект без файла: значения формы, гектары → м², вехи первой очереди", () => {
    const p = buildProject("p1", { ...form, areaHa: "9,6572", site: "77:05:0001005:1", housingClass: "бизнес", salesStart: "2026-06-01" }, 1);
    expect(p.input.values).toEqual({
      "GEN.PROJECT_NAME": "ЖК Тест",
      "GEN.REGION_CODE": "77",
      "GEN.MODEL_START_DATE": "2026-01-01",
      "GEN.HOUSING_CLASS": "бизнес",
      "GEN.CADASTRAL_NUMBER": "77:05:0001005:1",
      "LAND.AREA": 96572,
      "TIME.MILESTONES": [{ phase: 1, sales_start: "2026-06-01" }],
    });
    expect(p.sources).toEqual([]);
    expect(p.fileImport).toBeUndefined();
    expect(buildProject("p2", { ...form, site: "Дербеневская наб., 1" }, 1).address).toBe("Дербеневская наб., 1");
  });

  it("проект с файлом: значения подставлены, «Откуда» — файл, лист и ячейка", async () => {
    const result = readByMap(await workbookReader(buf), new Set(Object.keys(formValues(form)) as ParameterId[]));
    const file = { name: "модель.xlsx", size: 1, type: "", url: "blob:x" };
    const p = buildProject("p3", form, 1, { sourceId: "doc-1", author: "Иванов", file, result });
    expect(p.input.values["LAND.AREA"]).toBe(96572);
    expect(p.input.values["GEN.MODEL_START_DATE"]).toBe("2026-01-01");
    expect(p.fileImport).toMatchObject({ ok: true, fileName: "модель.xlsx" });
    expect(p.paramSources["LAND.AREA"]).toBe("doc-1");
    expect(whence("LAND.AREA", p).text).toBe("Загружено из файла модель.xlsx, лист ТЭПы, ячейка C15");
    expect(whence("TEP.APT_MIX", p).text).toBe("Загружено из файла модель.xlsx, лист ТЭПы, ячейки B41:F43");
    // подставленные площадь участка и доля благоустройства считаются
    expect(computeProject(p).result.formulas["F.TEP.LANDSCAPE_AREA"]).toBeDefined();
  });

  it("файл не прочитан: проект создан, файл прикреплён, параметры из справочника", () => {
    const file = { name: "модель.xls", size: 1, type: "", url: "blob:x" };
    const p = buildProject("p4", form, 1, { sourceId: "doc-2", author: "Иванов", file, result: null });
    expect(p.fileImport).toMatchObject({ ok: false, applied: [] });
    expect(p.sources[0]?.file?.name).toBe("модель.xls");
    expect(p.input.values["LAND.AREA"]).toBeUndefined();
  });
});
