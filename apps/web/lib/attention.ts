import { getParameter, getSource, type SourceId } from "@fm/spec";
import type { DemoProject } from "./types";
import type { ProjectModel } from "./model";
import { plural } from "./format";

export type AttentionKind = "no_source" | "check" | "unverified_source" | "calc_error" | "spec_version" | "stale_comps";

export interface AttentionItem {
  kind: AttentionKind;
  projectId: string;
  projectName: string;
  title: string;
  detail?: string | undefined;
  href: string;
}

export const KIND_LABEL: Record<AttentionKind, string> = {
  no_source: "Без источника",
  check: "Требует сверки",
  unverified_source: "Источник не сверен",
  calc_error: "Ошибка расчёта",
  spec_version: "Новая версия справочника",
  stale_comps: "Устаревшие аналоги",
};

export function attentionItems(projects: DemoProject[], model: (p: DemoProject) => ProjectModel): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const p of projects.filter((x) => !x.archived)) {
    const m = model(p);
    const base = { projectId: p.id, projectName: p.name };
    const inputs = `/projects/${p.id}?tab=inputs`;
    if (m.outdatedSpec) items.push({ ...base, kind: "spec_version", title: "Доступна новая версия справочника", href: `/projects/${p.id}` });
    if (m.counters.no_source) items.push({ ...base, kind: "no_source", title: `${m.counters.no_source} ${plural(m.counters.no_source, ["параметр", "параметра", "параметров"])} без источника`, href: `${inputs}&status=no_source` });
    if (m.counters.check) items.push({ ...base, kind: "check", title: `${m.counters.check} ${plural(m.counters.check, ["параметр требует", "параметра требуют", "параметров требуют"])} сверки`, href: `${inputs}&status=check` });
    const unverified = new Set<SourceId>();
    for (const r of m.used) for (const id of r.param.source_ids) if (getSource(id).verified === false && r.origin !== "project") unverified.add(id);
    for (const id of unverified) {
      const s = getSource(id);
      items.push({ ...base, kind: "unverified_source", title: `Источник не сверен: ${s.title}`, detail: s.note, href: `/reference?tab=sources&q=${id}` });
    }
    for (const e of m.errors) {
      items.push({
        ...base,
        kind: "calc_error",
        title: e.text,
        detail: e.parameterId ? getParameter(e.parameterId).name : e.formulaId,
        href: e.parameterId ? `${inputs}&q=${e.parameterId}` : `/projects/${p.id}?tab=summary`,
      });
    }
  }
  return items;
}
