/**
 * Расчёт проекта в интерфейсе: вызов ядра, статусы параметров, счётчики карточки.
 * Здесь нет формул модели — только классификация того, что вернуло ядро (@fm/engine).
 */
import { calculate, ENGINE_MODULES, FORMULAS, sinkFormulas, type ResultSet } from "@fm/engine";
import {
  getFormula,
  getParameter,
  getSource,
  PARAMETER_IDS,
  spec,
  type FormulaId,
  type ParameterId,
  type SpecParameter,
} from "@fm/spec";
import type { DemoProject, ProjectSource } from "./types";

export type ParamStatus = "empty" | "no_source" | "ok" | "check";

export const STATUS_LABEL: Record<ParamStatus, string> = {
  empty: "Не заполнено",
  no_source: "Без источника",
  ok: "С источником",
  check: "Требует сверки",
};
export const STATUS_ORDER: ParamStatus[] = ["empty", "no_source", "ok", "check"];

export const SECTIONS = ["Общее", "Участок", "ТЭП", "Бюджет", "Продажи", "Финансирование"] as const;
export type Section = (typeof SECTIONS)[number];

const PREFIX_SECTION: Record<string, Section> = {
  GEN: "Общее",
  TIME: "Общее",
  LAND: "Участок",
  GPZU: "Участок",
  TEP: "ТЭП",
  CAPEX: "Бюджет",
  OPEX: "Бюджет",
  SALES: "Продажи",
  FIN: "Финансирование",
  VAL: "Финансирование",
  TAX: "Финансирование",
};
const BENCH_SECTION: Partial<Record<ParameterId, Section>> = {
  "BENCH.COST_SAMPLE": "Бюджет",
  "BENCH.PARKING_AREA_SAMPLE": "Бюджет",
};

export function sectionOf(id: ParameterId): Section {
  const prefix = id.split(".")[0] ?? "";
  if (prefix === "BENCH") return BENCH_SECTION[id] ?? "Продажи";
  return PREFIX_SECTION[prefix] ?? "Общее";
}

/** Параметры, которые вводятся по проекту (template-параметры живут в Справочнике). */
export const PROJECT_PARAMETERS: SpecParameter[] = spec.parameters.filter((p) => p.scope !== "template");

/** Параметры, у которых есть данные по очередям (столбец phase). */
export const PHASED_PARAMETERS = new Set<ParameterId>(
  spec.parameters.filter((p) => p.columns?.some((c) => c.key === "phase")).map((p) => p.id),
);

/** Горизонт модели: до последней вехи + лаг раскрытия эскроу. Предварительно — правило ещё не утверждено в спецификации. */
export function provisionalHorizon(project: DemoProject): number | null {
  const start = project.input.values["GEN.MODEL_START_DATE"];
  const rows = project.input.values["TIME.MILESTONES"];
  if (typeof start !== "string" || !Array.isArray(rows)) return null;
  const dates = rows.flatMap((r) => Object.entries(r as Record<string, unknown>).filter(([k, v]) => k !== "phase" && typeof v === "string").map(([, v]) => v as string));
  if (dates.length === 0) return null;
  const last = dates.reduce((a, b) => (b > a ? b : a));
  const months = (Number(last.slice(0, 4)) - Number(start.slice(0, 4))) * 12 + (Number(last.slice(5, 7)) - Number(start.slice(5, 7)));
  const lag = Number(getParameter("TIME.ESCROW_RELEASE_LAG_M").default ?? 0);
  return Math.max(months + 1 + lag, 1);
}

export interface ParamRow {
  param: SpecParameter;
  section: Section;
  value: unknown;
  origin: "project" | "region" | "template" | null;
  source: ProjectSource | null;
  status: ParamStatus;
  used: boolean;
}

export interface ProjectModel {
  result: ResultSet;
  horizon: number | null;
  rows: ParamRow[];
  used: ParamRow[];
  counters: Record<ParamStatus, number>;
  readiness: number;
  errors: ResultSet["messages"];
  outdatedSpec: boolean;
}

function specSourcesNeedCheck(p: SpecParameter): boolean {
  return p.status === "needs_verification" || p.source_ids.some((id) => getSource(id).verified === false);
}

function statusOf(p: SpecParameter, value: unknown, origin: ParamRow["origin"], source: ProjectSource | null): ParamStatus {
  if (value === null || value === undefined || origin === null) return "empty";
  if (origin === "project") {
    if (!source) return "no_source";
    return p.status === "needs_verification" ? "check" : "ok";
  }
  return specSourcesNeedCheck(p) ? "check" : "ok";
}

/**
 * Что считать: итоговые формулы (корни графа) + машино-места, которые показываются на любой стадии
 * (в ядре на стадии «Концепция» они нужны только будущим модулям продаж и CAPEX).
 */
const TARGETS: FormulaId[] = [...sinkFormulas(Object.keys(FORMULAS) as FormulaId[]), "F.TEP.PARKING_COUNT"];

export function computeProject(project: DemoProject): ProjectModel {
  const horizon = provisionalHorizon(project);
  const result = calculate(project.input, horizon === null ? {} : { horizonMonths: horizon }, TARGETS);

  // Параметры, которые ядро читало (включая незаполненные) — они участвуют в счётчиках.
  const read = new Set<ParameterId>();
  for (const node of Object.values(result.formulas)) for (const i of node!.inputs) if (!i.startsWith("F.")) read.add(i as ParameterId);
  for (const m of result.messages) if (m.parameterId) read.add(m.parameterId);

  const rows: ParamRow[] = PROJECT_PARAMETERS.map((param) => {
    const traced = result.parameters[param.id];
    const own = project.input.values[param.id];
    const value = traced ? traced.value : own ?? param.default ?? null;
    const origin = traced ? traced.origin : own !== undefined && own !== null ? "project" : param.default !== null && param.default !== undefined ? "template" : null;
    const source = project.sources[param.id] ?? null;
    return { param, section: sectionOf(param.id), value, origin, source, status: statusOf(param, value, origin, source), used: read.has(param.id) };
  });
  const used = rows.filter((r) => r.used);
  const counters = { empty: 0, no_source: 0, ok: 0, check: 0 } as Record<ParamStatus, number>;
  for (const r of used) counters[r.status] += 1;
  return {
    result,
    horizon,
    rows,
    used,
    counters,
    readiness: used.length ? counters.ok / used.length : 0,
    errors: result.messages.filter((m) => m.severity === "error"),
    outdatedSpec: project.specVersion !== spec.specVersion,
  };
}

/** Этап плана, на котором появится формула (по её модулю). */
export function stageOf(id: FormulaId): number | null {
  const module = getFormula(id).module === "ESCROW" ? "ESC" : getFormula(id).module;
  return ENGINE_MODULES.find((m) => m.id === module)?.stage ?? null;
}

export const KPI_TILES: { id: FormulaId; label: string; unit: "млрд руб." | "%" }[] = [
  { id: "F.SALES.REVENUE_TOTAL", label: "Выручка", unit: "млрд руб." },
  { id: "F.CAPEX.TOTAL", label: "Затраты", unit: "млрд руб." },
  { id: "F.KPI.NPV", label: "NPV", unit: "млрд руб." },
  { id: "F.KPI.IRR", label: "IRR акционера", unit: "%" },
  { id: "F.KPI.MARGIN", label: "Маржа", unit: "%" },
  { id: "F.KPI.PEAK_EQUITY", label: "Пиковый капитал", unit: "млрд руб." },
];

export function isParameterIdLike(id: string): id is ParameterId {
  return (PARAMETER_IDS as readonly string[]).includes(id);
}
