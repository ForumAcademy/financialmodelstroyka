import type { CalcMessage, LegacyCase, ProjectInput } from "@fm/engine";
import type { ParameterId } from "@fm/spec";

/** Источник проекта (docs/00, раздел 6): документ проекта (уровень 4) или экспертная оценка (уровень 5). */
export interface ProjectSource {
  id: string;
  level: 4 | 5;
  title: string;
  url: string;
  author: string;
  date: string;
  /** Для уровня 5 обязательны обоснование и диапазон. */
  rationale?: string;
  min?: string;
  max?: string;
  /** Загруженный файл (раздел «Документы»). До этапов 7–8 живёт в памяти браузера до перезагрузки страницы. */
  file?: ProjectFile;
}

/** Файл документа проекта: url — ссылка на файл в памяти браузера (URL.createObjectURL). */
export interface ProjectFile {
  name: string;
  size: number;
  type: string;
  url: string;
}

/** Изменение значения в проекте (решение владельца продукта 27.09.2026): комментарий «почему» обязателен. */
export interface ValueChange {
  /** Значение до первого изменения. */
  before: unknown;
  /** Было ли до изменения своё значение проекта; нет — значение шло из справочника или по умолчанию. */
  hadOwn: boolean;
  after: unknown;
  why: string;
  /** Необязательная ссылка на документ. */
  url?: string;
  author: string;
  /** Дата и время изменения, ISO. */
  at: string;
}

export type IssueStatus = "open" | "work" | "done";

export const ISSUE_STATUS_LABEL: Record<IssueStatus, string> = { open: "Не решено", work: "В работе", done: "Решено" };

/** Смена статуса пункта расхождений: кто, когда, необязательный комментарий. */
export interface IssueEvent {
  status: IssueStatus;
  comment?: string;
  author: string;
  at: string;
}

/** Ручное дополнение к автоматическому пояснению пункта: кто, когда, текст. Дополнения не редактируются, только добавляются. */
export interface IssueNote {
  text: string;
  author: string;
  at: string;
}

/** Состояние пункта: текущий статус, история и снимок вопроса (чтобы показать пункт, если он перестал воспроизводиться). */
export interface IssueState {
  status: IssueStatus;
  history: IssueEvent[];
  /** Ручные дополнения к пояснению, по порядку. */
  notes?: IssueNote[];
  no: number;
  question: string;
}

export interface DemoProject {
  id: string;
  name: string;
  archived: boolean;
  input: ProjectInput;
  /** Реестр источников проекта (в общий справочник не попадают). */
  sources: ProjectSource[];
  /** Какой источник проекта подтверждает значение параметра. */
  paramSources: Partial<Record<ParameterId, string>>;
  /** Изменённые в проекте значения: что было, что стало, кто, когда и почему. Справочник не меняется. */
  changes?: Partial<Record<ParameterId, ValueChange>>;
  specVersion: string;
  /**
   * Версия справочника допущений компании, на которой создан проект (или до которой обновлён по кнопке «Обновить»).
   * Её стандартные значения действуют там, где у проекта нет своих.
   */
  assumptionsVersion?: number;
  updatedAt: string;
  /** Расхождения внутри исходного Excel (legacyChecks): показываются в расчёте «как в исходном Excel» вместе с предупреждениями расчёта. */
  legacyWarnings?: CalcMessage[];
  /** Кейс исходного Excel (ячейки для вопросов к данным); только у проектов, созданных из исходника. */
  legacyCase?: LegacyCase;
  /** Статусы пунктов «Расхождения с Excel» по постоянному ключу — сохраняются при пересчёте. */
  issues?: Record<string, IssueState>;
  /** Примечание к данным (например, допущения при переносе вех исходника). */
  note?: string;
}

export interface Seed {
  projects: DemoProject[];
}
