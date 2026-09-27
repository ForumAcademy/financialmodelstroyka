/**
 * «Откуда» значение (решение владельца продукта 27.09.2026): текст и необязательная ссылка.
 * Уровни источников 1–5 остаются во внутренних данных и на экран не выводятся.
 */
import { getParameter, getSource, type ParameterId, type SourceId } from "@fm/spec";
import type { DemoProject } from "./types";

export interface Whence {
  text: string;
  url: string | null;
  /** Кем задано: изменено в проекте, введено в проекте или справочник. */
  kind: "changed" | "project" | "reference";
}

/** «Откуда» значения справочника: поле from, иначе названия источников и первая ссылка. */
export function referenceWhence(id: ParameterId): Whence {
  const p = getParameter(id);
  if (p.from) return { text: p.from.text, url: p.from.url, kind: "reference" };
  const sources = (p.source_ids as SourceId[]).map(getSource);
  const global = sources.filter((s) => s.scope === "global");
  const list = global.length ? global : sources;
  return {
    text: list.map((s) => s.title).join("; ") || "обоснование не указано",
    url: list.find((s) => s.url)?.url ?? null,
    kind: "reference",
  };
}

/** «Откуда» значения в проекте: изменение с комментарием → документ проекта → справочник. */
export function whence(id: ParameterId, project?: DemoProject | null): Whence {
  if (project) {
    const change = project.changes?.[id];
    const doc = project.sources.find((s) => s.id === project.paramSources[id]);
    if (change) return { text: change.why, url: change.url || doc?.url || doc?.file?.url || null, kind: "changed" };
    const own = project.input.values[id];
    if (own !== undefined && own !== null) {
      return doc ? { text: doc.title, url: doc.url || doc.file?.url || null, kind: "project" } : { text: "документ не указан", url: null, kind: "project" };
    }
  }
  return referenceWhence(id);
}
