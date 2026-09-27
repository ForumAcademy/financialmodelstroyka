/**
 * Вопросы к данным по стандартным значениям компании: значение из справочника допущений, которое проект использует
 * без своего, попадает в «Вопросы к данным», пока финансисты не подтвердят его для проекта (статус «Решено»).
 * Тексты — по шаблону на каждый тип значения (доля статьи бюджета, лаг эскроу, структура оплат, условия
 * финансирования) из чисел расчёта сервиса, а не вручную.
 */
import Decimal from "decimal.js";
import { fmtRub, type DataQuestion, type Impact, type ProjectInput, type QuestionBlock, type ResultSet } from "@fm/engine";
import { getParameter, spec, type CapexItemId, type FormulaId, type ParameterId } from "@fm/spec";
import { assumptionValueText, GROUP_TAB, isConfirmed, standardKey, versionOf, type AssumptionItem, type AssumptionVersion } from "./assumptions";
import type { DemoProject } from "./types";

/** Разница в 1 процентный пункт — шаг, в котором показано влияние доли. */
const ONE_PP = new Decimal(1).div(100);

/** Название значения для вопроса: название параметра без пояснений в скобках и после запятой. */
function label(param: ParameterId): string {
  return getParameter(param).name.replace(/\s*\([^)]*\)/g, "").split(",")[0]!.trim();
}

/** База статьи бюджета словами: «выручки», «стоимости СМР». */
const BASE_TEXT: Record<string, string> = { "F.SALES.REVENUE_TOTAL": "выручки", "F.CAPEX.SMR_TOTAL": "стоимости строительно-монтажных работ" };

const sumAll = (xs: Decimal[][] | undefined) => (xs ?? []).flat().reduce((s, x) => s.add(x), new Decimal(0));

interface Built {
  what: string;
  impact: Impact;
  formulaId: FormulaId;
}

/** Статья бюджета задана в проекте суммой («фикс») — ставка из справочника в ней не участвует. */
function fixedInProject(input: ProjectInput, itemId: CapexItemId): boolean {
  const rows = input.values["CAPEX.ITEMS"];
  return Array.isArray(rows) && rows.some((r) => (r as { item_id?: string; base?: string }).item_id === itemId && (r as { base?: string }).base === "фикс");
}

/** Стандартное значение не участвует в расчёте проекта: все статьи бюджета с этой ставкой заданы суммой. */
function unused(item: AssumptionItem, input: ProjectInput): boolean {
  const capex = spec.capexItems.filter((c) => c.rate_param === item.param);
  return capex.length > 0 && capex.every((c) => fixedInProject(input, c.item_id));
}

/**
 * Суммы для оценки влияния: из расчёта сервиса; если там они не посчитаны (не хватает вводных), а у проекта есть
 * расчёт «как в исходном Excel», — из него, с пометкой.
 */
function pick<T>(get: (r: ResultSet) => T | null, result: ResultSet, fallback: ResultSet | null): { v: T; note: string } | null {
  const main = get(result);
  if (main !== null) return { v: main, note: "" };
  const alt = fallback ? get(fallback) : null;
  return alt !== null ? { v: alt, note: "по расчёту «Как в исходном Excel»" } : null;
}

