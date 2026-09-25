/**
 * @fm/engine — расчётное ядро: одна формула из data/formulas.yaml = одна функция с тем же ID.
 * Каждая формула пишет след (что прочитала и что получила) — из него строится паспорт показателя.
 */
import { type FormulaId } from "@fm/spec";
import { Engine, sinkFormulas } from "./context";
import { FORMULAS } from "./registry";
import type { CalcOptions, ProjectInput, ResultSet } from "./types";

export { Engine, CalcError, MissingInputError, sinkFormulas, type FormulaContext, type FormulaFn } from "./context";
export { FORMULAS, IMPLEMENTED_MODULES } from "./registry";
export { legacyCaseInput, type LegacyCase } from "./legacy";
export type * from "./types";

/** Модули ядра в порядке расчёта (docs/01_architecture.md). */
export const ENGINE_MODULES = [
  { id: "TIME", title: "Временная шкала и флаги", stage: 2 },
  { id: "TEP", title: "ТЭП", stage: 2 },
  { id: "LAND", title: "Участок", stage: 2 },
  { id: "CAPEX", title: "Бюджет", stage: 3 },
  { id: "SALES", title: "План продаж", stage: 4 },
  { id: "ESC", title: "Эскроу", stage: 4 },
  { id: "FIN", title: "Проектное финансирование", stage: 5 },
  { id: "TAX", title: "Налоги", stage: 6 },
  { id: "CF", title: "Денежный поток", stage: 6 },
  { id: "KPI", title: "Показатели", stage: 6 },
  { id: "CHECK", title: "Проверки", stage: 6 },
] as const;

export type EngineModuleId = (typeof ENGINE_MODULES)[number]["id"];

/**
 * Посчитать проект. По умолчанию — все реализованные формулы, которые нужны для итоговых
 * (формулы, нужные только на другой стадии проекта, не считаются и не требуют ввода).
 */
export function calculate(input: ProjectInput, options: CalcOptions = {}, targets?: readonly FormulaId[]): ResultSet {
  const engine = new Engine(input, FORMULAS, options);
  return engine.run(targets ?? sinkFormulas(Object.keys(FORMULAS) as FormulaId[]));
}
