/**
 * Пункты вкладки «Расхождения» проекта из исходного Excel: пункты аудита файла (lib/legacy-audit.ts) с вопросами,
 * которые находит расчёт «как в исходном Excel» (dataQuestions), и статусы проекта по постоянному ключу пункта.
 * Вопрос расчёта, которого нет ни в одном пункте аудита, становится отдельным пунктом группы «Искажают результат».
 * Пункт, у которого есть статус, но которого больше нет в списке, остаётся с пометкой «не воспроизводится».
 * Стандартные значения компании сюда не входят: они подтверждаются на полях (lib/standard.ts).
 */
import { FORMULAS, type DataQuestion } from "@fm/engine";
import { auditItems, type AuditGroup } from "./legacy-audit";
import type { InputTab } from "./tab-inputs";
import type { DemoProject, IssueState, IssueStatus } from "./types";

/** Группы вкладки: «уточнить у автора» — открытые вопросы, в число нерешённых не входят. */
export const GROUPS: { id: AuditGroup; title: string }[] = [
  { id: "distorts", title: "Искажают результат" },
  { id: "method", title: "Методика" },
  { id: "author", title: "Уточнить у автора файла" },
];

/** Подгруппы внутри группы — по вкладке, где видно место. */
export const TAB_TITLE: Record<InputTab, string> = { tep: "ТЭП", budget: "Бюджет", sales: "План продаж", escrow: "Эскроу", cf: "CF", dashboard: "Дашборд" };

export interface IssueItem {
  key: string;
  /** Порядок сортировки. */
  no: number;
  /** Номер на экране: «1», «М1», «В1». */
  label: string;
  group: AuditGroup;
  tab: InputTab;
  where: string;
  title: string;
  effect: string;
  fix: string;
  /** Вопрос автору файла самого пункта. */
  question: string | null;
  /** Вопросы расчёта «как в исходном Excel», относящиеся к пункту. */
  questions: DataQuestion[];
  /** Исправлено в «Расчёте сервиса»: формулы, которые заменяют место файла, реализованы в ядре (статус из кода). */
  fixed: boolean;
  status: IssueStatus;
  state: IssueState | null;
  /** Пункта больше нет в списке: он есть только в статусах проекта. */
  stale: boolean;
}

const GROUP_OFFSET: Record<AuditGroup, number> = { distorts: 0, method: 100, author: 200 };
const BLOCK_TAB: Record<DataQuestion["block"], InputTab> = { sales: "sales", budget: "budget", cf: "cf", escrow: "escrow", fin: "cf" };
/** Ключи статусов подтверждения стандартных значений компании — не пункты расхождений. */
const STANDARD_PREFIX = "STANDARD:";

/** Все формулы, которые заменяют место файла, реализованы в ядре. */
export const fixedInCode = (formulas: readonly string[]): boolean => formulas.every((f) => f in FORMULAS);

export function issueItems(project: DemoProject, questions: DataQuestion[]): IssueItem[] {
  if (!project.legacyCase) return [];
  const states = project.issues ?? {};
  const excel = questions.filter((q) => !q.parameterId);
  const audit = auditItems(project.legacyCase.case_id);
  const linked = new Set(audit.flatMap((a) => a.keys));
  const item = (key: string, rest: Omit<IssueItem, "key" | "status" | "state" | "stale">): IssueItem => {
    const state = states[key] ?? null;
    return { key, ...rest, status: state?.status ?? "open", state, stale: false };
  };
  const fromAudit = audit.map((a, k) =>
    item(a.id, {
      no: GROUP_OFFSET[a.group] + k + 1,
      label: a.label,
      group: a.group,
      tab: a.tab,
      where: a.where,
      title: a.title,
      effect: a.effect,
      fix: a.fix,
      question: a.question ?? null,
      questions: a.keys.flatMap((key) => excel.filter((q) => q.key === key)),
      fixed: fixedInCode(a.formulas),
    }),
  );
  const extra = excel
    .filter((q) => !linked.has(q.key))
    .map((q) =>
      item(q.key, { no: GROUP_OFFSET.distorts + audit.length + q.no, label: String(q.no), group: "distorts", tab: BLOCK_TAB[q.block], where: "", title: q.question, effect: "", fix: q.recommendation, question: null, questions: [q], fixed: fixedInCode([q.formulaId]) }),
    );
  const live = new Set([...fromAudit, ...extra].map((i) => i.key));
  const stale = Object.entries(states)
    .filter(([key]) => !live.has(key) && !key.startsWith(STANDARD_PREFIX))
    .map(([key, state]): IssueItem => ({ key, no: 1000 + state.no, label: "—", group: "distorts", tab: "cf", where: "", title: state.question, effect: "", fix: "", question: null, questions: [], fixed: true, status: state.status, state, stale: true }));
  return [...fromAudit, ...extra, ...stale];
}

