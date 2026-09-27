/**
 * Режим совместимости с исходным Excel: входы кейса tests/cases/*_legacy.yaml → ProjectInput.
 * Чтение файла — у вызывающего кода (тесты, сид демо-проекта), ядро остаётся без файловой системы.
 */
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
 * - статьи с графиком по продажам (маркетинг, брокеридж — этап 4) не заменяются.
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
    if (item.schedule_rule === "follow_sales") continue;
    const row: Record<string, unknown> = { item_id: lg.item_id, price_date: start, vat_included: withVat };
    if (RECALCULATED.has(lg.item_id)) {
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
  return { values, mode: "legacy" };
}
