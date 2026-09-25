/**
 * Даты модели — строки ISO «ГГГГ-ММ-ДД» (docs/00: «даты — только даты»). Вся арифметика — в UTC,
 * чтобы результат не зависел от часового пояса сервера.
 */
export type IsoDate = string;

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;
const MONTHS_PER_YEAR = 12;

function parts(date: IsoDate): [number, number, number] {
  const m = ISO.exec(date);
  if (!m) throw new Error(`Некорректная дата «${date}»: нужен формат ГГГГ-ММ-ДД`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function fromUtc(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isIsoDate(value: unknown): value is IsoDate {
  return typeof value === "string" && ISO.test(value);
}

/** EOMONTH Excel: последний день месяца, отстоящего от date на months месяцев. */
export function eomonth(date: IsoDate, months: number): IsoDate {
  const [y, m] = parts(date);
  return fromUtc(Date.UTC(y, m - 1 + months + 1, 0));
}

/** EDATE Excel: та же дата через months месяцев (с поправкой на длину месяца). */
export function edate(date: IsoDate, months: number): IsoDate {
  const [y, m, d] = parts(date);
  const last = Number(eomonth(fromUtc(Date.UTC(y, m - 1 + months, 1)), 0).slice(8, 10));
  return fromUtc(Date.UTC(y, m - 1 + months, Math.min(d, last)));
}

/** Число дней между датами (b − a). */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  const [ya, ma, da] = parts(a);
  const [yb, mb, db] = parts(b);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / MS_PER_DAY);
}

/** Номер дня в месяце. */
export function dayOfMonth(date: IsoDate): number {
  return parts(date)[2];
}

/** Разница в календарных месяцах между месяцами дат (b − a), без учёта дней. */
export function monthDiff(a: IsoDate, b: IsoDate): number {
  const [ya, ma] = parts(a);
  const [yb, mb] = parts(b);
  return (yb - ya) * MONTHS_PER_YEAR + (mb - ma);
}

export function minDate(dates: IsoDate[]): IsoDate {
  return dates.reduce((a, b) => (b < a ? b : a));
}

export function maxDate(dates: IsoDate[]): IsoDate {
  return dates.reduce((a, b) => (b > a ? b : a));
}
