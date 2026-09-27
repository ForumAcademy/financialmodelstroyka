/**
 * Режим совместимости с исходным Excel: входы кейса tests/cases/*_legacy.yaml → ProjectInput.
 * Чтение файла — у вызывающего кода (тесты, сид демо-проекта), ядро остаётся без файловой системы.
 */
import Decimal from "decimal.js";
import { getCapexItem, getParameter, isCapexItemId, isParameterId, type ParameterId } from "@fm/spec";
import type { ProjectInput } from "./types";

/** Статья бюджета исходника (capex_legacy кейса): расценка, объём, вбитая сумма и ручной квартальный ряд CF1. */
export interface LegacyCapexItem {
  item_id: string;
  budget_row: number | null;
  rate_D?: number | null;
  qty_E?: number | null;
  amount_F?: number | null;
  manual_schedule_quarterly?: { cf_row: number; values_F_to_AS: number[]; sum: number };
  /** Суммы CF1 по кварталам — для статей со своей формулой без ряда «темп» (аренда/налог ЗУ, CF1!F24:AH24). */
  cf_amounts_quarterly?: { cf_row: number; values_F_to_AS: number[]; sum: number };
}

/** Кейс исходного Excel (структура tests/cases/*_legacy.yaml). */
export interface LegacyCase {
  case_id: string;
  description: string;
  project_inputs: Record<string, unknown>;
  reconciliation_targets: Record<string, unknown>;
  capex_legacy?: LegacyCapexItem[];
  /** Концы кварталов столбцов F…AS листа CF1. */
  timeline_quarters_F_to_AS?: string[];
  /** План продаж исходника: темп по кварталам с 1 кв 2026 (шт; для ПСН — лоты) и рост цены за квартал. */
  sales_legacy?: { pace_units_quarterly_from_1q2026: Record<string, number[]>; price_growth_quarterly: number };
}

/** Месяцев в квартале ручных рядов CF1: доля квартала делится поровну на три месяца (F.CAPEX.SCHEDULE_WEIGHT). */
const LEGACY_STEP_MONTHS = 3;

/**
 * Статьи, которые в режиме совместимости считаются по новым правилам, а не вбитой суммой исходника:
 * ошибка исходника исправляется (tests/cases → expected_differences_after_fix).
 * CONTINGENCY — резерв = ставка × база, а не E42 + D42 (площадь + ставка).
 */
const RECALCULATED = new Set(["CONTINGENCY"]);

/**
 * Бюджет исходника → CAPEX.ITEMS:
 * - сумма статьи — вбитая сумма Бюджет!F (база «фикс»; для статей с параметром-суммой — сам параметр); пустая — 0;
 * - сумма с НДС — допущение CAPEX.LEGACY_AMOUNTS_WITH_VAT (S_EXPERT): в исходнике не указано; без индексации (F.CAPEX.INDEX);
 * - график — ручной квартальный ряд CF1, если он равен 100%; иначе правило справочника;
 *   статья с суммой, но без ряда (УДС: в CF1 её нет) — вслед за СМР, чтобы она попала в денежный поток;
 * - статьи со своей формулой (аренда/налог ЗУ, ВРИ) — тоже суммой исходника (Бюджет!F21, F22), распределение — как в CF1
 *   (строка 24 — равномерно по кварталам, ряд CF1!K26); в обычном режиме они считаются формулой и требуют ввода;
 * - статьи с графиком по продажам (маркетинг, брокеридж) — ставка × выручка, с НДС, как остальные суммы исходника.
 */
function legacyCapex(c: LegacyCase, values: Partial<Record<ParameterId, unknown>>): Record<string, unknown>[] {
  const start = c.project_inputs["GEN.MODEL_START_DATE"];
  const quarters = c.timeline_quarters_F_to_AS ?? [];
  const tol = Number(getParameter("CAPEX.SCHEDULE_SUM_TOLERANCE").default);
  const withVat = getParameter("CAPEX.LEGACY_AMOUNTS_WITH_VAT").default === true;
  const rows: Record<string, unknown>[] = [];
  for (const lg of c.capex_legacy ?? []) {
    if (!isCapexItemId(lg.item_id)) continue;
    const item = getCapexItem(lg.item_id);
    const manualRow = (weights: number[]) => ({ schedule_rule: "manual", schedule_manual: { from: quarters[0], step_months: LEGACY_STEP_MONTHS, weights } });
    const series = lg.manual_schedule_quarterly;
    const amounts = lg.cf_amounts_quarterly;
    const manual =
      series && quarters[0] && Math.abs(series.sum - 1) < tol
        ? manualRow(series.values_F_to_AS)
        : amounts && quarters[0] && amounts.sum > 0
          ? manualRow(amounts.values_F_to_AS.map((v) => v / amounts.sum))
          : null;
    const row: Record<string, unknown> = { item_id: lg.item_id, price_date: start, vat_included: withVat };
    // Статьи-доли выручки с графиком по продажам (маркетинг, брокеридж): ставка × выручка по месяцам продаж;
    // сумма маркетинга в исходнике вбита числом (Бюджет!F51 = 8 389 618 415,5 / 2), брокеридж — 3,5% × выручка
    if (RECALCULATED.has(lg.item_id) || item.schedule_rule === "follow_sales") {
      rows.push(row);
      continue;
    }
    const amount = typeof lg.amount_F === "number" ? lg.amount_F : 0;
    if (item.rate_param && item.base === "фикс") values[item.rate_param] = amount;
    else Object.assign(row, { base: "фикс", rate: amount });
    if (manual) Object.assign(row, manual);
    else if (amount !== 0 && item.schedule_rule !== "follow_smr") row.schedule_rule = "follow_smr";
    rows.push(row);
  }
  return rows;
}

