/**
 * Стандартные значения компании в проекте (решение владельца продукта 28.09.2026): значение справочника допущений,
 * которое проект использует без своего, помечается на поле «Стандарт компании» с кнопкой «Подтвердить». Подтверждение
 * (кто, когда, комментарий) хранится в проекте по ключу STANDARD:<параметр>. Во вкладку «Расхождения» не попадает.
 * Расчёт «как в исходном Excel» берёт такие значения из самого Excel — там стандарта нет.
 */
import { spec, type CapexItemId, type ParameterId } from "@fm/spec";
import { isConfirmed, versionOf, type AssumptionItem, type AssumptionVersion } from "./assumptions";
import type { DemoProject } from "./types";

/** Статья бюджета задана в проекте суммой («фикс») — ставка из справочника в ней не участвует. */
function fixedInProject(project: DemoProject, itemId: CapexItemId): boolean {
  const rows = project.input.values["CAPEX.ITEMS"];
  return Array.isArray(rows) && rows.some((r) => (r as { item_id?: string; base?: string }).item_id === itemId && (r as { base?: string }).base === "фикс");
}

/** Стандартное значение не участвует в расчёте проекта: все статьи бюджета с этой ставкой заданы суммой. */
function unused(item: AssumptionItem, project: DemoProject): boolean {
  const capex = spec.capexItems.filter((c) => c.rate_param === item.param);
  return capex.length > 0 && capex.every((c) => fixedInProject(project, c.item_id));
}

/** Стандартные значения, которые проект использует в текущем расчёте. */
export function standardInUse(project: DemoProject, versions: AssumptionVersion[]): ParameterId[] {
  if (project.input.mode === "legacy" && project.legacyCase) return [];
  const v = versionOf(versions, project.assumptionsVersion);
  if (!v) return [];
  return v.items
    .filter((i) => i.value !== null && i.value !== undefined)
    .filter((i) => project.input.values[i.param] === undefined || project.input.values[i.param] === null)
    .filter((i) => !unused(i, project))
    .map((i) => i.param);
}

/** Стандартные значения, которые проект использует, но финансисты для него ещё не подтвердили. */
export const unconfirmedStandard = (project: DemoProject, versions: AssumptionVersion[]): ParameterId[] =>
  standardInUse(project, versions).filter((id) => !isConfirmed(project, id));