function build(item: AssumptionItem, result: ResultSet, fallback: ResultSet | null): Built {
  const param = item.param;
  const value = item.value;
  const valueText = assumptionValueText(param, value);
  const f = result.formulas;

  const capex = spec.capexItems.filter((c) => c.rate_param === param);
  if (capex.length && typeof value === "number") {
    const totals = (f["F.CAPEX.ITEM_TOTAL"]?.value ?? {}) as Partial<Record<CapexItemId, Decimal>>;
    const amount = capex.reduce<Decimal | null>((s, c) => (totals[c.item_id] ? (s ?? new Decimal(0)).add(totals[c.item_id] as Decimal) : s), null);
    const names = capex.map((c) => `«${c.name}»`).join(", ");
    const base = BASE_TEXT[capex[0]!.base] ?? "базы статьи";
    const per = amount && value ? amount.div(value).mul(ONE_PP) : null;
    return {
      what: `${label(param)} ${valueText} ${base}`,
      formulaId: "F.CAPEX.ITEM_TOTAL",
      impact: amount
        ? { amount, kind: "зависит", text: `от значения зависят расходы ${names}: ~${fmtRub(amount)} за проект${per ? `; разница в 1 п.п. меняет их на ~${fmtRub(per)}` : ""}` }
        : { amount: null, kind: "нет", text: `расходы ${names} пока не посчитаны: не хватает вводных проекта` },
    };
  }

  if (param === "TIME.ESCROW_RELEASE_LAG_M") {
    const got = pick((r) => {
      const x = sumAll((r.formulas["F.ESC.BALANCE"]?.value as { release?: Decimal[][] } | undefined)?.release);
      return x.isZero() ? null : x;
    }, result, fallback);
    return {
      what: `${label(param)} ${valueText}`,
      formulaId: "F.TIME.FLAG_ESCROW_RELEASE",
      impact: got
        ? { amount: got.v, kind: "сроки денег", text: `каждый месяц лага сдвигает раскрытие ~${fmtRub(got.v)} эскроу на месяц позже${got.note ? ` (${got.note})` : ""}; меняются проценты по кредиту` }
        : { amount: null, kind: "нет", text: "раскрытие эскроу пока не посчитано: не хватает вводных проекта" },
    };
  }

  if (param === "SALES.PAYMENT_MIX") {
    const got = pick((r) => (r.formulas["F.SALES.REVENUE_TOTAL"]?.value as { gross?: Decimal } | undefined)?.gross ?? null, result, fallback);
    const revenue = got?.v ?? null;
    const note = got?.note ? ` ${got.note}` : "";
    const rows = Array.isArray(value) ? (value as { installment_share?: number }[]) : [];
    const installment = rows.some((r) => (r.installment_share ?? 0) > 0);
    return {
      what: `${label(param)}: ${valueText}`,
      formulaId: "F.SALES.CASH_IN",
      impact: {
        amount: null,
        kind: "сроки денег",
        text: revenue
          ? installment
            ? `от значения зависит, когда поступают деньги покупателей, ~${fmtRub(revenue)}${note}: часть приходит по графику рассрочки`
            : `рассрочки нет: все деньги покупателей, ~${fmtRub(revenue)}${note}, приходят в месяц договора; с рассрочкой поступления сдвинутся на её срок`
          : "поступления от продаж пока не посчитаны: не хватает вводных проекта",
      },
    };
  }

  const used = spec.formulas.find((x) => (x.depends_on as string[]).includes(param));
  const computed = used && f[used.id as FormulaId] !== undefined;
  return {
    what: `${label(param)} ${valueText}`,
    formulaId: (used?.id ?? "F.CHECK.ALL") as FormulaId,
    impact: {
      amount: null,
      kind: "нет",
      text: computed ? "влияние в рублях не оценено" : item.group === "fin" ? "финансирование пока не считается (расчёт — этап 5): значение повлияет на проценты по кредиту и пиковую потребность в деньгах" : "значение пока не участвует в расчёте",
    },
  };
}

/**
 * Вопросы по стандартным значениям, которые проект использует без своего значения. Номер — offset + место значения
 * в справочнике (постоянный, не зависит от того, какие значения проект заменил). Блок — раздел справочника.
 * Значение, которое в расчёте проекта не участвует (статьи бюджета с этой ставкой заданы суммой), вопросом не становится.
 */
export function standardQuestions(project: DemoProject, input: ProjectInput, result: ResultSet, fallback: ResultSet | null, versions: AssumptionVersion[], offset: number): DataQuestion[] {
  const v = versionOf(versions, project.assumptionsVersion);
  if (!v) return [];
  const order = [...new Set(versions.flatMap((x) => x.items.map((i) => i.param)))];
  return v.items
    .filter((item) => item.value !== null && item.value !== undefined)
    .filter((item) => input.values[item.param] === undefined || input.values[item.param] === null)
    .filter((item) => !unused(item, input))
    .map((item) => {
      const b = build(item, result, fallback);
      const tab = GROUP_TAB[item.group];
      const status = item.status === "approved" ? "в справочнике оно утверждено" : "в справочнике оно ещё не проверено";
      const confirmed = isConfirmed(project, item.param) ? "Для этого проекта его подтвердили финансисты" : "Для этого проекта оно не подтверждено";
      const compared = `В проекте используется стандартное значение компании: ${b.what} (справочник допущений, версия ${v.version}). ${confirmed}, ${status}.`;
      const threat = `${b.impact.text[0]!.toUpperCase()}${b.impact.text.slice(1)}.`;
      const question = `${b.what} — подходит для этого проекта?`;
      return {
        key: standardKey(item.param),
        no: offset + order.indexOf(item.param) + 1,
        block: item.group as QuestionBlock,
        question,
        summary: [compared, threat, question].join(" "),
        compared,
        threat,
        explanation: `Откуда: ${item.from.text}.${item.note ? ` ${item.note}.` : ""}`,
        impact: b.impact,
        recommendation: `Если значение подходит — поставьте статус «Решено», оно будет отмечено «подтверждено финансистами». Если нет — введите своё значение на вкладке «${tab.label}» с комментарием, почему.`,
        formulaId: b.formulaId,
        parameterId: item.param,
        warning: compared,
      };
    });
}
