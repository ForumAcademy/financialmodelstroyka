"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { getParameter, spec, type ParameterId } from "@fm/spec";
import { useHow } from "@/components/HowPanel";
import * as fmt from "@/lib/format";
import { useStore } from "@/lib/store";
import type { ProjectSource } from "@/lib/types";

type Scope = "all" | "global" | "project";

interface Row {
  key: string;
  title: string;
  level: number;
  url: string | null;
  usedFor: string;
  checked: string;
  verified: boolean | null;
  params: ParameterId[];
  project?: { id: string; name: string; sourceId: string };
  searchText: string;
}

function NewSourceForm({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const { dispatch } = useStore();
  const [f, setF] = useState<Omit<ProjectSource, "id">>({ level: 4, title: "", url: "", author: "", date: new Date().toISOString().slice(0, 10) });
  const [error, setError] = useState("");
  const save = () => {
    if (!f.title.trim() || !f.author.trim()) return setError("Укажите название документа и автора");
    if (f.level === 5 && (!f.rationale?.trim() || !f.min?.trim() || !f.max?.trim())) return setError("Для экспертной оценки обязательны обоснование и диапазон min–max");
    dispatch({ type: "addSource", id: projectId, source: { ...f, id: `src-${Date.now()}` } });
    onDone();
  };
  return (
    <div className="inline-form">
      <select value={f.level} onChange={(e) => setF({ ...f, level: Number(e.target.value) as 4 | 5 })}>
        <option value={4}>4 — документ проекта (ГПЗУ, ППТ, ТЭП, договор, term sheet)</option>
        <option value={5}>5 — экспертная оценка</option>
      </select>
      <input placeholder="Название документа" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      <input placeholder="Ссылка на документ (облако, СЭД)" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />
      <input placeholder="Автор" value={f.author} onChange={(e) => setF({ ...f, author: e.target.value })} />
      <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
      {f.level === 5 ? (
        <>
          <input placeholder="Обоснование" value={f.rationale ?? ""} onChange={(e) => setF({ ...f, rationale: e.target.value })} />
          <input placeholder="min" value={f.min ?? ""} onChange={(e) => setF({ ...f, min: e.target.value })} />
          <input placeholder="max" value={f.max ?? ""} onChange={(e) => setF({ ...f, max: e.target.value })} />
        </>
      ) : null}
      <button className="btn primary" onClick={save}>
        Сохранить
      </button>
      <button className="btn" onClick={onDone}>
        Отмена
      </button>
      {error ? <span className="error small">{error}</span> : null}
    </div>
  );
}

function SourcesPage() {
  const search = useSearchParams();
  const { projects, dispatch } = useStore();
  const { open, setProject } = useHow();
  const [q, setQ] = useState(search.get("q") ?? "");
  const [scope, setScope] = useState<Scope>(search.get("project") ? "project" : "all");
  const [projectId, setProjectId] = useState(search.get("project") ?? projects[0]?.id ?? "");
  const [adding, setAdding] = useState(search.get("new") === "1");
  const project = projects.find((p) => p.id === projectId);

  const globalRows = useMemo<Row[]>(
    () =>
      spec.sources
        .filter((s) => s.scope === "global")
        .map((s) => ({
          key: s.id,
          title: s.title,
          level: s.level,
          url: s.url,
          usedFor: s.used_for,
          checked: s.accessed ? `${fmt.date(s.accessed)}${s.verified === false ? " · не сверен" : ""}` : "—",
          verified: s.verified,
          params: spec.parameters.filter((p) => (p.source_ids as string[]).includes(s.id)).map((p) => p.id),
          searchText: `${s.id} ${s.title} ${s.used_for}`.toLowerCase(),
        })),
    [],
  );
  const projectRows: Row[] = (scope === "global" ? [] : scope === "project" ? (project ? [project] : []) : projects).flatMap((p) =>
    p.sources.map((s) => ({
      key: `${p.id}-${s.id}`,
      title: s.title,
      level: s.level,
      url: s.url || null,
      usedFor: `${p.name} · ${s.author}${s.level === 5 ? ` · ${s.rationale}; диапазон ${s.min}–${s.max}` : ""}`,
      checked: fmt.date(s.date),
      verified: null,
      params: (Object.entries(p.paramSources) as [ParameterId, string][]).filter(([, v]) => v === s.id).map(([k]) => k),
      project: { id: p.id, name: p.name, sourceId: s.id },
      searchText: `${s.title} ${s.author} ${p.name}`.toLowerCase(),
    })),
  );
  const rows = [...projectRows, ...(scope === "project" ? [] : globalRows)].filter((r) => !q || r.searchText.includes(q.toLowerCase()));

  return (
    <main className="page wide">
      <div className="page-head">
        <h1>Источники</h1>
        <button className="btn primary" onClick={() => (setScope("project"), setAdding(true))}>
          + Источник проекта
        </button>
      </div>
      <div className="toolbar">
        <input className="search" placeholder="Поиск по названию…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="seg">
          {(["all", "global", "project"] as Scope[]).map((s) => (
            <button key={s} className={scope === s ? "on" : ""} onClick={() => setScope(s)}>
              {{ all: "Все", global: "Общие", project: "Этого проекта" }[s]}
            </button>
          ))}
        </div>
        {scope === "project" ? (
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      {adding && project ? <NewSourceForm projectId={project.id} onDone={() => setAdding(false)} /> : null}
      <table className="sheet">
        <thead>
          <tr>
            <th>Название</th>
            <th>Уровень</th>
            <th>Ссылка</th>
            <th>Для чего</th>
            <th>Проверено</th>
            <th>Где используется</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>
                {r.title}
                {r.project ? (
                  <div className="small">
                    <span className="tag">проект</span>{" "}
                    <button className="link small" onClick={() => dispatch({ type: "removeSource", id: r.project!.id, sourceId: r.project!.sourceId })}>
                      удалить
                    </button>
                  </div>
                ) : null}
              </td>
              <td>
                <span className={`lvl lvl${r.level}`}>{r.level}</span>
              </td>
              <td>
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noreferrer">
                    открыть
                  </a>
                ) : (
                  "—"
                )}
              </td>
              <td className="small">{r.usedFor}</td>
              <td className={`small ${r.verified === false ? "warn" : ""}`}>{r.checked}</td>
              <td className="small">
                {r.params.length === 0 ? (
                  <span className="muted">—</span>
                ) : (
                  r.params.map((id, i) => (
                    <span key={id}>
                      {i > 0 ? ", " : ""}
                      <button className="link small" onClick={() => (setProject(r.project?.id ?? null), open({ kind: "param", id }))}>
                        {getParameter(id).name}
                      </button>
                    </span>
                  ))
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="muted">
                Нет источников{scope === "project" ? " у проекта — добавьте кнопкой «+ Источник проекта»" : ""}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      <p className="footnote">Уровни: 1 — закон, НПА; 2 — статистика, госсервисы; 3 — рынок; 4 — документ компании или проекта; 5 — экспертная оценка (автор, обоснование, диапазон). Вложение файлов к источникам проекта — этап 8.</p>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<main className="page">Загрузка…</main>}>
      <SourcesPage />
    </Suspense>
  );
}