/** Месяцев в квартале плана продаж исходника: ряд — поквартальный, объём квартала — поровну на три месяца. */
const LEGACY_QUARTER_MONTHS = 3;

/**
 * План продаж исходника → SALES.PRODUCTS, SALES.PACE, SALES.LEGACY_PRICE_GROWTH, SALES.PAYMENT_MIX:
 * - строки: типы квартир (ТЭП: запас = кол-во × средняя площадь, цена ТЭПы!G41:G43), ПСН, машино-места;
 * - темп — ручной квартальный ряд с 1 кв 2026: квартиры шт × средняя площадь, ПСН лоты × площадь лота, м/м — шт;
 * - цена машино-места за штуку = 270 000 руб/м² × 40,945 м² (как в исходнике);
 * - очередь — последняя: в исходнике продажи по очередям не разделены;
 * - структура оплат исходника (ипотека 0,7, 100% 0,1, ПВ 0,2, рассрочки нет) → ипотека 0,7, 100% оплата 0,3: в CF1 вся
 *   выручка поступает в квартал сделки (CF1!F15), доли должны сходиться к 1.
 */
function legacySales(c: LegacyCase, values: Partial<Record<ParameterId, unknown>>): void {
  const sl = c.sales_legacy;
  const quarters = c.timeline_quarters_F_to_AS ?? [];
  if (!sl || !quarters[0]) return;
  const pi = c.project_inputs;
  const start = pi["GEN.MODEL_START_DATE"];
  const phase = Math.max(...((pi["TIME.MILESTONES"] as { phase: number }[] | undefined) ?? [{ phase: 1 }]).map((r) => r.phase));
  const mix = pi["TEP.APT_MIX"] as { type_name: string; count: number; avg_area: number; start_price: number }[];
  const psn = pi["SALES.PRODUCTS.ПСН"] as { stock_area: number; avg_lot: number; start_price: number };
  const parking = pi["SALES.PRODUCTS.машино-места"] as { price_per_space_calc: number };
  const paceOf = (label: string) => {
    const series = sl.pace_units_quarterly_from_1q2026[label];
    if (!series) throw new Error(`В плане продаж исходника нет ряда «${label}»`);
    return series;
  };
  const products: Record<string, unknown>[] = [];
  const pace: Record<string, unknown>[] = [];
  const add = (row: Record<string, unknown>, values: number[]) => {
    products.push({ phase, price_date: start, sale_channel_before_rnv: "ДДУ_эскроу", ...row });
    pace.push({ name: row.name, method: "ручной", manual: { from: quarters[0], step_months: LEGACY_QUARTER_MONTHS, values } });
  };
  for (const t of mix) {
    const label = Object.keys(sl.pace_units_quarterly_from_1q2026).find((k) => t.type_name.trim().endsWith(k));
    if (!label) throw new Error(`Нет темпа исходника для «${t.type_name}»`);
    add({ name: t.type_name.trim(), product: "квартиры", stock_area: t.count * t.avg_area, start_price: t.start_price }, paceOf(label).map((u) => u * t.avg_area));
  }
  add({ name: "ПСН", product: "ПСН", stock_area: psn.stock_area, start_price: psn.start_price }, paceOf("ПСН").map((u) => u * psn.avg_lot));
  add({ name: "Машино-места", product: "машино-места", stock_units: pi["TEP.PARKING_COUNT_OVERRIDE"], start_price: parking.price_per_space_calc }, paceOf("Машино-места"));
  values["SALES.PRODUCTS"] = products;
  values["SALES.PACE"] = pace;
  values["SALES.LEGACY_PRICE_GROWTH"] = [{ rate: sl.price_growth_quarterly, step_months: LEGACY_QUARTER_MONTHS }];
  const pm = pi["SALES.PAYMENT_MIX"] as { installment: number; mortgage: number; full: number; down_payment: number; installment_quarters: number };
  const types = [...new Set(products.map((r) => r.product as string))];
  values["SALES.PAYMENT_MIX"] = types.map((product) => ({
    product,
    mortgage_share: pm.mortgage,
    full_payment_share: new Decimal(pm.full).add(pm.down_payment).toNumber(),
    installment_share: pm.installment,
    installment_months: pm.installment_quarters * LEGACY_QUARTER_MONTHS,
    installment_down_payment: 0,
  }));
}

/**
 * Входы кейса исходного Excel → ProjectInput в режиме совместимости.
 * Ключи, которые не являются ID параметров (…_legacy, *_TEXT, SALES.PRODUCTS.<продукт>), здесь не нужны.
 * Нормы машино-мест исходника заданы по типам квартир (TEP.APT_MIX.parking_norm) → TEP.PARKING_NORM, rule = per_type.
 */
export function legacyCaseInput(c: LegacyCase): ProjectInput {
  const values: Partial<Record<ParameterId, unknown>> = {};
  for (const [key, value] of Object.entries(c.project_inputs)) if (isParameterId(key)) values[key] = value;
  const mix = c.project_inputs["TEP.APT_MIX"] as { type_name: string; count: number; avg_area: number; parking_norm: number }[];
  values["TEP.APT_MIX"] = mix.map(({ type_name, count, avg_area }) => ({ type_name, count, avg_area }));
  values["TEP.PARKING_NORM"] = { rule: "per_type", values: mix.map((r) => r.parking_norm) };
  if (c.capex_legacy) values["CAPEX.ITEMS"] = legacyCapex(c, values);
  legacySales(c, values);
  return { values, mode: "legacy" };
}
