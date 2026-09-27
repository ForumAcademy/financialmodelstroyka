/**
 * Панель «Продано в месяце»: таблица по продуктам, темп и предупреждения с суммой в рублях — из расчёта сервиса.
 * План продаж берётся из расчёта «как в исходном Excel» (там продаётся ряд плана как есть), чтобы показать,
 * сколько по плану не вошло в расчёт сервиса и почему.
 */
import Decimal from "decimal.js";
import { fmtRub } from "@fm/engine";
import * as fmt from "./format";
import { monthName } from "./how-example";
import type { ProjectModel } from "./model";
import type { DemoProject } from "./types";

type Series = Record<string, Decimal[]>;
type Row = Record<string, unknown>;

const ZERO = new Decimal(0);
const HUNDRED = 100;
/** Остаток меньше целого м² (шт) — округление ручного плана: площадь продана вся. */
const WHOLE = 1;

export interface SalesRow {
  key: string;
  unit: "м²" | "шт";
  built: Decimal | null;
  sold: Decimal;
  unsold: Decimal | null;
  soldOut: string | null;
  byRnvShare: Decimal | null;
  firstMonth: string | null;
  months: number;
  avgPerMonth: Decimal | null;
}

export interface SalesWarning {
  key: string;
  text: string;
  money: Decimal;
}

const sum = (xs: Decimal[] | undefined) => (xs ?? []).reduce((s, x) => s.add(x), ZERO);
const qty = (d: Decimal) => fmt.num(d.toDecimalPlaces(3).trunc(), 0);

function productRows(project: DemoProject): Row[] {
  const v = project.input.values["SALES.PRODUCTS"];
  return Array.isArray(v) ? (v as Row[]) : [];
}

function milestoneOf(project: DemoProject, phase: unknown): Row | undefined {
  const v = project.input.values["TIME.MILESTONES"];
  return Array.isArray(v) ? (v as Row[]).find((r) => r.phase === phase) : undefined;
}

/** Строки таблицы по продуктам из расчёта сервиса. */
export function salesRows(project: DemoProject, m: ProjectModel): SalesRow[] | null {
  const sold = m.result.formulas["F.SALES.SOLD_AREA"]?.value as Series | undefined;
  const dates = (m.result.formulas["F.TIME.DATE"]?.value as string[] | undefined) ?? [];
  if (!sold) return null;
  return productRows(project).map((row) => {
    const key = String(row.name ?? row.product);
    const unit = row.product === "машино-места" || row.product === "кладовые" ? "шт" : "м²";
    const s = sold[key] ?? [];
    const total = sum(s);
    const stock = unit === "шт" ? row.stock_units : row.stock_area;
    const built = typeof stock === "number" ? new Decimal(stock) : null;
    const on = s.map((x, t) => (x.isZero() ? -1 : t)).filter((t) => t >= 0);
    const first = on[0];
    const last = on[on.length - 1];
    const unsold = built ? Decimal.max(built.sub(total), ZERO) : null;
    const rnv = milestoneOf(project, row.phase)?.rnv_date;
    const beforeRnv = typeof rnv === "string" ? sum(s.filter((_, t) => (dates[t] ?? "") <= rnv)) : null;
    const months = first !== undefined && last !== undefined ? last - first + 1 : 0;
    return {
      key,
      unit,
      built,
      sold: total,
      unsold,
      soldOut: unsold && unsold.lt(WHOLE) && last !== undefined ? (dates[last] ?? null) : null,
      byRnvShare: built && beforeRnv && !built.isZero() ? beforeRnv.div(built) : null,
      firstMonth: first !== undefined ? (dates[first] ?? null) : null,
      months,
      avgPerMonth: months ? total.div(months) : null,
    };
  });
}

/** Итого по м²: машино-места и кладовые в штуках в итог не входят. */
export function salesTotal(rows: SalesRow[]): { built: Decimal; sold: Decimal; unsold: Decimal } {
  const area = rows.filter((r) => r.unit === "м²");
  return {
    built: area.reduce((s, r) => s.add(r.built ?? ZERO), ZERO),
    sold: area.reduce((s, r) => s.add(r.sold), ZERO),
    unsold: area.reduce((s, r) => s.add(r.unsold ?? ZERO), ZERO),
  };
}

