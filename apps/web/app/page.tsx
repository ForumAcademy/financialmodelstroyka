"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type Decimal from "decimal.js";
import { housingClass, num, plural, regionName } from "@/lib/format";
import { exportProject } from "@/lib/excel-export";
import { issuesCount, issueSummary } from "@/lib/issues";
import { projectQuestions, type ProjectModel } from "@/lib/model";
import { inputsMissing } from "@/lib/project-nav";
import { NewProjectDialog } from "@/components/NewProject";
import { useStore } from "@/lib/store";
import type { DemoProject } from "@/lib/types";

const formula = <T,>(m: ProjectModel, id: string): T | undefined => m.result.formulas[id as keyof typeof m.result.formulas]?.value as T | undefined;

/** Выручка с НДС из ядра (F.SALES.REVENUE_TOTAL), млрд руб.; не посчитана — null. */
const revenueBn = (m: ProjectModel): string | null => {
  const gross = formula<{ gross?: Decimal }>(m, "F.SALES.REVENUE_TOTAL")?.gross;
  return gross ? num(gross.div(1e9), 1) : null;
};

/** «153 882 м² к продаже · 2 401 кв. · 2026–2032»: только то, что посчитано. */
function scale(m: ProjectModel): string[] {
  const area = formula<Decimal>(m, "F.TEP.SALEABLE_AREA");
  const apts = formula<Decimal[]>(m, "F.TEP.APT_COUNT")?.reduce((a, b) => a.add(b));
  const dates = formula<string[]>(m, "F.TIME.DATE");
  const years = dates?.length ? `${dates[0]!.slice(0, 4)}–${dates[dates.length - 1]!.slice(0, 4)}` : null;
  return [area && !area.isZero() ? `${num(area, 0)} м² к продаже` : null, apts && !apts.isZero() ? `${num(apts, 0)} кв.` : null, years].filter((x): x is string => x !== null);
}

const updated = (iso: string) => new Date(iso).toLocaleDateString("ru-RU");

function CardMenu({ project }: { project: DemoProject }) {
  const { dispatch, sourceChecks } = useStore();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div className="menu-wrap" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button className="icon" aria-label="Действия с проектом" onClick={() => setOpen(!open)}>
        ⋮
      </button>
      {open ? (
        <div className="menu">
          <button onClick={() => router.push(`/projects/${project.id}`)}>Открыть</button>
          <button onClick={() => (setOpen(false), void exportProject(project, sourceChecks))}>Выгрузить в Excel</button>
          <button onClick={() => (dispatch({ type: "copy", id: project.id, newId: `p-${Date.now()}` }), setOpen(false))}>Сделать копию</button>
          <button onClick={() => (dispatch({ type: "archive", id: project.id, archived: !project.archived }), setOpen(false))}>
            {project.archived ? "Вернуть из архива" : "В архив"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Kpi({ value, unit, label }: { value: string | null; unit?: string; label: string }) {
  return (
    <div className="pk" title={value === null ? "Ещё не рассчитывается" : undefined}>
      <strong>
        {value ?? "—"}
        {value !== null && unit ? <small>{unit}</small> : null}
      </strong>
      <span>{label}</span>
    </div>
  );
}

function ProjectCard({ project }: { project: DemoProject }) {
  const { model } = useStore();
  const router = useRouter();
  const m = model(project);
  const missing = inputsMissing(project, m);
  const issues = issueSummary(project, projectQuestions(project, m));
  const issueCount = issuesCount(project, issues);
  const showIssues = issues.shown && !issueCount.ok;
  const meta = [project.input.values["GEN.REGION_CODE"] ? regionName(project) : null, housingClass(project)].filter(Boolean);
  const size = scale(m);
  return (
    <article className="pcard" onClick={() => router.push(`/projects/${project.id}`)}>
      <div className="pc-top">
        <div className="pc-title">
          <span className="pc-name">{project.name}</span>
          {meta.length ? (
            <span className="pc-meta">
              {meta.map((x, k) => (
                <span key={k} className="nw">
                  {k ? <span className="dotsep">· </span> : null}
                  {x}
                </span>
              ))}
            </span>
          ) : null}
          {size.length ? (
            <span className="pc-meta sm">
              {size.map((x, k) => (
                <span key={k} className="nw">
                  {k ? <span className="dotsep">· </span> : null}
                  {x}
                </span>
              ))}
            </span>
          ) : null}
        </div>
        <CardMenu project={project} />
      </div>
      <div className="pc-kpi">
        <Kpi value={revenueBn(m)} unit="млрд" label="Выручка" />
        <Kpi value={null} label="Прибыль" />
        <Kpi value={null} label="Маржа" />
        <Kpi value={null} label="IRR" />
        <Kpi value={null} label="Собств. средства" />
        <Kpi value={null} label="Пиковый долг" />
      </div>
      <div className="pc-foot">
        {missing || showIssues ? (
          <div className="pc-tags">
            {missing ? (
              <span className="chip warn">
                Не хватает {missing} {plural(missing, ["значения", "значений", "значений"])}
              </span>
            ) : null}
            {showIssues ? (
              <span className="chip bad" title={issueCount.title}>
                {project.input.mode === "legacy" ? `В файле: ${issueCount.n}` : `Не исправлено: ${issueCount.n}`}
              </span>
            ) : null}
          </div>
        ) : null}
        <span className="pc-meta sm">Обновлено {updated(project.updatedAt)}</span>
      </div>
    </article>
  );
}

export default function ProjectsPage() {
  const { projects } = useStore();
  const [archived, setArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState("");
  const count = (a: boolean) => projects.filter((p) => p.archived === a).length;
  const list = projects
    .filter((p) => p.archived === archived && (!q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase())))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="shell">
      <header className="card-head">
        <h1>Проекты</h1>
        <span className="sp" />
        <button className="btn primary" onClick={() => setCreating(true)}>
          + Новый проект
        </button>
      </header>
      <div className="bar">
        <div className="seg">
          <button className={!archived ? "on" : ""} onClick={() => setArchived(false)}>
            Активные · {count(false)}
          </button>
          <button className={archived ? "on" : ""} onClick={() => setArchived(true)}>
            Архив · {count(true)}
          </button>
        </div>
        <input className="search-input" placeholder="Поиск" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="pgrid">
        {list.map((p) => (
          <ProjectCard key={p.id} project={p} />
        ))}
      </div>
      {list.length === 0 ? <p className="muted">{q ? "Ничего не найдено" : archived ? "В архиве пусто" : "Проектов нет"}</p> : null}
      {creating ? <NewProjectDialog onClose={() => setCreating(false)} /> : null}
    </div>
  );
}
