/**
 * Пункты «Расхождения с Excel»: вопросы к данным из ядра (dataQuestions) + статусы проекта по постоянному ключу.
 * Пункт, у которого есть статус, но расхождение после обновления исходника пропало, остаётся в списке с пометкой
 * «не воспроизводится»; статус не меняется.
 */
import type { DataQuestion, QuestionBlock } from "@fm/engine";
import type { DemoProject, IssueState, IssueStatus } from "./types";

export const BLOCKS: { id: QuestionBlock; title: string }[] = [
  { id: "sales", title: "Продажи" },
  { id: "budget", title: "Бюджет" },
  { id: "cf", title: "Денежный поток" },
  { id: "escrow", title: "Эскроу" },
  { id: "fin", title: "Финансирование" },
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

/** Счётчик вкладки: нерешённые из всех воспроизводящихся. */
export function issueCounts(project: DemoProject, questions: DataQuestion[]): { open: number; total: number } {
  const items = issueItems(project, questions).filter((i) => !i.stale);
  return { open: items.filter((i) => i.status !== "done").length, total: items.length };
}