export const cellQty = (d: Decimal | null, unit?: string) => (d === null ? "—" : unit ? `${qty(d)} ${unit}` : qty(d));
export const cellShare = (d: Decimal | null) => (d === null ? "—" : `${fmt.num(d.mul(HUNDRED), 0)}%`);

/** Строка темпа: «ПСН: в среднем 215 м² в месяц, срок продаж 48 мес.» */
export function paceLine(r: SalesRow): string {
  if (!r.avgPerMonth) return `${r.key}: продаж нет.`;
  return `${r.key}: в среднем ${qty(r.avgPerMonth)} ${r.unit} в месяц, срок продаж ${r.months} мес.`;
}

/**
 * Предупреждения по продажам с суммой в рублях, по убыванию влияния на выручку.
 * legacy — расчёт «как в исходном Excel»: его ряд продаж — план продаж как есть.
 */
export function salesWarnings(project: DemoProject, m: ProjectModel, legacy: ProjectModel | null): SalesWarning[] {
  const rows = salesRows(project, m);
  const sold = m.result.formulas["F.SALES.SOLD_AREA"]?.value as Series | undefined;
  const plan = legacy?.result.formulas["F.SALES.SOLD_AREA"]?.value as Series | undefined;
  const dates = (m.result.formulas["F.TIME.DATE"]?.value as string[] | undefined) ?? [];
  // цена для оценки: средняя цена продаж расчёта сервиса, а пока она не считается — средняя цена исходного Excel
  const wavg = (m.result.formulas["F.SALES.WAVG_PRICE"]?.value ?? legacy?.result.formulas["F.SALES.WAVG_PRICE"]?.value ?? {}) as Record<string, Decimal | null>;
  if (!rows || !sold) return [];
  const out: SalesWarning[] = [];
  for (const r of rows) {
    const s = sold[r.key] ?? [];
    const p = plan?.[r.key];
    const planTotal = p ? sum(p) : null;
    if (r.unsold && r.unsold.gte(WHOLE)) {
      const price = wavg[r.key] ?? null;
      const money = price ? r.unsold.mul(price) : ZERO;
      // план до первого месяца, когда продажи разрешены: продавать ещё нельзя
      const first = s.findIndex((x) => !x.isZero());
      const early = p && first > 0 ? p.slice(0, first).map((x, t) => (x.isZero() ? -1 : t)).filter((t) => t >= 0) : [];
      const start = milestoneOf(project, productRows(project).find((x) => String(x.name ?? x.product) === r.key)?.phase)?.sales_start;
      const why = early.length
        ? `План продаж на ${early.length === 1 ? monthName(dates[early[0]!]) : `${monthName(dates[early[0]!])} — ${monthName(dates[early[early.length - 1]!])}`} приходится на месяцы, когда продавать ещё нельзя${typeof start === "string" ? `: старт продаж ${fmt.date(start)}` : ""}.`
        : "По плану продаж продаётся меньше, чем построено.";
      out.push({ key: r.key, money, text: `${r.key}: ${cellQty(r.unsold, r.unit)} не продано к концу расчёта${price ? ` — ≈ ${fmtRub(money)} не попало в выручку` : ""}. ${why}` });
    }
    if (planTotal && r.built && planTotal.trunc().gt(r.built)) {
      out.push({
        key: r.key,
        money: ZERO,
        text: `${r.key}: по плану продаж ${cellQty(planTotal, r.unit)}, построено ${cellQty(r.built, r.unit)}. В расчёт вошло ${cellQty(r.sold, r.unit)}, выручка не потеряна, но темп завышен на ${cellQty(planTotal.trunc().sub(r.built), r.unit)}.`,
      });
    }
  }
  return out.sort((a, b) => b.money.cmp(a.money));
}
