/**
 * Вводные каждой вкладки проекта: одни и те же списки для блока «Вводные» на вкладке и для счётчика незаполненных
 * обязательных полей в заголовке вкладки («ТЭП · 7 не заполнено»).
 */
import { spec, type ParameterId } from "@fm/spec";
import type { ProjectModel } from "./model";
import type { DemoProject } from "./types";

export interface InputGroup {
  title: string;
  params: ParameterId[];
  note?: string | undefined;
}

/** Группы бюджета в порядке листа «Бюджет» исходного Excel. */
export const BUDGET_GROUPS: [string, string][] = [
  ["правообладание", "Правообладание"],
  ["ПИР", "ПИР"],
  ["СМР", "СМР"],
  ["сети", "Сети"],
  ["благоустройство", "Благоустройство"],
  ["соцобъекты", "Соцобъекты"],
  ["управление", "Управление"],
  ["коммерческие", "Коммерческие"],
];

const PROJECT: ParameterId[] = ["GEN.PROJECT_NAME", "GEN.REGION_CODE", "GEN.HOUSING_CLASS", "GEN.PROJECT_STAGE", "GEN.CADASTRAL_NUMBER", "GEN.MODEL_START_DATE", "GEN.PHASES_COUNT"];
const LAND: ParameterId[] = ["LAND.AREA", "LAND.CADASTRAL_VALUE", "LAND.TENURE"];
const AREAS_CONCEPT: ParameterId[] = ["TEP.GFA_ABOVE", "TEP.RES_GFA", "TEP.NONRES_GFA", "TEP.APT_AREA", "TEP.COMM_AREA", "TEP.APART_AREA", "TEP.MOP_AREA", "TEP.GFA_BELOW", "TEP.STORAGE_COUNT", "TEP.STORAGE_AREA", "TEP.FOOTPRINT_AREA", "TEP.MAX_FLOORS", "TEP.BUILDING_HEIGHT_M"];
const AREAS_ESTIMATE: ParameterId[] = ["TEP.FOOTPRINT_AREA", "TEP.AVG_FLOORS", "TEP.RES_GFA_SHARE", "TEP.APART_GFA_SHARE", "TEP.APT_EFFICIENCY", "TEP.COMM_EFFICIENCY", "TEP.APART_EFFICIENCY", "TEP.MOP_AREA", "TEP.STORAGE_PER_APT", "TEP.STORAGE_AVG_AREA"];
const GPZU: ParameterId[] = ["GPZU.MAX_GFA_ABOVE", "GPZU.MAX_BUILT_SHARE", "GPZU.MAX_FLOORS", "GPZU.MAX_HEIGHT_M", "GPZU.APART_ALLOWED"];
const PARKING_CONCEPT: ParameterId[] = ["TEP.PARKING_NORM", "TEP.PARKING_GPZU_COUNT", "TEP.PARKING_COUNT_OVERRIDE"];
const PARKING_ESTIMATE: ParameterId[] = [...PARKING_CONCEPT, "TEP.PARKING_AREA_PER_SPACE"];
const LANDSCAPE: ParameterId[] = ["TEP.LANDSCAPE_SHARE", "TEP.ROAD_SHARE", "TEP.GREEN_SHARE"];

export function tepGroups(project: DemoProject): InputGroup[] {
  const estimate = project.input.values["GEN.PROJECT_STAGE"] === "оценка участка";
  return [
    { title: "Проект", params: PROJECT },
    { title: "Участок", params: LAND },
    estimate
      ? { title: "Площади: пределы ГПЗУ и коэффициенты (стадия «Оценка участка»)", params: [...GPZU, ...AREAS_ESTIMATE] }
      : { title: "Площади по ТЭП архитектора (стадия «Концепция»)", params: AREAS_CONCEPT },
    ...(estimate ? [] : [{ title: "Пределы ГПЗУ", params: GPZU }]),
    { title: "Квартирография", params: ["TEP.APT_MIX"] },
    { title: "Машино-места", params: estimate ? PARKING_ESTIMATE : PARKING_CONCEPT },
    { title: "Благоустройство", params: LANDSCAPE },
    { title: "Вехи проекта по очередям", params: ["TIME.MILESTONES"], note: project.note },
  ];
}

export function budgetGroups(): InputGroup[] {
  const groups: InputGroup[] = BUDGET_GROUPS.map(([key, title]) => {
    const params = [...new Set(spec.capexItems.filter((c) => c.group === key && c.rate_param).map((c) => c.rate_param as ParameterId))];
    if (key === "правообладание") params.push("TAX.LAND_RATE", "LAND.CADASTRAL_VALUE_AFTER_VRI");
    return { title, params };
  }).filter((g) => g.params.length > 0);
  groups.push({ title: "Индексация затрат", params: ["CAPEX.COST_INDEX", "CAPEX.OPEX_INDEX"] });
  return groups;
}

