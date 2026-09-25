"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { spec } from "@fm/spec";
import { Breadcrumbs } from "@/components/AppShell";
import { Gantt } from "@/components/Gantt";
import { InputsTable } from "@/components/InputsTable";
import { usePassport } from "@/components/Passport";
import { regionName, Tile } from "@/components/ProjectCard";
import { CashflowTab, ModulePlaceholder, SummaryTab } from "@/components/ProjectTabs";
import { downloadTemplate } from "@/lib/excel-template";
import { KPI_TILES, stageOf, type ParamStatus } from "@/lib/model";
import { useStore } from "@/lib/store";
import { PROJECT_STATUS_LABEL, type ProjectStatus } from "@/lib/types";

const TABS = [
  { id: "gantt", label: "График проекта" },
  { id: "inputs", label: "Исходные данные" },
  { id: "budget", label: "Бюджет" },
  { id: "sales", label: "Продажи" },
  { id: "escrow", label: "Эскроу и ПФ" },
  { id: "cf", label: "Денежный поток" },
  { id: "summary", label: "Итоги" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { projects, model, dispatch } = useStore();
  const open = usePassport();
  const project = projects.find((p) => p.id === id);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project?.name ?? "");
  const [exporting, setExporting] = useState(false);

  if (!project) {
    return (
      <main className="page">
        <h1>Проект не найден</h1>
        <p className="muted">В демо-режиме созданные проекты хранятся до перезагрузки страницы.</p>
        <Link href="/">← К списку проектов</Link>
      </main>
    );
  }
  const m = model(project);
  const tab = (TABS.find((t) => t.id === search.get("tab"))?.id ?? "gantt") as TabId;
  const setTab = (t: TabId) => router.replace(`/projects/${project.id}?tab=${t}`, { scroll: false });
  const v = project.input.values;
  const status = search.get("status");

  return (
    <>
      <Breadcrumbs items={[{ label: "Проекты", href: "/" }, { label: project.name, href: `/projects/${project.id}` }, { label: TABS.find((t) => t.id === tab)!.label }]} />
      <main className="page wide">
        <div className="project-head">
          <div>
            {editing ? (
              <form
                className="row"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (name.trim()) dispatch({ type: "rename", id: project.id, name: name.trim() });
                  setEditing(false);
                }}
              >
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="title-input" />
                <button className="btn">OK</button>
              </form>
            ) : (
              <h1>
                {project.name}{" "}
                <button className="icon" aria-label="Переименовать" onClick={() => (setName(project.name), setEditing(true))}>
                  ✎
                </button>
              </h1>
            )}
            <div className="meta">
              <span>📍 {regionName(project)}</span>
              <span>{String(v["GEN.HOUSING_CLASS"] ?? "класс —")}</span>
              <span>{String(v["GEN.PROJECT_STAGE"] ?? "стадия —")}</span>
              <span>КН {String(v["GEN.CADASTRAL_NUMBER"] ?? "—")}</span>
              <span title="Версия справочника, на которой посчитан проект">справочник {project.specVersion}</span>
              <select className="status-select" value={project.status} onChange={(e) => dispatch({ type: "status", id: project.id, status: e.target.value as ProjectStatus })}>
                {(Object.keys(PROJECT_STATUS_LABEL) as ProjectStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {PROJECT_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            {m.outdatedSpec ? <div className="danger small">Доступна новая версия справочника {spec.specVersion} — пересчёт по кнопке (этап 10).</div> : null}
          </div>
          <div className="kpis">
            {KPI_TILES.map((k) => {
              const node = m.result.formulas[k.id];
              return (
                <button key={k.id} className="tile clickable kpi" onClick={() => open({ id: k.id, result: m.result, project })} title="Паспорт показателя">
                  <div className="tile-value">{node ? String(node.value) : "—"}</div>
                  <div className="tile-label">{k.label}</div>
                  {!node ? <div className="tile-hint">этап {stageOf(k.id)}</div> : null}
                </button>
              );
            })}
          </div>
          <div className="head-actions">
            <button
              className="btn"
              disabled={exporting}
              onClick={async () => {
                setExporting(true);
                try {
                  await downloadTemplate(project);
                } finally {
                  setExporting(false);
                }
              }}
            >
              ⬇ Выгрузить шаблон в Excel
            </button>
            <button className="btn" disabled title="Полная выгрузка модели с живыми формулами — этап 13">
              ⬇ Выгрузить в Excel
            </button>
          </div>
        </div>

        <div className="tile-row">
          <Tile value={`${Math.round(m.readiness * 100)}%`} label="Готовность модели" />
          {(["empty", "no_source", "ok", "check"] as ParamStatus[]).map((s) => (
            <Tile key={s} value={String(m.counters[s])} label={{ empty: "Не заполнено", no_source: "Без источника", ok: "С источником", check: "Требует сверки" }[s]} tone={`st-${s}`} href={`/projects/${project.id}?tab=inputs&status=${s}`} />
          ))}
        </div>

        <nav className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>

        <div className="panel">
          {tab === "gantt" ? <Gantt project={project} model={m} /> : null}
          {tab === "inputs" ? (
            <InputsTable
              key={`${status}-${search.get("q")}`}
              project={project}
              model={m}
              initial={{ status: status && ["empty", "no_source", "ok", "check"].includes(status) ? status : "", q: search.get("q") ?? "" }}
            />
          ) : null}
          {tab === "budget" ? <ModulePlaceholder modules={["CAPEX"]} stage={3} title="Бюджет" model={m} project={project} /> : null}
          {tab === "sales" ? <ModulePlaceholder modules={["SALES", "BENCH"]} stage={4} title="Продажи" model={m} project={project} /> : null}
          {tab === "escrow" ? <ModulePlaceholder modules={["ESCROW", "FIN"]} stage={5} title="Эскроу и проектное финансирование" model={m} project={project} /> : null}
          {tab === "cf" ? <CashflowTab model={m} project={project} /> : null}
          {tab === "summary" ? <SummaryTab model={m} project={project} /> : null}
        </div>
      </main>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<main className="page">Загрузка…</main>}>
      <ProjectPage />
    </Suspense>
  );
}
