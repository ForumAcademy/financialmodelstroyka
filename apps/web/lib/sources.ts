/** Цикл актуализации справочника — ежеквартально (docs/01, «Актуализация справочника»): проверка старше квартала — устарела. */
export const REVIEW_PERIOD_MONTHS = 3;

/** Источник устарел, если с даты проверки (accessed) прошло больше REVIEW_PERIOD_MONTHS месяцев. */
export function isStale(accessed: string, today: Date = new Date()): boolean {
  const limit = new Date(accessed);
  limit.setMonth(limit.getMonth() + REVIEW_PERIOD_MONTHS);
  return limit < today;
}

/** Статус, выставленный пользователем в разделе «Источники»: «Сверен» / «Не сверен» и дата выбора. */
export interface SourceCheck {
  verified: boolean;
  date: string;
}

export type SourceIssue = "unverified" | "stale" | null;

/**
 * Текущий статус общего источника с учётом выбора пользователя:
 * «Сверен» — источник сверенный, дата проверки = дата выбора; «Не сверен» — источник требует сверки.
 */
export function sourceStatus(
  s: { verified: boolean | null | undefined; accessed: string | null | undefined },
  check: SourceCheck | undefined,
  today: Date = new Date(),
): { verified: boolean; accessed: string | null; issue: SourceIssue } {
  const verified = check ? check.verified : s.verified !== false;
  const accessed = check?.verified ? check.date : (s.accessed ?? null);
  const issue: SourceIssue = !verified ? "unverified" : accessed && isStale(accessed, today) ? "stale" : null;
  return { verified, accessed, issue };
}
