/**
 * Форма «Новый проект»: проверка полей и сборка проекта. Значения, которых нет в форме, проект берёт из справочника
 * (регион → региональные параметры, справочник допущений компании → стандартные значения). Если загружена финмодель
 * в Excel, найденные в ней значения подставляются поверх, с листом и ячейкой.
 */
import { spec, type ParameterId } from "@fm/spec";
import type { FileImport, ImportedValue, SkippedValue } from "./excel-import";
import type { DemoProject, ProjectFile, ProjectSource } from "./types";

export interface NewProjectForm {
  name: string;
  region: string;
  /** Адрес или кадастровый номер участка. */
  site: string;
  /** Площадь участка, га (как ввёл пользователь). */
  areaHa: string;
  housingClass: string;
  start: string;
  salesStart: string;
  commissioning: string;
}

export const EMPTY_FORM: NewProjectForm = { name: "", region: "", site: "", areaHa: "", housingClass: "", start: "", salesStart: "", commissioning: "" };

export type FormErrors = Partial<Record<keyof NewProjectForm | "file", string | undefined>>;

/** Загрузка финмодели: форматы и предельный размер файла (задача владельца продукта 28.09.2026). */
export const FILE_EXTENSIONS = [".xlsx", ".xlsm", ".xls"];
const MB = 1024 * 1024;
export const FILE_MAX_MB = 20;

/** 1 га = 10 000 м² (площадь участка в проекте хранится в м², LAND.AREA). */
const M2_PER_HA = 10_000;

/** Кадастровый номер: «77:05:0001005:1» — четыре группы цифр через двоеточие. */
const CADASTRAL = /^\d{2}:\d{2}:\d{6,7}:\d+$/;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** «12,5» / «12.5» / «1 250» → число; пусто или не число → null. */
export function parseArea(text: string): number | null {
  const t = text.replace(/\s/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function validateForm(f: NewProjectForm): FormErrors {
  const e: FormErrors = {};
  if (!f.name.trim()) e.name = "Укажите название";
  if (!f.region) e.region = "Выберите регион из списка";
  const DATE_FORMAT = "Дата в формате ДД.ММ.ГГГГ";
  if (!f.start) e.start = "Укажите дату начала";
  else if (!ISO.test(f.start)) e.start = DATE_FORMAT;
  if (f.salesStart && !ISO.test(f.salesStart)) e.salesStart = DATE_FORMAT;
  if (f.commissioning && !ISO.test(f.commissioning)) e.commissioning = DATE_FORMAT;
  const order = (d: string) => ISO.test(f.start) && ISO.test(d) && d < f.start;
  if (f.areaHa.trim()) {
    const a = parseArea(f.areaHa);
    if (a === null) e.areaHa = "Введите число, например 9,66";
    else if (a <= 0) e.areaHa = "Площадь должна быть больше нуля";
  }
  if (order(f.salesStart)) e.salesStart = "Не раньше даты начала";
  if (order(f.commissioning)) e.commissioning = "Не раньше даты начала";
  return e;
}

export function checkFile(file: { name: string; size: number }): string | null {
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!FILE_EXTENSIONS.includes(ext)) return "Нужен файл Excel: .xlsx, .xlsm или .xls";
  if (file.size > FILE_MAX_MB * MB) return `Файл больше ${FILE_MAX_MB} МБ`;
  return null;
}

/** Параметры проекта из формы. */
export function formValues(f: NewProjectForm): Partial<Record<ParameterId, unknown>> {
  const v: Partial<Record<ParameterId, unknown>> = { "GEN.PROJECT_NAME": f.name.trim(), "GEN.REGION_CODE": f.region, "GEN.MODEL_START_DATE": f.start };
  if (f.housingClass) v["GEN.HOUSING_CLASS"] = f.housingClass;
  const site = f.site.trim();
  if (CADASTRAL.test(site)) v["GEN.CADASTRAL_NUMBER"] = site;
  const area = parseArea(f.areaHa);
  if (area !== null) v["LAND.AREA"] = area * M2_PER_HA;
  if (f.salesStart || f.commissioning) {
    const row: Record<string, unknown> = { phase: 1 };
    if (f.salesStart) row.sales_start = f.salesStart;
    if (f.commissioning) row.rnv_date = f.commissioning;
    v["TIME.MILESTONES"] = [row];
  }
  return v;
}

export interface UploadedFile {
  /** Документ проекта для файла (id, автор, дата). */
  sourceId: string;
  author: string;
  file: ProjectFile;
  /** Результат чтения: null — не прочитан или не похож на финмодель. */
  result: { applied: ImportedValue[]; skipped: SkippedValue[] } | null;
}

export function buildProject(id: string, form: NewProjectForm, assumptionsVersion: number, upload?: UploadedFile, now: Date = new Date()): DemoProject {
  const values = formValues(form);
  const project: DemoProject = {
    id,
    name: form.name.trim(),
    archived: false,
    sources: [],
    paramSources: {},
    specVersion: spec.specVersion,
    assumptionsVersion,
    updatedAt: now.toISOString(),
    input: { values },
  };
  const site = form.site.trim();
  if (site && !CADASTRAL.test(site)) project.address = site;
  if (!upload) return project;

  const source: ProjectSource = {
    id: upload.sourceId,
    level: 4,
    title: `Финмодель в Excel: ${upload.file.name}`,
    url: "",
    author: upload.author,
    date: now.toISOString().slice(0, 10),
    file: upload.file,
  };
  project.sources = [source];
  const applied = upload.result?.applied ?? [];
  const fromFile: DemoProject["fromFile"] = {};
  for (const a of applied) {
    values[a.param] = a.value;
    fromFile[a.param] = { sheet: a.sheet, cell: a.cell };
    project.paramSources[a.param] = source.id;
  }
  if (applied.length) project.fromFile = fromFile;
  const report: FileImport = { sourceId: source.id, fileName: upload.file.name, ok: upload.result !== null, applied, skipped: upload.result?.skipped ?? [] };
  project.fileImport = report;
  return project;
}