/** Модуль влияния для сортировки: наибольшее из вопросов пункта; пункты без оценки — в конце. */
export function impactSize(i: IssueItem): number {
  const xs = i.questions.map((q) => q.impact.amount).filter((a) => a !== null);
  return xs.length ? Math.max(...xs.map((a) => Math.abs(a.toNumber()))) : -1;
}

export interface IssueSummary {
  /** Вкладка «Расхождения» есть только у проекта из исходного Excel. */
  shown: boolean;
  /** Нерешённые пункты групп «Искажают результат» и «Методика». */
  open: number;
  /** Все пункты этих групп. */
  total: number;
  /** Открытые вопросы автору файла — в число нерешённых не входят. */
  questions: number;
  /** Нерешённые по группам. */
  byGroup: Record<AuditGroup, number>;
  /** Ошибок в исходном файле (группы «Искажают результат» и «Методика»): показывается в «Как в исходном Excel». */
  inFile: number;
  /** Не исправлено в «Расчёте сервиса» по коду (без пунктов со статусом «Решено»): показывается в «Расчёте сервиса». */
  notFixed: number;
}

/** Один подсчёт для счётчика вкладки «Расхождения» и плашки над вкладками — одинаковый в обоих расчётах. */
export function issueSummary(project: DemoProject, questions: DataQuestion[]): IssueSummary {
  const items = issueItems(project, questions).filter((i) => !i.stale);
  const open = (g: AuditGroup) => items.filter((i) => i.group === g && i.status !== "done").length;
  const counted = items.filter((i) => i.group !== "author");
  return {
    shown: Boolean(project.legacyCase),
    open: open("distorts") + open("method"),
    total: counted.length,
    questions: open("author"),
    byGroup: { distorts: open("distorts"), method: open("method"), author: open("author") },
    inFile: counted.length,
    notFixed: counted.filter((i) => !i.fixed && i.status !== "done").length,
  };
}

/** Счётчик на вкладке: на экране — только число с цветом, подробности — в подсказке. */
export interface TabCount {
  n: number;
  /** need — не заполнено обязательное; standard — только не подтверждён стандарт; issues — расхождения; ok — всё решено. */
  tone: "need" | "standard" | "issues" | "ok";
  title: string;
}

/**
 * Вкладка «Расхождения»: в «Как в исходном Excel» — ошибок в файле («Расхождения 34», подсказка «В файле: 34»),
 * в «Расчёте сервиса» — сколько не исправлено («Расхождения 7») или ✓.
 */
export function issuesTabCount(project: DemoProject, s: IssueSummary): TabCount {
  const asked = s.questions ? `. Вопросов автору файла: ${s.questions}` : "";
  if (project.input.mode === "legacy") return { n: s.inFile, tone: "issues", title: `В файле: ${s.inFile}${asked}` };
  return s.notFixed
    ? { n: s.notFixed, tone: "issues", title: `Не исправлено: ${s.notFixed}. В файле: ${s.inFile}${asked}` }
    : { n: 0, tone: "ok", title: `Всё исправлено. В файле: ${s.inFile}${asked}` };
}

/** Плашка над вкладками — только в «Расчёте сервиса» и только если есть неисправленное; в «Как в исходном Excel» — метка у переключателя. */
export function issuesBannerText(project: DemoProject, s: IssueSummary): string | null {
  if (!s.shown || s.notFixed === 0 || project.input.mode === "legacy") return null;
  return `Не исправлено: ${s.notFixed}.`;
}

/** Вкладка с вводными: «ТЭП 7» — незаполненные и неподтверждённые вместе; null — счётчика нет. */
export function inputTabCount(missing: number, unconfirmed = 0): TabCount | null {
  const n = missing + unconfirmed;
  if (!n) return null;
  const title = [missing ? `Не заполнено: ${missing}` : "", unconfirmed ? `Стандарт не подтверждён: ${unconfirmed}` : ""].filter(Boolean).join(". ");
  return { n, tone: missing ? "need" : "standard", title };
}
