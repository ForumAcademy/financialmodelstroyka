/**
 * Расчёт проекта в интерфейсе: вызов ядра и вспомогательные преобразования для таблиц.
 * Формул модели здесь нет — только то, что вернуло ядро (@fm/engine).
 */
import { calculate, dataQuestions, ENGINE_MODULES, FORMULAS, legacyCaseInput, sinkFormulas, type DataQuestion, type LegacyCase, type ProjectInput, type ResultSet } from "@fm/engine";
import { getFormula, getParameter, PARAMETER_IDS, type FormulaId, type ParameterId } from "@fm/spec";
import { assumptionParams, SPEC_ASSUMPTIONS, standardValues, versionOf, type AssumptionVersion } from "./assumptions";
import type { DemoProject } from "./types";

const excelCache = new WeakMap<LegacyCase, Partial<Record<ParameterId, unknown>>>();

/** Значения исходного Excel для параметров справочника допущений (расчёт «как в исходном Excel» берёт их, а не стандарт). */
function excelAssumptionValues(c: LegacyCase, versions: AssumptionVersion[]): Partial<Record<ParameterId, unknown>> {
  if (!excelCache.has(c)) {
    const params = assumptionParams(versions);
    const all = legacyCaseInput(c).values;
    excelCache.set(c, Object.fromEntries(Object.entries(all).filter(([k]) => params.has(k as ParameterId))));
  }
  return excelCache.get(c) ?? {};
}

/**
 * Входные данные ядра: значения проекта + стандарт компании по версии проекта. В расчёте «как в исходном Excel»
 * параметры справочника берутся из исходного Excel (один в один), если в проекте их не меняли.
 */
export function effectiveInput(project: DemoProject, versions: AssumptionVersion[] = SPEC_ASSUMPTIONS): ProjectInput {
  const standard = standardValues(versionOf(versions, project.assumptionsVersion));
  const legacy = project.input.mode === "legacy" && project.legacyCase;
  const values = legacy
    ? { ...excelAssumptionValues(project.legacyCase as LegacyCase, versions), ...project.input.values }
    : project.legacyCase
      ? serviceCapex(project.input.values, project.legacyCase)
      : project.input.values;
  return { ...project.input, values, standard };
}

/**
 * Статьи, которые в расчёте сервиса у проекта из Excel считаются по справочнику, а не суммой исходника: резерв —
 * ставка справочника (2% по методике Минстроя 421/пр) × стоимость СМР, график — по СМР (решение владельца продукта
 * 27.09.2026). Если сумму статьи изменили в проекте, остаётся она.
 */
const SERVICE_BY_RATE = ["CONTINGENCY"];

function serviceCapex(values: ProjectInput["values"], c: LegacyCase): ProjectInput["values"] {
  const rows = values["CAPEX.ITEMS"];
  if (!Array.isArray(rows)) return values;
  const excel = new Map((c.capex_legacy ?? []).map((x) => [x.item_id, x.amount_F]));
  const next = rows.map((r) => {
    const row = r as { item_id?: string; base?: string; rate?: number };
    const byExcel = row.item_id && SERVICE_BY_RATE.includes(row.item_id) && row.base === "фикс" && row.rate === excel.get(row.item_id);
    return byExcel ? { item_id: row.item_id } : r;
  });
  return { ...values, "CAPEX.ITEMS": next };
}

/** Действующее значение параметра в проекте: своё → стандарт компании → значение по умолчанию. */
export function effectiveValue(project: DemoProject, id: ParameterId, versions: AssumptionVersion[] = SPEC_ASSUMPTIONS): unknown {
  const input = effectiveInput(project, versions);
  return input.values[id] ?? input.standard?.[id] ?? getParameter(id).default ?? null;
}

