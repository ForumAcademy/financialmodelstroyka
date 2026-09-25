/**
 * @fm/spec — загрузка и проверка справочника data/*.yaml.
 *
 * Этап 0: только каркас. Загрузка YAML, zod-схемы и union-типы ID
 * параметров и формул появятся на этапе 1 (docs/06_build_plan.md).
 */

/** Файлы справочника — единственный источник правды (CLAUDE.md). */
export const SPEC_FILES = [
  "sources.yaml",
  "parameters.yaml",
  "capex_items.yaml",
  "regions.yaml",
  "formulas.yaml",
] as const;

export type SpecFile = (typeof SPEC_FILES)[number];
