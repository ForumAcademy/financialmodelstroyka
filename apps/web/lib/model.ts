/**
 * Расчёт проекта в интерфейсе: вызов ядра и вспомогательные преобразования для таблиц.
 * Формул модели здесь нет — только то, что вернуло ядро (@fm/engine).
 */
import { calculate, ENGINE_MODULES, FORMULAS, sinkFormulas, type ResultSet } from "@fm/engine";
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
  const months = (Number(last.slice(0, 4)) - Number(start.slice(0, 4))) * 12 + (Number(last.slice(5, 7)) - Number(start.slice(5, 7)));
  const lag = Number(getParameter("TIME.ESCROW_RELEASE_LAG_M").default ?? 0);
  return Math.max(months + 1 + lag, 1);
}

/**
 * Что считать: итоговые формулы (корни графа) + машино-места и разбивка ГНС, которые показываются на любой стадии
 * (в ядре на стадии «Концепция» они нужны только будущим модулям продаж и CAPEX).
 */
const TARGETS: FormulaId[] = [...sinkFormulas(Object.keys(FORMULAS) as FormulaId[]), "F.TEP.PARKING_COUNT", "F.TEP.GFA_SPLIT"];

export interface ProjectModel {
  result: ResultSet;
  horizon: number | null;
  /** Параметры, которые нужно заполнить (ошибка «заполните …» в расчёте). */
  missing: Set<ParameterId>;
}

export function computeProject(project: DemoProject): ProjectModel {
  const horizon = provisionalHorizon(project);
  const result = calculate(project.input, horizon === null ? {} : { horizonMonths: horizon }, TARGETS);
  const missing = new Set(result.messages.filter((m) => m.severity === "error" && m.parameterId).map((m) => m.parameterId as ParameterId));
  return { result, horizon, missing };
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

/** Суммирование помесячного ряда по периодам (потоки и число месяцев). */
export function aggregate(values: number[], dates: string[], period: Period): { keys: string[]; sums: number[] } {
  const keys: string[] = [];
  const sums: number[] = [];
  dates.forEach((d, t) => {
    const k = periodKey(d, period);
    if (keys.at(-1) !== k) {
      keys.push(k);
      sums.push(0);
    }
    sums[sums.length - 1] = (sums.at(-1) ?? 0) + (values[t] ?? 0);
  });
  return { keys, sums };
}
