/** Простые операции с датами «ГГГГ-ММ-ДД» для интерфейса (UTC). */
const DAY = 86_400_000;

export const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
export const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (iso: string, days: number) => fromMs(toMs(iso) + days * DAY);
export const diffDays = (a: string, b: string) => Math.round((toMs(b) - toMs(a)) / DAY);
export const today = () => new Date().toISOString().slice(0, 10);

export function addMonths(iso: string, months: number, day: "first" | "last" = "first"): string {
  const d = new Date(toMs(iso));
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + months;
  return fromMs(day === "first" ? Date.UTC(y, m, 1) : Date.UTC(y, m + 1, 0));
}

export const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
export const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
