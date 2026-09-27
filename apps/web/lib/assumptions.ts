/**
 * Справочник допущений компании (data/company_assumptions.yaml): стандартные значения для нового проекта.
 * Проект запоминает версию, на которой создан, и получает значения этой версии там, где у него нет своих.
 * Новая версия справочника не меняет существующие проекты: проект переходит на неё только по кнопке «Обновить».
 * До этапа 7 новые версии живут в памяти браузера до перезагрузки страницы; версия 1 — из data/company_assumptions.yaml.
 */
import { getParameter, spec, type ParameterId, type SpecAssumptionItem, type SpecAssumptionVersion } from "@fm/spec";
import * as fmt from "./format";
import type { DemoProject } from "./types";

export type AssumptionVersion = SpecAssumptionVersion;
export type AssumptionItem = SpecAssumptionItem;

/** Версии из data/company_assumptions.yaml. */
export const SPEC_ASSUMPTIONS: AssumptionVersion[] = spec.assumptions;

export const GROUP_LABEL: Record<AssumptionItem["group"], string> = { sales: "Продажи", budget: "Бюджет", escrow: "Эскроу", fin: "Финансирование" };
export const STATUS_LABEL: Record<AssumptionItem["status"], string> = { unverified: "не проверено", approved: "утверждено" };

/** Вкладка проекта, где вводится значение раздела справочника. */
export const GROUP_TAB: Record<AssumptionItem["group"], { id: "sales" | "budget" | "escrow" | "cf"; label: string }> = {
  sales: { id: "sales", label: "План продаж" },
  budget: { id: "budget", label: "Бюджет" },
  escrow: { id: "escrow", label: "Эскроу" },
  fin: { id: "cf", label: "CF" },
};

export const latest = (versions: AssumptionVersion[]): AssumptionVersion => versions[versions.length - 1] as AssumptionVersion;

export function versionOf(versions: AssumptionVersion[], n: number | undefined): AssumptionVersion | null {
  return n === undefined ? null : (versions.find((v) => v.version === n) ?? null);
}

/** Параметры, которые есть в справочнике (в любой версии). */
export function assumptionParams(versions: AssumptionVersion[]): Set<ParameterId> {
  return new Set(versions.flatMap((v) => v.items.map((i) => i.param)));
}

/** Стандартные значения версии: только заданные (null — стандарта нет, значение вводится в проекте). */
export function standardValues(v: AssumptionVersion | null): Partial<Record<ParameterId, unknown>> {
  if (!v) return {};
  return Object.fromEntries(v.items.filter((i) => i.value !== null && i.value !== undefined).map((i) => [i.param, i.value]));
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export interface ItemDiff {
  param: ParameterId;
  before: AssumptionItem | null;
  after: AssumptionItem | null;
  /** Изменилось само значение (а не только статус или «Откуда»). */
  valueChanged: boolean;
}

/** Что изменилось между двумя версиями справочника. */
export function diffVersions(a: AssumptionVersion | null, b: AssumptionVersion): ItemDiff[] {
  const params = [...new Set([...(a?.items ?? []).map((i) => i.param), ...b.items.map((i) => i.param)])];
  return params
    .map((param) => {
      const before = a?.items.find((i) => i.param === param) ?? null;
      const after = b.items.find((i) => i.param === param) ?? null;
      return { param, before, after, valueChanged: !same(before?.value, after?.value) };
    })
    .filter((d) => d.valueChanged || !same(d.before, d.after));
}

/** Статус «подтверждено финансистами» стандартного значения в проекте: вопрос к данным по нему решён. */
export const standardKey = (param: ParameterId) => `STANDARD:${param}`;

export function isConfirmed(project: DemoProject, param: ParameterId): boolean {
  return project.issues?.[standardKey(param)]?.status === "done";
}

/** Кто и когда подтвердил значение (последняя смена статуса на «Решено»). */
export function confirmation(project: DemoProject, param: ParameterId) {
  const s = project.issues?.[standardKey(param)];
  if (s?.status !== "done") return null;
  return [...s.history].reverse().find((e) => e.status === "done") ?? null;
}

export type ValueSource = "standard" | "confirmed" | "project";

export const SOURCE_LABEL: Record<ValueSource, string> = {
  standard: "стандарт компании",
  confirmed: "подтверждено финансистами",
  project: "введено для проекта",
};

/**
 * Источник значения параметра справочника в проекте: своё значение проекта → «введено для проекта»; стандарт
 * компании → «стандарт компании» или «подтверждено финансистами». null — параметра нет в справочнике или значения нет.
 */
export function valueSource(project: DemoProject, param: ParameterId, versions: AssumptionVersion[]): ValueSource | null {
  if (!assumptionParams(versions).has(param)) return null;
  const own = project.input.values[param];
  if (own !== undefined && own !== null) return "project";
  const std = standardValues(versionOf(versions, project.assumptionsVersion))[param];
  if (std === undefined) return null;
  return isConfirmed(project, param) ? "confirmed" : "standard";
}

/** Значение справочника простыми словами: «3,5%», «3 мес.», структура оплат одной строкой, «не задано». */
export function assumptionValueText(param: ParameterId, value: unknown): string {
  if (value === null || value === undefined) return "не задано";
  const p = getParameter(param);
  if (typeof value === "number") {
    if (p.unit === "доля" || p.unit === "%годовых") return fmt.share(value).replace(/^-/, "−");
    if (p.unit === "мес") return `${fmt.inputNumber(value)} мес.`;
    return `${fmt.inputNumber(value)} ${fmt.unit(p.unit)}`.trim();
  }
  if (param === "SALES.PAYMENT_MIX" && Array.isArray(value)) {
    const rows = value as Record<string, unknown>[];
    const text = (r: Record<string, unknown>) =>
      `ипотека ${fmt.share(Number(r.mortgage_share ?? 0))} (из них взнос ${fmt.share(Number(r.mortgage_down_payment ?? 0))}), оплата 100% — ${fmt.share(Number(r.full_payment_share ?? 0))}, рассрочка ${fmt.share(Number(r.installment_share ?? 0))}`;
    const first = rows[0];
    const oneForAll = first && rows.every((r) => same({ ...r, product: null }, { ...first, product: null }));
    return oneForAll ? `${rows.map((r) => r.product).join(", ")}: ${text(first)}` : rows.map((r) => `${r.product}: ${text(r)}`).join("; ");
  }
  if (Array.isArray(value)) return `таблица, ${value.length} ${fmt.plural(value.length, ["строка", "строки", "строк"])}`;
  return fmt.value(value);
}
