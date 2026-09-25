/**
 * Режим совместимости с исходным Excel: входы кейса tests/cases/*_legacy.yaml → ProjectInput.
 * Чтение файла — у вызывающего кода (тесты, сид демо-проекта), ядро остаётся без файловой системы.
 */
import { isParameterId, type ParameterId } from "@fm/spec";
import type { ProjectInput } from "./types";

/** Кейс исходного Excel (структура tests/cases/*_legacy.yaml). */
export interface LegacyCase {
  case_id: string;
  description: string;
  project_inputs: Record<string, unknown>;
  reconciliation_targets: Record<string, unknown>;
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
  return { values, mode: "legacy" };
}
