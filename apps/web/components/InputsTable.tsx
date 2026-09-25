"use client";

import { useMemo, useState } from "react";
import { getSource } from "@fm/spec";
import { usePassport } from "./Passport";
import { PHASED_PARAMETERS, SECTIONS, STATUS_LABEL, STATUS_ORDER, type ParamRow, type ParamStatus, type ProjectModel } from "@/lib/model";
import type { DemoProject } from "@/lib/types";
import * as fmt from "@/lib/format";

type Quick = "no_source" | "check" | "expert" | null;

export interface InputsFilter {
  q: string;
  section: string;
  phase: string;
  level: string;
  status: string;
  quick: Quick;
  all: boolean;
}

export const EMPTY_FILTER: InputsFilter = { q: "", section: "", phase: "", level: "", status: "", quick: null, all: false };

function sourceLevel(r: ParamRow): number | null {
  if (r.source) return r.source.level;
  if (r.origin === "project" || r.origin === null) return null;
  return Math.min(...r.param.source_ids.map((id) => getSource(id).level));
}

export function InputsTable({ project, model, initial }: { project: DemoProject; model: ProjectModel; initial: Partial<InputsFilter> }) {
  const open = usePassport();
  const [f, setF] = useState<InputsFilter>({ ...EMPTY_FILTER, ...initial });
  const phases = Math.max(Number(project.input.values["GEN.PHASES_COUNT"] ?? 1), 1);
  const base = f.all ? model.rows : model.used;

  const rows = useMemo(
    () =>
      base.filter((r) => {
        if (f.q && !`${r.param.name} ${r.param.id}`.toLowerCase().includes(f.q.toLowerCase())) return false;
        if (f.section && r.section !== f.section) return false;
        if (f.phase && !PHASED_PARAMETERS.has(r.param.id)) return false;
        if (f.level && String(sourceLevel(r) ?? "нет") !== f.level) return false;
        if (f.status && r.status !== f.status) return false;
        if (f.quick === "no_source" && r.status !== "no_source") return false;
        if (f.quick === "check" && r.status !== "check") return false;
        if (f.quick === "expert" && r.source?.level !== 5) return false;
        return true;
      }),
    [base, f],
  );
  const quick = (q: Quick) => setF({ ...f, quick: f.quick === q ? null : q });

  return (
    <div>
      <div className="filters">
        <div className="filters-row">
          <input className="search" placeholder="Поиск по параметрам…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
          <select value={f.section} onChange={(e) => setF({ ...f, section: e.target.value })}>
            <option value="">Раздел</option>
            {SECTIONS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select value={f.phase} onChange={(e) => setF({ ...f, phase: e.target.value })} title="Параметры с данными по очередям">
            <option value="">Очередь</option>
            {Array.from({ length: phases }, (_, i) => (
              <option key={i} value={String(i + 1)}>
                Очередь {i + 1}
              </option>
            ))}
          </select>
          <select value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}>
            <option value="">Уровень источника</option>
            {["1", "2", "3", "4", "5", "нет"].map((l) => (
              <option key={l} value={l}>
                {l === "нет" ? "без источника" : `уровень ${l}`}
              </option>
            ))}
          </select>
          <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            <option value="">Статус</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="filters-row">
          <span className="muted">Быстро:</span>
          <button className={`chip ${f.quick === "no_source" ? "on" : ""}`} onClick={() => quick("no_source")}>
            Без источника
          </button>
          <button className={`chip ${f.quick === "check" ? "on" : ""}`} onClick={() => quick("check")}>
            Требует сверки
          </button>
          <button className={`chip ${f.quick === "expert" ? "on" : ""}`} onClick={() => quick("expert")}>
            Экспертные
          </button>
          <label className="chip-toggle small">
            <input type="checkbox" checked={f.all} onChange={(e) => setF({ ...f, all: e.target.checked })} /> все параметры проекта (включая не участвующие в расчёте)
          </label>
          <span className="spacer" />
          <span className="small muted">
            Показано {rows.length} из {base.length}
          </span>
          <button className="link" onClick={() => setF(EMPTY_FILTER)}>
            ↺ Сбросить фильтры
          </button>
        </div>
      </div>

      <table className="data">
        <thead>
          <tr>
            <th>Параметр</th>
            <th className="num">Значение</th>
            <th>Ед.</th>
            <th>Источник</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          {SECTIONS.map((section) => {
            const list = rows.filter((r) => r.section === section);
            if (list.length === 0) return null;
            return [
              <tr key={section} className="section-row">
                <td colSpan={5}>{section}</td>
              </tr>,
              ...list.map((r) => {
                const lvl = sourceLevel(r);
                return (
                  <tr key={r.param.id} className="clickable" onClick={() => open({ id: r.param.id, result: model.result, project })}>
                    <td>
                      {r.param.name}
                      <div className="small muted">
                        <code>{r.param.id}</code>
                      </div>
                    </td>
                    <td className="num">
                      <button className="link num-link">{fmt.value(r.value)}</button>
                    </td>
                    <td>{fmt.unit(r.param.unit)}</td>
                    <td>
                      {lvl ? <span className={`lvl lvl${lvl}`}>{lvl}</span> : null}{" "}
                      {r.source ? (r.source.url ? <a href={r.source.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{r.source.title}</a> : r.source.title) : r.origin && r.origin !== "project" ? <span className="small">{r.param.source_ids.join(", ")}</span> : <span className="muted">—</span>}
                    </td>
                    <td>
                      <span className={`status st-${r.status}`}>{STATUS_LABEL[r.status as ParamStatus]}</span>
                    </td>
                  </tr>
                );
              }),
            ];
          })}
        </tbody>
      </table>
      {rows.length === 0 ? <p className="muted">Ничего не найдено — измените фильтры.</p> : null}
    </div>
  );
}