/** Горизонт модели: до последней вехи + лаг раскрытия эскроу. Предварительно — правило ещё не утверждено в спецификации. */
export function provisionalHorizon(project: DemoProject, versions: AssumptionVersion[] = SPEC_ASSUMPTIONS): number | null {
  const start = project.input.values["GEN.MODEL_START_DATE"];
  const rows = project.input.values["TIME.MILESTONES"];
  if (typeof start !== "string" || !Array.isArray(rows)) return null;
  const dates = rows.flatMap((r) =>
    Object.entries(r as Record<string, unknown>)
      .filter(([k, v]) => k !== "phase" && typeof v === "string" && v)
      .map(([, v]) => v as string),
  );
  if (dates.length === 0) return null;
  const last = dates.reduce((a, b) => (b > a ? b : a));
  const monthsTo = (d: string) => (Number(d.slice(0, 4)) - Number(start.slice(0, 4))) * 12 + (Number(d.slice(5, 7)) - Number(start.slice(5, 7)));
  const lag = Number(effectiveValue(project, "TIME.ESCROW_RELEASE_LAG_M", versions) ?? 0);
  return Math.max(monthsTo(last) + 1 + lag, manualScheduleEnd(project, monthsTo) + 1, salesPaceEnd(project, monthsTo) + 1, 1);
}

/** Последний месяц ручного темпа продаж (SALES.PACE → manual): продажи не должны выходить за горизонт. */
function salesPaceEnd(project: DemoProject, monthsTo: (d: string) => number): number {
  const rows = project.input.values["SALES.PACE"];
  if (!Array.isArray(rows)) return 0;
  return rows.reduce((max: number, r) => {
    const m = (r as { manual?: { from?: string; step_months?: number; values?: number[] } }).manual;
    if (!m?.from || !m.step_months || !m.values) return max;
    const lastPeriod = m.values.reduce((acc: number, v, p) => (v ? p : acc), -1);
    return lastPeriod < 0 ? max : Math.max(max, monthsTo(m.from) + lastPeriod * m.step_months);
  }, 0);
}

/** Последний месяц ручных графиков статей бюджета (CAPEX.ITEMS → schedule_manual): горизонт не должен их обрезать. */
function manualScheduleEnd(project: DemoProject, monthsTo: (d: string) => number): number {
  const rows = project.input.values["CAPEX.ITEMS"];
  if (!Array.isArray(rows)) return 0;
  return rows.reduce((max: number, r) => {
    const m = (r as { schedule_manual?: { from?: string; step_months?: number; weights?: number[] } }).schedule_manual;
    if (!m?.from || !m.step_months || !m.weights) return max;
    const lastPeriod = m.weights.reduce((acc: number, w, p) => (w ? p : acc), -1);
    return lastPeriod < 0 ? max : Math.max(max, monthsTo(m.from) + lastPeriod * m.step_months);
  }, 0);
}

/**
 * Что считать: итоговые формулы (корни графа) + показатели ТЭП и участка, которые показываются на любой стадии,
 * даже если бюджет их не читает (в расчёте «как в исходном Excel» суммы статей берутся из исходника, а не ставка × площадь).
 */
const TARGETS: FormulaId[] = [
  ...sinkFormulas(Object.keys(FORMULAS) as FormulaId[]),
  "F.SALES.REVENUE_TOTAL",
  "F.SALES.WAVG_PRICE",
  "F.CAPEX.TOTAL",
  "F.TEP.PARKING_COUNT",
  "F.TEP.GFA_SPLIT",
  "F.TEP.GFA_TOTAL",
  "F.TEP.SALEABLE_AREA",
  "F.TEP.LANDSCAPE_AREA",
  "F.LAND.TAX_OR_RENT",
  "F.LAND.VRI_FEE",
];

export interface ProjectModel {
  result: ResultSet;
  horizon: number | null;
  /** Параметры, которые нужно заполнить (ошибка «заполните …» в расчёте). */
  missing: Set<ParameterId>;
  /** Стандартные значения компании по версии справочника проекта. */
  standard: Partial<Record<ParameterId, unknown>>;
  /** Версии справочника допущений, с которыми посчитан проект. */
  versions: AssumptionVersion[];
  /** Входные данные, с которыми посчитан проект (своё + стандарт; для проекта из Excel — с поправками режима). */
  input: ProjectInput;
}

export function computeProject(project: DemoProject, versions: AssumptionVersion[] = SPEC_ASSUMPTIONS): ProjectModel {
  const horizon = provisionalHorizon(project, versions);
  const input = effectiveInput(project, versions);
  const calc = calculate(input, horizon === null ? {} : { horizonMonths: horizon }, TARGETS);
  const result = project.input.mode === "legacy" && project.legacyWarnings ? { ...calc, messages: [...calc.messages, ...project.legacyWarnings] } : calc;
  const missing = new Set(result.messages.filter((m) => m.severity === "error" && m.parameterId).map((m) => m.parameterId as ParameterId));
  return { result, horizon, missing, standard: input.standard ?? {}, versions, input };
}

