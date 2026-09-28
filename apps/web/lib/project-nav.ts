/**
 * Меню проекта (docs/ЗАДАНИЕ_пересборка_интерфейса, раздел 3.2): семь шагов «Вводных показателей» с вкладками,
 * четыре листа «Расчёта», «Дашборд», «Документы проекта», «Расхождения с Excel».
 * Шаги собираются из тех же групп полей, что были на вкладках листов (lib/tab-inputs.ts): ни одно поле не теряется,
 * это проверяет test/project-nav.test.ts.
 */
import type { ParameterId } from "@fm/spec";
import type { ProjectModel } from "./model";
import { budgetGroups, cfGroups, escrowGroups, missingCount, salesGroups, tepGroups, type InputGroup, type InputTab } from "./tab-inputs";
import type { DemoProject } from "./types";

export type StepId = "site" | "tep" | "sched" | "sales-in" | "costs" | "fin" | "tax";
export type SheetId = "sales" | "budget" | "escrow" | "cf";
export type SectionId = StepId | SheetId | "dashboard" | "docs" | "issues";

export interface InputStep {
  id: StepId;
  n: number;
  title: string;
  /** Подпись под значком в свёрнутом меню. */
  short: string;
  hint: string;
  /** Вкладки шага: одна группа полей — одна вкладка. */
  tabs: InputGroup[];
}

const byTitle = (groups: InputGroup[], title: string): InputGroup | undefined => groups.find((g) => g.title === title);
const only = (g: InputGroup | undefined, title: string, params?: ParameterId[]): InputGroup[] =>
  g ? [{ ...g, title, params: params ?? g.params }] : [];

export function inputSteps(project: DemoProject): InputStep[] {
  const tep = tepGroups(project);
  const [project_, land, areas, ...rest] = tep;
  const gpzu = byTitle(rest, "Пределы ГПЗУ");
  const mix = byTitle(rest, "Квартирография");
  const parking = byTitle(rest, "Машино-места");
  const landscape = byTitle(rest, "Благоустройство");
  const milestones = byTitle(rest, "Вехи проекта по очередям");
  const cadastral: ParameterId = "GEN.CADASTRAL_NUMBER";
  const sales = salesGroups(project);
  const [payment, escrow] = escrowGroups(project);
  const [credit, taxes, valuation] = cfGroups(project);
  return [
    {
      id: "site",
      n: 1,
      title: "Проект и участок",
      short: "Проект",
      hint: "Общие данные и участок по выписке ЕГРН.",
      tabs: [
        ...only(project_, "Проект", project_?.params.filter((id) => id !== cadastral)),
        ...only(land, "Участок", land ? [cadastral, ...land.params] : undefined),
      ],
    },
    {
      id: "tep",
      n: 2,
      title: "ТЭП",
      short: "ТЭП",
      hint: "По ТЭП архитектора, ГПЗУ и ППТ.",
      tabs: [...only(areas, "Площади"), ...only(gpzu, "Пределы ГПЗУ"), ...only(mix, "Квартирография"), ...only(parking, "Машино-места"), ...only(landscape, "Благоустройство")],
    },
    { id: "sched", n: 3, title: "График", short: "График", hint: "Вехи по очередям.", tabs: only(milestones, "Вехи по очередям") },
    { id: "sales-in", n: 4, title: "Продажи", short: "Продажи", hint: "Цены, темп продаж и условия оплаты.", tabs: [...sales.map((g) => ({ ...g, title: SALES_TAB[g.title] ?? g.title })), ...only(payment, "Оплата")] },
    { id: "costs", n: 5, title: "Затраты", short: "Затраты", hint: "Статьи бюджета.", tabs: budgetGroups() },
    { id: "fin", n: 6, title: "Финансирование", short: "Финансы", hint: "Условия банка по проектному финансированию и эскроу.", tabs: [...only(credit, "Кредит"), ...only(escrow, "Эскроу")] },
    { id: "tax", n: 7, title: "Налоги и оценка", short: "Налоги", hint: "Налоги и дисконтирование.", tabs: [...only(taxes, "Налоги"), ...only(valuation, "Оценка")] },
  ];
}

/** Короткие названия вкладок шага «Продажи». */
const SALES_TAB: Record<string, string> = {
  "Продукты и стартовые цены": "Продукты и цены",
  "Рост цен (как в исходном Excel)": "Рост цены",
  "Рост цен": "Рост цены",
  "Поступления в денежный поток (как в исходном Excel)": "Поступления",
};

export const SHEETS: { id: SheetId; title: string }[] = [
  { id: "sales", title: "План продаж" },
  { id: "budget", title: "Бюджет" },
  { id: "escrow", title: "Эскроу" },
  { id: "cf", title: "Денежный поток" },
];

/** Незаполненных обязательных значений в шаге. */
export const stepMissing = (step: InputStep, model: ProjectModel): number => missingCount(step.tabs, model);

/** Незаполненных обязательных значений во всех шагах вводных (без повторов). */
export const inputsMissing = (project: DemoProject, model: ProjectModel): number => missingCount(inputSteps(project).flatMap((s) => s.tabs), model);

/** Шаг и вкладка, где стоит поле параметра; null — поля в шагах нет. */
export function placeOfParam(project: DemoProject, id: ParameterId): { step: StepId; tab: number } | null {
  for (const s of inputSteps(project)) {
    const tab = s.tabs.findIndex((g) => g.params.includes(id));
    if (tab >= 0) return { step: s.id, tab };
  }
  return null;
}

/** Первое незаполненное обязательное поле по порядку шагов: для статуса «Не хватает N значений» в шапке. */
export function firstMissing(project: DemoProject, model: ProjectModel): { step: StepId; tab: number; id: ParameterId } | null {
  for (const s of inputSteps(project)) {
    for (const [tab, g] of s.tabs.entries()) {
      const id = g.params.find((p) => model.missing.has(p));
      if (id) return { step: s.id, tab, id };
    }
  }
  return null;
}

/** Куда вести ссылку на прежнюю вкладку листа (пункты расхождений, панель «Как посчитано»). */
export const SECTION_OF_TAB: Record<InputTab, SectionId> = { tep: "tep", budget: "budget", sales: "sales", escrow: "escrow", cf: "cf", dashboard: "dashboard" };

/** Адрес раздела проекта. */
export function sectionHref(projectId: string, section: SectionId, extra: Record<string, string | number> = {}): string {
  const q = new URLSearchParams({ s: section, ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, String(v)])) });
  return `/projects/${projectId}?${q.toString()}`;
}
