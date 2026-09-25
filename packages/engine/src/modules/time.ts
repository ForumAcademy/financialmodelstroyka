/**
 * TIME — временная шкала и флаги периодов (data/formulas.yaml, модуль TIME).
 * Шаг — месяц; date[t] — последний день месяца t.
 */
import type { FormulaContext } from "../context";
import { CalcError } from "../context";
import { dayOfMonth, daysBetween, eomonth, isIsoDate, monthDiff, type IsoDate } from "../lib/dates";

/** Строка TIME.MILESTONES: вехи одной очереди (столбцы — parameters.yaml). */
export interface MilestoneRow {
  phase: number;
  land_acquired?: IsoDate | null;
  design_start?: IsoDate | null;
  expertise_done?: IsoDate | null;
  rns_date?: IsoDate | null;
  construction_start?: IsoDate | null;
  construction_end?: IsoDate | null;
  rnv_date?: IsoDate | null;
  handover_end?: IsoDate | null;
  sales_start?: IsoDate | null;
}
export type MilestoneKey = Exclude<keyof MilestoneRow, "phase">;

const MILESTONE_NAMES: Record<MilestoneKey, string> = {
  land_acquired: "приобретение участка",
  design_start: "начало проектирования",
  expertise_done: "заключение экспертизы",
  rns_date: "РНС",
  construction_start: "начало строительства",
  construction_end: "окончание строительства",
  rnv_date: "РНВ",
  handover_end: "окончание передачи по актам",
  sales_start: "старт продаж",
};

/** Вехи по очередям в порядке номера очереди. */
export function milestones(ctx: FormulaContext): MilestoneRow[] {
  const rows = ctx.require<MilestoneRow[]>("TIME.MILESTONES");
  if (!Array.isArray(rows) || rows.length === 0) throw new CalcError("Заполните вехи хотя бы одной очереди", "TIME.MILESTONES");
  return [...rows].sort((a, b) => a.phase - b.phase);
}

/** Дата вехи очереди; пустая или не-дата — ошибка с указанием очереди и вехи. */
export function milestone(row: MilestoneRow, key: MilestoneKey): IsoDate {
  const v = row[key];
  if (!isIsoDate(v)) {
    throw new CalcError(`Очередь ${row.phase}: заполните веху «${MILESTONE_NAMES[key]}» датой (ГГГГ-ММ-ДД)`, "TIME.MILESTONES");
  }
  return v;
}

export function F_TIME_DATE(ctx: FormulaContext): IsoDate[] {
  const start = ctx.require<IsoDate>("GEN.MODEL_START_DATE");
  if (!isIsoDate(start)) throw new CalcError("Дата начала модели должна быть датой (ГГГГ-ММ-ДД)", "GEN.MODEL_START_DATE");
  const horizon = ctx.horizonMonths;
  if (horizon === null) throw new CalcError("Не задан горизонт модели (число месяцев)");
  return Array.from({ length: horizon }, (_, t) => eomonth(start, t));
}

export function F_TIME_DAYS(ctx: FormulaContext): number[] {
  const date = ctx.formula<IsoDate[]>("F.TIME.DATE");
  return date.map((d, t) => (t === 0 ? dayOfMonth(d) : daysBetween(date[t - 1] as IsoDate, d)));
}

function flags(ctx: FormulaContext, test: (row: MilestoneRow, date: IsoDate, t: number) => boolean): number[][] {
  const rows = milestones(ctx);
  const date = ctx.formula<IsoDate[]>("F.TIME.DATE");
  return rows.map((row) => date.map((d, t) => (test(row, d, t) ? 1 : 0)));
}

export function F_TIME_FLAG_CONSTRUCTION(ctx: FormulaContext): number[][] {
  return flags(ctx, (row, d) => milestone(row, "construction_start") <= d && d < milestone(row, "construction_end"));
}

export function F_TIME_FLAG_PRESALE(ctx: FormulaContext): number[][] {
  return flags(ctx, (row, d) => milestone(row, "sales_start") <= d && d < milestone(row, "rnv_date"));
}

export function F_TIME_FLAG_POST_RNV(ctx: FormulaContext): number[][] {
  return flags(ctx, (row, d) => d >= milestone(row, "rnv_date"));
}

export function F_TIME_FLAG_ESCROW_RELEASE(ctx: FormulaContext): number[][] {
  const lag = ctx.requireNum("TIME.ESCROW_RELEASE_LAG_M").toNumber();
  const date = ctx.formula<IsoDate[]>("F.TIME.DATE");
  const start = date[0];
  const rows = milestones(ctx);
  if (start === undefined) return rows.map(() => []);
  return rows.map((row) => {
    const releaseT = monthDiff(start, milestone(row, "rnv_date")) + lag;
    return date.map((_, t) => (t === releaseT ? 1 : 0));
  });
}

export const TIME_FORMULAS = {
  "F.TIME.DATE": F_TIME_DATE,
  "F.TIME.DAYS": F_TIME_DAYS,
  "F.TIME.FLAG_CONSTRUCTION": F_TIME_FLAG_CONSTRUCTION,
  "F.TIME.FLAG_PRESALE": F_TIME_FLAG_PRESALE,
  "F.TIME.FLAG_POST_RNV": F_TIME_FLAG_POST_RNV,
  "F.TIME.FLAG_ESCROW_RELEASE": F_TIME_FLAG_ESCROW_RELEASE,
} as const;
