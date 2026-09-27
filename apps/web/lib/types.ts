import type { ProjectInput } from "@fm/engine";
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
  specVersion: string;
  updatedAt: string;
  /** Примечание к данным (например, допущения при переносе вех исходника). */
  note?: string;
}

export interface Seed {
  projects: DemoProject[];
}
