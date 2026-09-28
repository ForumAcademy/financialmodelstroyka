/**
 * Листы «Расчёта» (задание на пересборку интерфейса, раздел 3.4): план продаж, бюджет, эскроу, денежный поток.
 * Только просмотр того, что посчитало ядро: строки — деньги по месяцам, листы сворачивают их по годам, кварталам или
 * месяцам. У каждой строки — пояснение: как считается, на цифрах проекта, из каких полей, формула в справочнике.
 * Служебных рядов (шкала, флаги 0/1, дни) нет. Строка, которую ядро ещё не считает, помечается «Ещё не рассчитывается».
 */
import Decimal from "decimal.js";
import { getFormula, spec, type FormulaId, type ParameterId } from "@fm/spec";
import { inputFields, monthName } from "./how-example";
import { aggregate, type Period, type ProjectModel } from "./model";
import { COST_TABS, placeOfParam, type SheetId, type StepId } from "./project-nav";
import { fieldLabel } from "./field-view";
import type { DemoProject } from "./types";

/** Ссылка из пояснения в поле вводных. */
export interface FieldLink {
  label: string;
  step: StepId;
  tab: number;
  field?: ParameterId;
}

export interface SheetRow {
  label: string;
  /** Рубли по месяцам шкалы; null — ядро эту строку ещё не считает. */
  series: number[] | null;
  /** Поток суммируется по периоду; остаток берётся на конец периода и не имеет итога. */
  stock?: boolean;
  /** Итоговая строка листа. */
  total?: boolean;
  how: string;
  /** «На цифрах проекта»; null — пока нечего показать. */
  example: string | null;
  links: FieldLink[];
  formula?: FormulaId;
}

export interface CalcSheet {
  id: SheetId;
  title: string;
  hint: string;
  /** false — лист ещё не рассчитывается целиком. */
  ready: boolean;
  dates: string[];
  rows: SheetRow[];
}

const MLN = 1e6;
const BLN = 1e9;
/** Сколько статей группы бюджета назвать в примере, остальные — «ещё N статей». */
const ITEMS_SHOWN = 4;

type Series = Record<string, Decimal[]>;
const val = <T>(m: ProjectModel, id: FormulaId): T | undefined => m.result.formulas[id]?.value as T | undefined;
const nums = (xs: Decimal[] | undefined): number[] | null => xs?.map((x) => x.toNumber()) ?? null;
const add = (rows: (number[] | null)[], n: number): number[] => Array.from({ length: n }, (_, t) => rows.reduce((a, r) => a + (r?.[t] ?? 0), 0));
const neg = (xs: number[] | null): number[] | null => xs?.map((x) => (x ? -x : 0)) ?? null;
const total = (xs: number[] | null): number => (xs ?? []).reduce((a, b) => a + b, 0);
const how = (id: FormulaId): string => getFormula(id).plain?.how ?? getFormula(id).name;

