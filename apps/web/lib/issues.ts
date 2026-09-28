/**
 * Пункты «Расхождения с Excel»: вопросы к данным из ядра (dataQuestions) + статусы проекта по постоянному ключу.
 * Пункт, у которого есть статус, но расхождение после обновления исходника пропало, остаётся в списке с пометкой
 * «не воспроизводится»; статус не меняется.
 */
import type { DataQuestion, QuestionBlock, QuestionGroup } from "@fm/engine";
import { plural } from "./format";
import type { DemoProject, IssueState, IssueStatus } from "./types";

export const BLOCKS: { id: QuestionBlock; title: string }[] = [
  { id: "sales", title: "Продажи" },
  { id: "budget", title: "Бюджет" },
  { id: "cf", title: "Денежный поток" },
  { id: "escrow", title: "Эскроу" },
  { id: "fin", title: "Финансирование" },
];

/** Группы вкладки: «уточнить у автора» — открытые вопросы, в число нерешённых не входят. */
export const GROUPS: { id: QuestionGroup; title: string }[] = [
  { id: "distorts", title: "Искажают результат" },
  { id: "method", title: "Методика" },
  { id: "author", title: "Уточнить у автора файла" },
];

export interface IssueItem {
  key: string;
  no: number;
  q: DataQuestion | null;
  question: string;
  status: IssueStatus;
  state: IssueState | null;
  /** Расхождение пропало после обновления исходника: пункт есть только в статусах проекта. */
  stale: boolean;
}

export function issueItems(project: DemoProject, questions: DataQuestion[]): IssueItem[] {
  const states = project.issues ?? {};
  const live: IssueItem[] = questions.map((q) => {
    const state = states[q.key] ?? null;
    return { key: q.key, no: q.no, q, question: q.question, status: state?.status ?? "open", state, stale: false };
  });
  const stale: IssueItem[] = Object.entries(states)
    .filter(([key]) => !questions.some((q) => q.key === key))
    .map(([key, state]) => ({ key, no: state.no, q: null, question: state.question, status: state.status, state, stale: true }));
  return [...live, ...stale];
}

/** Модуль влияния для сортировки: пункты без оценки — в конце. */
export function impactSize(i: IssueItem): number {
  const a = i.q?.impact.amount;
  return a ? Math.abs(a.toNumber()) : -1;
}

export const groupOf = (i: IssueItem): QuestionGroup => i.q?.group ?? "distorts";

/**
 * Пункты вкладки в текущем расчёте: «как в исходном Excel» — только расхождения исходного файла; «расчёт сервиса» —
 * они же и стандартные значения компании, которые проект использует без подтверждения.
 */
export function scopeQuestions(project: DemoProject, questions: DataQuestion[]): DataQuestion[] {
  return project.input.mode === "legacy" ? questions.filter((q) => !q.parameterId) : questions;
}

export interface IssueSummary {
  /** Вкладка «Расхождения» есть только у проекта из исходного Excel. */
  shown: boolean;
  /** Нерешённые пункты (без вопросов автору файла). */
  open: number;
  /** Все пункты, кроме вопросов автору файла. */
  total: number;
  /** Открытые вопросы автору файла. */
  questions: number;
}

/** Один подсчёт для заголовка вкладки «Расхождения» и плашки над вкладками. */
export function issueSummary(project: DemoProject, questions: DataQuestion[]): IssueSummary {
  const items = issueItems(project, scopeQuestions(project, questions)).filter((i) => !i.stale);
  const counted = items.filter((i) => groupOf(i) !== "author");
  return {
    shown: Boolean(project.legacyCase),
    open: counted.filter((i) => i.status !== "done").length,
    total: counted.length,
    questions: items.filter((i) => groupOf(i) === "author" && i.status !== "done").length,
  };
}

/** Заголовок вкладки: «Расхождения · N не решено» или «Расхождения ✓». */
export const issuesTabLabel = (s: IssueSummary): string => (s.open ? `Расхождения · ${s.open} не решено` : "Расхождения ✓");

/** Текст плашки над вкладками; null — плашки нет (всё решено или вкладки нет). */
export function issuesBannerText(project: DemoProject, s: IssueSummary): string | null {
  if (!s.shown || s.open === 0) return null;
  return project.input.mode === "legacy"
    ? `Ошибки исходного файла сохранены намеренно: не исправлено ${s.open}. В режиме «Расчёт сервиса» они исправлены.`
    : `Не решено ${s.open} ${plural(s.open, ["расхождение", "расхождения", "расхождений"])}.`;
}

/** Заголовок вкладки с вводными: «ТЭП · 7 не заполнено». */
export const inputTabLabel = (label: string, missing: number): string => (missing ? `${label} · ${missing} не заполнено` : label);
