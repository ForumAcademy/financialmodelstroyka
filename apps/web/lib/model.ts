/**
 * Расчёт проекта в интерфейсе: вызов ядра и вспомогательные преобразования для таблиц.
 * Формул модели здесь нет — только то, что вернуло ядро (@fm/engine).
 */
import { calculate, dataQuestions, ENGINE_MODULES, FORMULAS, sinkFormulas, type DataQuestion, type ResultSet } from "@fm/engine";
import { getFormula, getParameter, PARAMETER_IDS, type FormulaId, type ParameterId } from "@fm/spec";
import type { DemoProject } from "./types";

/** Горизонт модели: до последней вехи + лаг раскрытия эскроу. Предварительно — правило ещё не утверждено в спецификации. */
export function provisionalHorizon(project: DemoProject): number | null {
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
  const lag = Number(getParameter("TIME.ESCROW_RELEASE_LAG_M").default ?? 0);
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
 * даже если бюджет их не читает (в режиме совместимости суммы статей берутся из исходника, а не ставка × площадь).
 */
const TARGETS: FormulaId[] = [
  ...sinkFormulas(Object.keys(FORMULAS) as FormulaId[]),
  "F.SALES.REVENUE_TOTAL",
  "F.SALES.WAVG_PRICE",
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
}

export function computeProject(project: DemoProject): ProjectModel {
  const horizon = provisionalHorizon(project);
  const calc = calculate(project.input, horizon === null ? {} : { horizonMonths: horizon }, TARGETS);
  const result = project.input.mode === "legacy" && project.legacyWarnings ? { ...calc, messages: [...calc.messages, ...project.legacyWarnings] } : calc;
  const missing = new Set(result.messages.filter((m) => m.severity === "error" && m.parameterId).map((m) => m.parameterId as ParameterId));
  return { result, horizon, missing };
}

/** Предупреждения режима совместимости: расхождения исходного Excel, которые совместимость повторяет как есть. */
export function compatWarnings(project: DemoProject, m: ProjectModel) {
  return project.input.mode === "legacy" ? m.result.messages.filter((x) => x.severity === "warning" && x.key) : [];
}

/** Вопросы к данным по предупреждениям совместимости: только у проектов из исходного Excel в режиме совместимости. */
export function projectQuestions(project: DemoProject, m: ProjectModel): DataQuestion[] {
  return project.input.mode === "legacy" && project.legacyCase ? dataQuestions(project.legacyCase, project.input, m.result) : [];
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
