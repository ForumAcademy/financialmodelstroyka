import type { ProjectInput } from "@fm/engine";
import type { ParameterId } from "@fm/spec";

export type ProjectStatus = "draft" | "in_progress" | "approved";

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  draft: "Черновик",
  in_progress: "В работе",
  approved: "Утверждён",
};

/** Проектный источник (docs/00, раздел 6): документ проекта или экспертная оценка. */
export interface ProjectSource {
  level: 4 | 5;
  title: string;
  url?: string;
  author: string;
  date: string;
  /** Для уровня 5 обязательны обоснование и диапазон. */
  rationale?: string;
  min?: string;
  max?: string;
}

export interface DemoProject {
  id: string;
  name: string;
  status: ProjectStatus;
  archived: boolean;
  input: ProjectInput;
  sources: Partial<Record<ParameterId, ProjectSource>>;
  /** Версия справочника, на которой посчитана текущая версия проекта. */
  specVersion: string;
  updatedAt: string;
  copiedFrom?: string;
  /** Примечание к данным (например, допущения при переносе вех исходника). */
  note?: string;
}

export interface Seed {
  projects: DemoProject[];
}
