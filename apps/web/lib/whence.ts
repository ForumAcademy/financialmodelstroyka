/**
 * «Откуда» значение (решение владельца продукта 27.09.2026): текст и необязательная ссылка.
 * Уровни источников 1–5 остаются во внутренних данных и на экран не выводятся.
 */
import { getParameter, getSource, type ParameterId, type SourceId } from "@fm/spec";
import { confirmation, SPEC_ASSUMPTIONS, valueSource, versionOf, type AssumptionVersion } from "./assumptions";
import type { DemoProject } from "./types";

export interface Whence {
  text: string;
  url: string | null;
  /** Кем задано: изменено в проекте, введено в проекте, стандарт компании (подтверждён или нет) или справочник. */
  kind: "changed" | "project" | "standard" | "confirmed" | "reference";
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

/** «Откуда» значения в проекте: изменение с комментарием → документ проекта → стандарт компании → справочник. */
export function whence(id: ParameterId, project?: DemoProject | null, versions: AssumptionVersion[] = SPEC_ASSUMPTIONS): Whence {
  if (project) {
    const change = project.changes?.[id];
    const doc = project.sources.find((s) => s.id === project.paramSources[id]);
    if (change) return { text: change.why, url: change.url || doc?.url || doc?.file?.url || null, kind: "changed" };
    const own = project.input.values[id];
    if (own !== undefined && own !== null) {
      const cell = project.fromFile?.[id];
      const file = project.sources.find((s) => s.id === project.fileImport?.sourceId)?.file;
      if (cell && file) return { text: `Загружено из файла ${file.name}, лист ${cell.sheet}, ${cell.cell.includes(":") ? "ячейки" : "ячейка"} ${cell.cell}`, url: file.url, kind: "project" };
      return doc ? { text: doc.title, url: doc.url || doc.file?.url || null, kind: "project" } : { text: "документ не указан", url: null, kind: "project" };
    }
    const source = valueSource(project, id, versions);
    const item = versionOf(versions, project.assumptionsVersion)?.items.find((i) => i.param === id);
    if (item && (source === "standard" || source === "confirmed")) {
      const c = source === "confirmed" ? confirmation(project, id) : null;
      const text = `Справочник допущений компании, версия ${project.assumptionsVersion}: ${item.from.text}${c?.comment ? `. Подтверждение финансистов: ${c.comment}` : ""}`;
      return { text, url: item.from.url, kind: source };
    }
  }
  return referenceWhence(id);
}