/** Деньги в тексте пояснения: от миллиарда — «22,2 млрд руб», меньше — «825,1 млн руб». */
export function money(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "−" : "";
  return abs >= BLN ? `${sign}${ru(abs / BLN, 1)} млрд руб` : `${sign}${ru(abs / MLN, 1)} млн руб`;
}
const ru = (v: number, digits: number) => new Intl.NumberFormat("ru-RU", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
const int = (v: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(v);

/** «с марта 2026 по июнь 2031» — первый и последний месяц, где в ряду есть деньги. */
function span(xs: number[] | null, dates: string[]): string | null {
  if (!xs) return null;
  const first = xs.findIndex((x) => x !== 0);
  if (first < 0) return null;
  const last = xs.length - 1 - [...xs].reverse().findIndex((x) => x !== 0);
  return first === last ? `в ${monthName(dates[first], "prep")}` : `с ${monthName(dates[first], "gen")} по ${monthName(dates[last])}`;
}

/** Поля вводных, от которых зависит показатель: ссылки в шаги. */
function fieldLinks(project: DemoProject, model: ProjectModel, id: FormulaId): FieldLink[] {
  return inputFields(id, model)
    .map((p): FieldLink | null => {
      const at = placeOfParam(project, p);
      return at ? { label: fieldLabel(p), step: at.step, tab: at.tab, field: p } : null;
    })
    .filter((x): x is FieldLink => x !== null);
}

/** Строки продуктов проекта: ключ ряда в результатах ядра — название строки, иначе продукт. */
function products(project: DemoProject): { key: string; pieces: boolean }[] {
  const rows = (project.input.values["SALES.PRODUCTS"] as { name?: string | null; product?: string }[] | undefined) ?? [];
  return rows.map((r) => ({ key: (r.name ?? "").trim() || (r.product ?? ""), pieces: r.product === "машино-места" || r.product === "кладовые" }));
}

/** Сумма по очередям: матрица [очередь][месяц]. */
const byPhases = (m: Decimal[][] | undefined, n: number): number[] | null => (m ? add(m.map(nums), n) : null);

export function sheetTitle(id: SheetId): string {
  return { sales: "План продаж", budget: "Бюджет", escrow: "Эскроу", cf: "Денежный поток" }[id];
}

export function buildSheet(id: SheetId, project: DemoProject, model: ProjectModel): CalcSheet {
  const dates = val<string[]>(model, "F.TIME.DATE") ?? [];
  const n = dates.length;
  const links = (f: FormulaId) => fieldLinks(project, model, f);

  // Продажи
  const value = val<Series>(model, "F.SALES.CONTRACT_VALUE");
  const sold = val<Series>(model, "F.SALES.SOLD_AREA");
  const wavg = val<Record<string, Decimal | null>>(model, "F.SALES.WAVG_PRICE");
  const cash = val<{ total: Series; ddu: Series }>(model, "F.SALES.CASH_IN");
  const cashTotal = cash ? add(Object.values(cash.total).map(nums), n) : null;
  const cashDdu = cash ? add(Object.values(cash.ddu).map(nums), n) : null;
  const afterRnv = cashTotal && cashDdu ? cashTotal.map((x, t) => x - (cashDdu[t] ?? 0)) : null;

  // Бюджет
  const itemCash = val<Partial<Series>>(model, "F.CAPEX.ITEM_CASH");
  const budget = COST_TABS.map((tab, k) => {
    const items = spec.capexItems.filter((c) => tab.groups.includes(c.group));
    const series = itemCash ? add(items.map((c) => nums(itemCash[c.item_id])), n) : null;
    const parts = itemCash
      ? items.map((c) => ({ name: c.name, sum: total(nums(itemCash[c.item_id])) })).filter((x) => Math.abs(x.sum) >= 1).sort((a, b) => b.sum - a.sum)
      : [];
    return { title: tab.title, k, series, parts };
  });
  const costs = itemCash ? add(budget.map((b) => b.series), n) : null;

  // Эскроу
  const deposit = val<Decimal[][]>(model, "F.ESC.DEPOSIT");
  const esc = val<{ balance: Decimal[][]; release: Decimal[][] }>(model, "F.ESC.BALANCE");
  const release = byPhases(esc?.release, n);

  if (id === "sales") {
    const rows: SheetRow[] = products(project).map(({ key, pieces }) => {
      const s = nums(value?.[key]);
      const q = total(nums(sold?.[key]));
      const p = wavg?.[key]?.toNumber() ?? null;
      const u = pieces ? "шт" : "м²";
      return {
        label: key,
        series: s,
        how: how("F.SALES.CONTRACT_VALUE"),
        example: s && p ? `${int(q)} ${u} × средняя цена ${int(p)} руб/${pieces ? "шт" : "м²"} = ${money(total(s))}.` : null,
        links: links("F.SALES.CONTRACT_VALUE"),
        formula: "F.SALES.CONTRACT_VALUE",
      };
    });
    const revenue = value ? add(rows.map((r) => r.series), n) : null;
    rows.push({
      label: "Выручка",
      series: revenue,
      total: true,
      how: "Сумма договоров по всем продуктам за период, с НДС.",
      example: revenue ? `${rows.map((r) => ru(total(r.series) / BLN, 1)).join(" + ")} = ${money(total(revenue))}.` : null,
      links: links("F.SALES.REVENUE_TOTAL"),
      formula: "F.SALES.REVENUE_TOTAL",
    });
    rows.push({
      label: "Поступления от покупателей",
      series: cashTotal,
      how: how("F.SALES.CASH_IN"),
      example: cashTotal && cashDdu ? `Поступило ${money(total(cashTotal))}, из них по ДДУ на эскроу ${money(total(cashDdu))}.` : null,
      links: links("F.SALES.CASH_IN"),
      formula: "F.SALES.CASH_IN",
    });
    return { id, title: sheetTitle(id), hint: "Договоры по продуктам и деньги покупателей, с НДС.", ready: Boolean(value), dates, rows };
  }

  if (id === "budget") {
    const rows: SheetRow[] = budget.map((b) => {
      const shown = b.parts.slice(0, ITEMS_SHOWN);
      const rest = b.parts.slice(ITEMS_SHOWN);
      const terms = [...shown.map((x) => `${x.name} ${ru(x.sum / MLN, 1)}`), ...(rest.length ? [`ещё ${rest.length} ${rest.length === 1 ? "статья" : rest.length < 5 ? "статьи" : "статей"} ${ru(total(rest.map((x) => x.sum)) / MLN, 1)}`] : [])];
      return {
        label: b.title,
        series: b.series,
        how: how("F.CAPEX.ITEM_CASH"),
        example: b.series ? (terms.length ? `${terms.join(" + ")} = ${ru(total(b.series) / MLN, 1)} млн руб.` : "Статей с суммой нет.") : null,
        links: [{ label: `Затраты: ${b.title}`, step: "costs", tab: b.k }],
        formula: "F.CAPEX.ITEM_CASH",
      };
    });
    const effect = val<Decimal>(model, "F.CAPEX.INDEX_EFFECT")?.toNumber() ?? 0;
    rows.push({
      label: "Итого затраты",
      series: costs,
      total: true,
      how: how("F.CAPEX.TOTAL"),
      example: costs
        ? `${budget.map((b) => ru(total(b.series) / BLN, 1)).join(" + ")} = ${money(total(costs))}${effect ? `, в том числе рост цен ${money(effect)}` : ""}.`
        : null,
      links: [],
      formula: "F.CAPEX.TOTAL",
    });
    return { id, title: sheetTitle(id), hint: "Платежи по группам затрат, с НДС и ростом цен.", ready: Boolean(itemCash), dates, rows };
  }

  if (id === "escrow") {
    const inflow = byPhases(deposit, n);
    const balance = byPhases(esc?.balance, n);
    const perPhase = (m: Decimal[][] | undefined, fn: (xs: number[], p: number) => string | null) =>
      (m ?? []).map((r, p) => fn(nums(r) ?? [], p)).filter((x): x is string => x !== null).join("; ");
    const phasesWith = (m: Decimal[][] | undefined) => (m ?? []).filter((r) => r.some((x) => !x.isZero())).length;
    const peak = balance ? balance.reduce((best, x, t) => (x > (balance[best] ?? 0) ? t : best), 0) : 0;
    const revenue = value ? total(add(Object.values(value).map(nums), n)) : null;
    const rows: SheetRow[] = [
      {
        label: "Поступило на эскроу",
        series: inflow,
        how: how("F.ESC.DEPOSIT"),
        example: inflow
          ? `${perPhase(deposit, (xs, p) => (total(xs) ? `Очередь ${p + 1} — ${money(total(xs))}` : null))}${phasesWith(deposit) > 1 ? `, всего ${money(total(inflow))}` : ""}${revenue ? ` из выручки ${money(revenue)}` : ""}.`
          : null,
        links: links("F.ESC.DEPOSIT"),
        formula: "F.ESC.DEPOSIT",
      },
      {
        label: "Раскрыто",
        series: release,
        how: "Остаток на эскроу по очереди переходит застройщику целиком в месяц раскрытия.",
        example: release
          ? `${perPhase(esc?.release, (xs, p) => {
              const t = xs.findIndex((x) => x !== 0);
              return t < 0 ? null : `Очередь ${p + 1} — ${money(total(xs))} в ${monthName(dates[t], "prep")}`;
            })}.`
          : null,
        links: links("F.ESC.BALANCE"),
        formula: "F.ESC.BALANCE",
      },
      {
        label: "Остаток на конец периода",
        series: balance,
        stock: true,
        how: how("F.ESC.BALANCE"),
        example: balance && balance[peak] ? `Наибольший остаток — ${money(balance[peak]!)} на конец ${monthName(dates[peak], "gen")}.` : null,
        links: [],
        formula: "F.ESC.BALANCE",
      },
      {
        label: "Продано после ввода",
        series: afterRnv,
        how: "Договоры после разрешения на ввод — купли-продажи: деньги идут застройщику сразу, без эскроу.",
        example: afterRnv ? (total(afterRnv) ? `${money(total(afterRnv))} ${span(afterRnv, dates) ?? ""}.` : "Продаж после ввода нет.") : null,
        links: links("F.SALES.CASH_IN"),
        formula: "F.SALES.CASH_IN",
      },
    ];
    return { id, title: sheetTitle(id), hint: "Деньги покупателей на эскроу, раскрытие и остаток.", ready: Boolean(esc && deposit), dates, rows };
  }

  // Денежный поток
  const equity = val<{ total: Decimal[] }>(model, "F.FIN.EQUITY_IN");
  const draw = nums(val<Decimal[]>(model, "F.FIN.DRAW"));
  const rep = val<{ interest_paid: Decimal[]; principal: Decimal[] }>(model, "F.FIN.REPAYMENT");
  const interest = nums(val<Decimal[]>(model, "F.FIN.INTEREST"));
  const fees = nums(val<Decimal[]>(model, "F.FIN.FEES"));
  const limit = val<Decimal>(model, "F.FIN.LIMIT")?.toNumber() ?? null;
  const later = (f: FormulaId, label: string, extra: Partial<SheetRow> = {}): SheetRow => ({
    label,
    series: nums(val<Decimal[]>(model, f)),
    how: how(f),
    example: null,
    links: links(f),
    formula: f,
    ...extra,
  });
  const flow = (series: number[] | null, text: (s: number[]) => string) => (series ? (total(series) ? text(series) : "За расчёт — ноль.") : null);
  const rows: SheetRow[] = [
    {
      label: "Раскрытие эскроу",
      series: release,
      how: "Из листа «Эскроу»: остаток по очереди, перешедший застройщику.",
      example: flow(release, (s) => `${money(total(s))} ${span(s, dates) ?? ""}.`),
      links: links("F.ESC.BALANCE"),
      formula: "F.ESC.BALANCE",
    },
    {
      label: "Продажи после ввода",
      series: afterRnv,
      how: "Из листа «Эскроу»: договоры купли-продажи после ввода, деньги сразу застройщику.",
      example: flow(afterRnv, (s) => `${money(total(s))} ${span(s, dates) ?? ""}.`),
      links: links("F.SALES.CASH_IN"),
      formula: "F.SALES.CASH_IN",
    },
    {
      label: "Затраты",
      series: neg(costs),
      how: "Из листа «Бюджет»: платежи по всем статьям, с НДС и ростом цен.",
      example: flow(costs, (s) => `${money(total(s))} ${span(s, dates) ?? ""}.`),
      links: [],
      formula: "F.CAPEX.TOTAL",
    },
    later("F.TAX.PAYMENTS", "Налоги"),
    later("F.CF.CFADS", "Поток проекта до кредита", { total: true }),
    {
      label: "Собственные средства",
      series: nums(equity?.total),
      how: how("F.FIN.EQUITY_IN"),
      example: flow(nums(equity?.total), (s) => `${money(total(s))} ${span(s, dates) ?? ""}.`),
      links: links("F.FIN.EQUITY_IN"),
      formula: "F.FIN.EQUITY_IN",
    },
    {
      label: "Выдача кредита",
      series: draw,
      how: how("F.FIN.DRAW"),
      example: flow(draw, (s) => `${money(total(s))} ${span(s, dates) ?? ""}${limit ? ` при лимите ${money(limit)}` : ""}.`),
      links: links("F.FIN.DRAW"),
      formula: "F.FIN.DRAW",
    },
    {
      label: "Погашение кредита",
      series: neg(nums(rep?.principal)),
      how: how("F.FIN.REPAYMENT"),
      example: flow(nums(rep?.principal), (s) => `${money(total(s))} ${span(s, dates) ?? ""}.`),
      links: links("F.FIN.REPAYMENT"),
      formula: "F.FIN.REPAYMENT",
    },
    {
      label: "Проценты",
      series: neg(nums(rep?.interest_paid)),
      how: how("F.FIN.INTEREST"),
      example: flow(nums(rep?.interest_paid), (s) => `Начислено ${money(total(interest))}, оплачено ${money(total(s))}.`),
      links: links("F.FIN.RATE"),
      formula: "F.FIN.INTEREST",
    },
    {
      label: "Комиссии банка",
      series: neg(fees),
      how: how("F.FIN.FEES"),
      example: flow(fees, (s) => `${money(total(s))}${limit ? ` при лимите ${money(limit)}` : ""}.`),
      links: links("F.FIN.FEES"),
      formula: "F.FIN.FEES",
    },
    later("F.CF.FCFE", "Поток акционера", { total: true }),
    later("F.CF.CASH_BALANCE", "Остаток денег", { stock: true, total: true }),
  ];
  return { id, title: sheetTitle(id), hint: "Все деньги проекта: продажи, затраты, кредит, налоги.", ready: Boolean(cash && esc && itemCash), dates, rows };
}

// ---------------------------------------------------------------- Периоды

const MON = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

/** Подпись столбца: «2026», «1 кв 2026», «янв 2026». */
export function periodLabel(key: string, period: Period): string {
  if (period !== "month") return key;
  const [m, y] = key.split(".");
  return `${MON[Number(m) - 1]} ${y}`;
}

/** Масштаб таблицы: год и квартал — млрд руб, месяц — млн руб (задание, 3.4). */
export const SCALE: Record<Period, { unit: string; div: number; digits: number }> = {
  year: { unit: "млрд руб", div: BLN, digits: 1 },
  quarter: { unit: "млрд руб", div: BLN, digits: 2 },
  month: { unit: "млн руб", div: MLN, digits: 0 },
};

/** Число в ячейке листа: ноль (после округления) — «—», минус — «−». */
export function cell(v: number, period: Period): string {
  const { div, digits } = SCALE[period];
  const text = ru(Math.abs(v) / div, digits);
  if (Number(text.replace(/\s/g, "").replace(",", ".")) === 0) return "—";
  return v < 0 ? `−${text}` : text;
}

/** Строка листа по периодам: столбцы, значения, итог (у остатков итога нет). */
export function rowByPeriod(row: SheetRow, dates: string[], period: Period): { keys: string[]; values: number[]; total: number | null } {
  const { keys, sums } = aggregate(row.series ?? new Array(dates.length).fill(0), dates, period, row.stock ? "last" : "sum");
  return { keys, values: sums, total: row.stock ? null : total(row.series) };
}
