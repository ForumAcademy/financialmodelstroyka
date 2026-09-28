/**
 * Меню проекта (docs/ЗАДАНИЕ_пересборка_интерфейса, раздел 3.2): семь шагов «Вводных показателей» с вкладками,
 * четыре листа «Расчёта», «Дашборд», «Документы проекта», «Расхождения с Excel».
 * В шагах — все поля вкладок листов (lib/tab-inputs.ts) и все значения исходного Excel по карте legacy/: ни одно поле
 * не теряется, это проверяет test/project-nav.test.ts. Поля расчёта «Как в исходном Excel» показываются у проектов
 * из Excel в обоих режимах: переключатель режима — в «Расхождениях с Excel».
 */
import type { CalcMessage } from "@fm/engine";
import { spec, type ParameterId } from "@fm/spec";
import type { ProjectModel } from "./model";
import { missingCount, type InputGroup, type InputTab } from "./tab-inputs";
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

/** Поля, которые есть только в исходном Excel (расчёт «Как в исходном Excel»): показываются у проектов из Excel. */
const EXCEL_ONLY: ParameterId[] = [
  "SALES.LEGACY_PRICE_GROWTH",
  "SALES.LEGACY_CASH_IN_END",
  "FIN.LEGACY_LIMIT",
  "FIN.LEGACY_KEY_RATE",
  "TIME.LEGACY_ESCROW_DEPOSIT_END",
  "TIME.LEGACY_ESCROW_RELEASE_DATE",
];

/** Столбцы графика по вкладкам шага «График»: очередь — в обеих. */
const PREP_COLUMNS = ["phase", "land_acquired", "vri_change_date", "design_start", "expertise_done", "rns_date"];
const BUILD_COLUMNS = ["phase", "sales_start", "construction_start", "construction_end", "rnv_date", "handover_start", "handover_end"];

/** Вкладки шага «Затраты» и группы статей бюджета в них (раздел 3.3 задания). */
export const COST_TABS: { title: string; groups: string[]; extra: ParameterId[] }[] = [
  { title: "Участок и права", groups: ["правообладание"], extra: ["LAND.RENT_ANNUAL", "LAND.VRI_FEE", "LAND.CADASTRAL_VALUE_AFTER_VRI", "TAX.LAND_RATE"] },
  { title: "ПИР и ИРД", groups: ["ПИР"], extra: [] },
  { title: "Строительство", groups: ["СМР", "сети", "благоустройство", "соцобъекты"], extra: ["CAPEX.COST_INDEX"] },
  { title: "Продажи", groups: ["коммерческие"], extra: [] },
  { title: "Управление и резерв", groups: ["управление"], extra: ["CAPEX.OPEX_INDEX"] },
];

/** Вкладки «Затрат»: ставки статей — полями параметров, суммы статей — полями статей бюджета. */
export function costTabs(): InputGroup[] {
  return COST_TABS.map(({ title, groups, extra }) => {
    const items = spec.capexItems.filter((c) => groups.includes(c.group));
    const params = [...new Set(items.filter((c) => c.rate_param).map((c) => c.rate_param as ParameterId)), ...extra];
    // статья, у которой сумма — сам параметр, показывается полем параметра
    const rows = items.filter((c) => !(c.rate_param && c.base === "фикс")).map((c) => c.item_id);
    return { title, params, items: rows };
  });
}

