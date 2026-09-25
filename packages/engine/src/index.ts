/**
 * @fm/engine — расчётное ядро: одна формула из data/formulas.yaml = одна функция с тем же ID.
 *
 * Этап 0: только каркас, ничего не считается. Модули реализуются на этапах 2–6
 * (docs/06_build_plan.md) в src/modules/<module>/.
 */

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
