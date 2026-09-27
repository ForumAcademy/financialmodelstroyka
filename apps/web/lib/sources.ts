/** Цикл актуализации справочника — ежеквартально (docs/01, «Актуализация справочника»): проверка старше квартала — устарела. */
export const REVIEW_PERIOD_MONTHS = 3;

/** Источник устарел, если с даты проверки (accessed) прошло больше REVIEW_PERIOD_MONTHS месяцев. */
export function isStale(accessed: string, today: Date = new Date()): boolean {
  const limit = new Date(accessed);
  limit.setMonth(limit.getMonth() + REVIEW_PERIOD_MONTHS);
  return limit < today;
}