const otherModeCache = new WeakMap<DemoProject, { versions: AssumptionVersion[]; model: ProjectModel | null }>();

/**
 * Пара расчётов «расчёт «как в исходном Excel» / расчёт сервиса» для проекта из исходного Excel: текущий расчёт и
 * расчёт того же проекта в другом режиме. null — проект не из Excel или другой режим не считается.
 */
export function modePair(project: DemoProject, current: ProjectModel): { legacy: ProjectModel; normal: ProjectModel; normalProject: DemoProject } | null {
  if (!project.legacyCase) return null;
  if (otherModeCache.get(project)?.versions !== current.versions) {
    let other: ProjectModel | null;
    try {
      other = computeProject({ ...project, input: { ...project.input, mode: project.input.mode === "legacy" ? "normal" : "legacy" } }, current.versions);
    } catch {
      other = null;
    }
    otherModeCache.set(project, { versions: current.versions, model: other });
  }
  const other = otherModeCache.get(project)?.model;
  if (!other) return null;
  return project.input.mode === "legacy"
    ? { legacy: current, normal: other, normalProject: { ...project, input: { ...project.input, mode: "normal" } } }
    : { legacy: other, normal: current, normalProject: project };
}

/** Предупреждения расчёта «как в исходном Excel»: расхождения исходного Excel, которые расчёт «как в исходном Excel» повторяет как есть. */
export function compatWarnings(project: DemoProject, m: ProjectModel) {
  return project.input.mode === "legacy" ? m.result.messages.filter((x) => x.severity === "warning" && x.key) : [];
}

/**
 * Вопросы к данным: расхождения исходного Excel (только у проектов из Excel, в любом режиме) + неподтверждённые
 * стандартные значения компании (у всех проектов; влияние — по расчёту сервиса).
 */
/** Вопросы расчёта «как в исходном Excel» к исходному файлу; у проекта без исходного Excel их нет. */
export function projectQuestions(project: DemoProject, m: ProjectModel): DataQuestion[] {
  return excelQuestions(project, m);
}

function excelQuestions(project: DemoProject, m: ProjectModel): DataQuestion[] {
  if (!project.legacyCase) return [];
  if (project.input.mode === "legacy") return dataQuestions(project.legacyCase, effectiveInput(project, m.versions), m.result);
  const pair = modePair(project, m);
  return pair ? dataQuestions(project.legacyCase, effectiveInput({ ...project, input: { ...project.input, mode: "legacy" } }, m.versions), pair.legacy.result) : [];
}

/** Этап плана, на котором появится формула (по её модулю). */
export function stageOf(id: FormulaId): number | null {
  const module = getFormula(id).module === "ESCROW" ? "ESC" : getFormula(id).module;
  return ENGINE_MODULES.find((m) => m.id === module)?.stage ?? null;
}

export function isParameterIdLike(id: string): id is ParameterId {
  return (PARAMETER_IDS as readonly string[]).includes(id);
}

export type Period = "quarter" | "year" | "month";
export const PERIOD_LABEL: Record<Period, string> = { quarter: "Квартал", year: "Год", month: "Месяц" };

/** Ключ периода для даты конца месяца. */
export function periodKey(date: string, period: Period): string {
  if (period === "month") return `${date.slice(5, 7)}.${date.slice(0, 4)}`;
  if (period === "year") return date.slice(0, 4);
  return `${Math.floor((Number(date.slice(5, 7)) - 1) / 3) + 1} кв ${date.slice(0, 4)}`;
}

/**
 * Помесячный ряд по периодам: потоки суммируются (mode = "sum"); остатки и цены берутся на конец периода
 * (mode = "last").
 */
export function aggregate(values: number[], dates: string[], period: Period, mode: "sum" | "last" = "sum"): { keys: string[]; sums: number[] } {
  const keys: string[] = [];
  const sums: number[] = [];
  dates.forEach((d, t) => {
    const k = periodKey(d, period);
    if (keys.at(-1) !== k) {
      keys.push(k);
      sums.push(0);
    }
    sums[sums.length - 1] = mode === "last" ? (values[t] ?? 0) : (sums.at(-1) ?? 0) + (values[t] ?? 0);
  });
  return { keys, sums };
}
