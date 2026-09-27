/** Цикл актуализации справочника — ежеквартально (docs/01, «Актуализация справочника»): проверка старше квартала — устарела. */
export const REVIEW_PERIOD_MONTHS = 3;

/** Источник устарел, если с даты проверки (accessed) прошло больше REVIEW_PERIOD_MONTHS месяцев. */
export function isStale(accessed: string, today: Date = new Date()): boolean {
  const limit = new Date(accessed);
  limit.setMonth(limit.getMonth() + REVIEW_PERIOD_MONTHS);
  return limit < today;
}

/** Отметка «проверено», поставленная пользователем в разделе «Источники» (кто, когда, комментарий). */
export interface SourceCheck {
  by: string;
  date: string;
  comment?: string | undefined;
}

export type SourceIssue = "unverified" | "stale" | null;

/** Текущий статус общего источника с учётом отметки пользователя: она делает источник сверенным и обновляет дату проверки. */
export function sourceStatus(
  s: { verified: boolean | null | undefined; accessed: string | null | undefined },
  check: SourceCheck | undefined,
  today: Date = new Date(),
): { verified: boolean; accessed: string | null; issue: SourceIssue } {
  const verified = check ? true : s.verified !== false;
  const accessed = check ? check.date : (s.accessed ?? null);
  const issue: SourceIssue = !verified ? "unverified" : accessed && isStale(accessed, today) ? "stale" : null;
  return { verified, accessed, issue };
}