export function inputSteps(project: DemoProject): InputStep[] {
  const excel = Boolean(project.legacyCase);
  const keep = (ids: ParameterId[]) => ids.filter((id) => excel || !EXCEL_ONLY.includes(id));
  const estimate = project.input.values["GEN.PROJECT_STAGE"] === "оценка участка";
  return [
    {
      id: "site",
      n: 1,
      title: "Проект и участок",
      short: "Проект",
      hint: "Общие данные и участок по выписке ЕГРН.",
      tabs: [
        { title: "Проект", params: ["GEN.PROJECT_NAME", "GEN.REGION_CODE", "GEN.HOUSING_CLASS", "GEN.PROJECT_STAGE", "GEN.MODEL_START_DATE", "GEN.PHASES_COUNT"] },
        { title: "Участок", params: ["GEN.CADASTRAL_NUMBER", "LAND.AREA", "LAND.CADASTRAL_VALUE", "LAND.TENURE"] },
      ],
    },
    {
      id: "tep",
      n: 2,
      title: "ТЭП",
      short: "ТЭП",
      hint: estimate ? "Площади по плотности: пределы ГПЗУ и коэффициенты." : "По ТЭП архитектора, ГПЗУ и ППТ.",
      tabs: [
        { title: "Площади", params: estimate ? AREAS_ESTIMATE : AREAS_CONCEPT },
        { title: "Пределы ГПЗУ", params: GPZU },
        { title: "Квартирография", params: ["TEP.APT_MIX"] },
        { title: "Машино-места", params: PARKING },
        { title: "Благоустройство", params: LANDSCAPE },
      ],
    },
    {
      id: "sched",
      n: 3,
      title: "График",
      short: "График",
      hint: "Вехи по очередям.",
      tabs: [
        { title: "Подготовка", params: ["TIME.MILESTONES"], columns: PREP_COLUMNS, note: project.note },
        { title: "Стройка и продажи", params: ["TIME.MILESTONES"], columns: BUILD_COLUMNS },
      ],
    },
    {
      id: "sales-in",
      n: 4,
      title: "Продажи",
      short: "Продажи",
      hint: "Цены, темп продаж и условия оплаты.",
      tabs: [
        { title: "Продукты и цены", params: ["SALES.PRODUCTS"] },
        { title: "Темп продаж", params: ["SALES.PACE"] },
        { title: "Рост цены", params: keep(["SALES.LEGACY_PRICE_GROWTH", "SALES.PRICE_MARKET_GROWTH", "SALES.PRICE_STAGE_UPLIFT"]) },
        { title: "Оплата", params: keep(["SALES.PAYMENT_MIX", "SALES.LEGACY_CASH_IN_END"]) },
      ],
    },
    { id: "costs", n: 5, title: "Затраты", short: "Затраты", hint: "Статьи бюджета.", tabs: costTabs() },
    {
      id: "fin",
      n: 6,
      title: "Финансирование",
      short: "Финансы",
      hint: "Условия банка по проектному финансированию и эскроу.",
      tabs: [
        { title: "Кредит", params: keep(["FIN.EQUITY_SHARE", "FIN.LEGACY_LIMIT", "FIN.FEE_ARRANGEMENT", "FIN.FEE_COMMITMENT", "FIN.COLLATERAL_DISCOUNT"]) },
        { title: "Ставки", params: keep(["FIN.KEY_RATE_PATH", "FIN.LEGACY_KEY_RATE", "FIN.RATE_BASE_SPREAD", "FIN.RATE_PREFERENTIAL", "FIN.RATE_DISCOUNT_COEF", "FIN.RATE_MIN"]) },
        { title: "Эскроу", params: keep(["TIME.ESCROW_RELEASE_LAG_M", "FIN.ESCROW_RESERVE_RATE", "TIME.LEGACY_ESCROW_DEPOSIT_END", "TIME.LEGACY_ESCROW_RELEASE_DATE"]) },
      ],
    },
    {
      id: "tax",
      n: 7,
      title: "Налоги и оценка",
      short: "Налоги",
      hint: "Налоги и дисконтирование.",
      tabs: [
        { title: "Налоги", params: ["TAX.VAT_RATE", "TAX.VAT_REGIME", "TAX.INPUT_VAT_RECOVERABLE", "TAX.PROFIT_RATE", "TAX.LOSS_CARRYFORWARD_LIMIT"] },
        { title: "Оценка", params: ["GEN.VALUATION_DATE", "VAL.RISK_FREE", "VAL.EQUITY_PREMIUM", "VAL.HURDLE_IRR"] },
      ],
    },
  ];
}

const AREAS_CONCEPT: ParameterId[] = ["TEP.GFA_ABOVE", "TEP.GFA_BELOW", "TEP.RES_GFA", "TEP.NONRES_GFA", "TEP.APT_AREA", "TEP.COMM_AREA", "TEP.APART_AREA", "TEP.MOP_AREA", "TEP.STORAGE_COUNT", "TEP.STORAGE_AREA", "TEP.FOOTPRINT_AREA", "TEP.MAX_FLOORS", "TEP.BUILDING_HEIGHT_M"];
const AREAS_ESTIMATE: ParameterId[] = ["TEP.FOOTPRINT_AREA", "TEP.AVG_FLOORS", "TEP.RES_GFA_SHARE", "TEP.APART_GFA_SHARE", "TEP.APT_EFFICIENCY", "TEP.COMM_EFFICIENCY", "TEP.APART_EFFICIENCY", "TEP.MOP_AREA", "TEP.STORAGE_PER_APT", "TEP.STORAGE_AVG_AREA"];
const GPZU: ParameterId[] = ["GPZU.MAX_GFA_ABOVE", "GPZU.MAX_BUILT_SHARE", "GPZU.MAX_FLOORS", "GPZU.MAX_HEIGHT_M", "GPZU.APART_ALLOWED"];
const PARKING: ParameterId[] = ["TEP.PARKING_NORM", "TEP.PARKING_GPZU_COUNT", "TEP.PARKING_COUNT_OVERRIDE", "TEP.PARKING_AREA_PER_SPACE"];
const LANDSCAPE: ParameterId[] = ["TEP.LANDSCAPE_SHARE", "TEP.ROAD_SHARE", "TEP.GREEN_SHARE"];

export const SHEETS: { id: SheetId; title: string }[] = [
  { id: "sales", title: "План продаж" },
  { id: "budget", title: "Бюджет" },
  { id: "escrow", title: "Эскроу" },
  { id: "cf", title: "Денежный поток" },
];

/**
 * Проверки вкладки: предупреждения и ошибки расчёта по её полям, кроме «заполните …» (такое поле и так жёлтое) и
 * расхождений с исходным Excel (они — в разделе «Расхождения с Excel»). Ошибки статей бюджета — на вкладке статьи.
 */
export function tabChecks(project: DemoProject, model: ProjectModel, g: InputGroup): CalcMessage[] {
  const names = (g.items ?? []).map((id) => spec.capexItems.find((c) => c.item_id === id)?.name).filter((n): n is string => Boolean(n));
  const seen = new Set<string>();
  return model.result.messages.filter((m) => {
    if (m.severity === "info" || !m.parameterId || m.text.startsWith("Заполните")) return false;
    if (m.key && (project.input.mode === "legacy" || m.key.startsWith("LEGACY."))) return false;
    const here = g.params.includes(m.parameterId) || (m.parameterId === "CAPEX.ITEMS" && names.some((n) => m.text.includes(`«${n}»`)));
    if (!here || seen.has(m.text)) return false;
    seen.add(m.text);
    return true;
  });
}

/** Проверок в шаге, которые не сходятся. */
export const stepChecks = (project: DemoProject, model: ProjectModel, step: InputStep): number => step.tabs.reduce((n, g) => n + tabChecks(project, model, g).length, 0);

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