export function salesGroups(project: DemoProject): InputGroup[] {
  return [
    { title: "Продукты и стартовые цены", params: ["SALES.PRODUCTS"] },
    { title: "Темп продаж", params: ["SALES.PACE"] },
    ...(project.input.mode === "legacy"
      ? [
          { title: "Рост цен (как в исходном Excel)", params: ["SALES.LEGACY_PRICE_GROWTH"] as ParameterId[], note: "В расчёте «как в исходном Excel» цена растёт ступенькой, как в исходнике. Рост по рынку и стадиям готовности действует в расчёте сервиса." },
          { title: "Поступления в денежный поток (как в исходном Excel)", params: ["SALES.LEGACY_CASH_IN_END"] as ParameterId[], note: "В исходнике строка доходов CF1 обрывается раньше продаж, поэтому часть выручки в денежный поток не попадает. В расчёте сервиса учитываются все поступления." },
        ]
      : [
          {
            title: "Рост цен",
            params: ["SALES.PRICE_MARKET_GROWTH", "SALES.PRICE_STAGE_UPLIFT"] as ParameterId[],
            note: "Известное допущение: надбавка за стадию считается по готовности СМР всего проекта, а не своей очереди. Если дальние очереди начинают продавать рано, их цена получает надбавку за стройку ближних очередей, и выручка завышается.",
          },
        ]),
  ];
}

export function escrowGroups(project: DemoProject): InputGroup[] {
  return [
    { title: "Структура оплат", params: ["SALES.PAYMENT_MIX"] },
    project.input.mode === "legacy"
      ? { title: "Эскроу (как в исходном Excel)", params: ["TIME.LEGACY_ESCROW_DEPOSIT_END", "TIME.LEGACY_ESCROW_RELEASE_DATE", "FIN.ESCROW_RESERVE_RATE"], note: "В исходнике сделки идут на эскроу до даты, после которой в CF1 вбиты нули, а раскрытие одной датой для всех очередей проставлено руками. В расчёте сервиса раскрытие — через лаг после РНВ каждой очереди." }
      : { title: "Раскрытие", params: ["TIME.ESCROW_RELEASE_LAG_M", "FIN.ESCROW_RESERVE_RATE"] },
  ];
}

export function cfGroups(project: DemoProject): InputGroup[] {
  return [
    project.input.mode === "legacy"
      ? {
          title: "Проектное финансирование (как в исходном Excel)",
          params: ["FIN.EQUITY_SHARE", "FIN.RATE_PREFERENTIAL", "FIN.LEGACY_KEY_RATE", "FIN.RATE_BASE_SPREAD", "FIN.RATE_DISCOUNT_COEF", "FIN.RATE_MIN", "FIN.FEE_ARRANGEMENT", "FIN.LEGACY_LIMIT"],
          note: "Кредит считается по кварталам, как в листе CF1, вместе с его ошибками: выдачи гасятся в том же квартале, проценты при раскрытии эскроу попадают в поток как поступление. Все такие места — во вкладке «Расхождения». Правильный расчёт кредита — в расчёте сервиса.",
        }
      : {
          title: "Проектное финансирование",
          params: ["FIN.EQUITY_SHARE", "FIN.RATE_PREFERENTIAL", "FIN.RATE_BASE_SPREAD", "FIN.KEY_RATE_PATH", "FIN.RATE_DISCOUNT_COEF", "FIN.RATE_MIN", "FIN.FEE_ARRANGEMENT", "FIN.FEE_COMMITMENT"],
          note: "Налоги в потребность в финансировании войдут, когда появится их расчёт.",
        },
    { title: "Налоги", params: ["TAX.VAT_RATE", "TAX.VAT_REGIME", "TAX.INPUT_VAT_RECOVERABLE", "TAX.PROFIT_RATE", "TAX.LOSS_CARRYFORWARD_LIMIT"] },
    { title: "Дисконтирование", params: ["GEN.VALUATION_DATE", "VAL.RISK_FREE", "VAL.EQUITY_PREMIUM", "VAL.HURDLE_IRR"] },
  ];
}

export const dashboardGroups = (): InputGroup[] => [{ title: "Оценка", params: ["GEN.VALUATION_DATE"] }];

export type InputTab = "tep" | "budget" | "sales" | "escrow" | "cf" | "dashboard";

export function tabGroups(tab: InputTab, project: DemoProject): InputGroup[] {
  switch (tab) {
    case "tep":
      return tepGroups(project);
    case "budget":
      return budgetGroups();
    case "sales":
      return salesGroups(project);
    case "escrow":
      return escrowGroups(project);
    case "cf":
      return cfGroups(project);
    case "dashboard":
      return dashboardGroups();
  }
}

/** Число незаполненных обязательных полей в группах (без повторов поля в нескольких группах). */
export function missingCount(groups: InputGroup[], model: ProjectModel): number {
  return new Set(groups.flatMap((g) => g.params).filter((id) => model.missing.has(id))).size;
}

/** Счётчик незаполненных обязательных полей на вкладке. */
export const tabMissing = (tab: InputTab, project: DemoProject, model: ProjectModel): number => missingCount(tabGroups(tab, project), model);
