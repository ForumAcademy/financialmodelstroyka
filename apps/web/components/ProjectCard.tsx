"use client";

import Link from "next/link";
import { useState } from "react";
import { getRegion, isRegionCode } from "@fm/spec";
import { useStore } from "@/lib/store";
import { STATUS_LABEL, STATUS_ORDER, type ProjectModel } from "@/lib/model";
import { PROJECT_STATUS_LABEL, type DemoProject } from "@/lib/types";
import * as fmt from "@/lib/format";

export function regionName(p: DemoProject): string {
  const code = p.input.values["GEN.REGION_CODE"];
  return typeof code === "string" && isRegionCode(code) ? getRegion(code).name : "регион не указан";
}

export function Tile({ value, label, tone, href, hint }: { value: string; label: string; tone?: string; href?: string; hint?: string }) {
  const body = (
    <>
      <div className={`tile-value ${tone ?? ""}`}>{value}</div>
      <div className="tile-label">{label}</div>
      {hint ? <div className="tile-hint">{hint}</div> : null}
    </>
  );
  return href ? (
    <Link href={href} className="tile clickable">
      {body}
    </Link>
  ) : (
    <div className="tile">{body}</div>
  );
}

export function ProjectCard({ project, model }: { project: DemoProject; model: ProjectModel }) {
  const { dispatch } = useStore();
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(project.name);
  const v = project.input.values;
  const inputs = `/projects/${project.id}?tab=inputs&status=`;

  return (
    <article className="card">
      <div className="card-head">
        {renaming ? (
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) dispatch({ type: "rename", id: project.id, name: name.trim() });
              setRenaming(false);
            }}
          >
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn">OK</button>
          </form>
        ) : (
          <Link href={`/projects/${project.id}`} className="card-title">
            {project.name}
          </Link>
        )}
        <div className="menu-wrap">
          <button className="icon" aria-label="Действия" onClick={() => setMenu(!menu)}>
            ⋮
          </button>
          {menu ? (
            <div className="menu" onMouseLeave={() => setMenu(false)}>
              <button onClick={() => (setRenaming(true), setMenu(false))}>Переименовать</button>
              <button onClick={() => (dispatch({ type: "copy", id: project.id, newId: `${project.id}-copy-${Date.now()}` }), setMenu(false))}>Копировать</button>
              <button onClick={() => (dispatch({ type: "archive", id: project.id, archived: !project.archived }), setMenu(false))}>
                {project.archived ? "Вернуть из архива" : "В архив"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <div className="card-meta">
        <span>📍 {regionName(project)}</span>
        <span>{String(v["GEN.HOUSING_CLASS"] ?? "класс —")}</span>
        <span className="pill">{String(v["GEN.PROJECT_STAGE"] ?? "стадия не указана")}</span>
        <span className={`pill status-${project.status}`}>{PROJECT_STATUS_LABEL[project.status]}</span>
      </div>

      <div className="progress-row">
        <span>Готовность модели</span>
        <strong>{Math.round(model.readiness * 100)}%</strong>
      </div>
      <div className="progress" title="Доля параметров расчёта, у которых есть значение и источник">
        <div style={{ width: `${Math.round(model.readiness * 100)}%` }} />
      </div>

      <div className="tiles four">
        {STATUS_ORDER.map((s) => (
          <Tile key={s} value={String(model.counters[s])} label={STATUS_LABEL[s]} tone={`st-${s}`} href={`${inputs}${s}`} />
        ))}
      </div>
      <div className="tiles two">
        <Tile value="—" label="Выручка, млрд руб." hint="этап 4" />
        <Tile value="—" label="Затраты, млрд руб." hint="этап 3" />
      </div>
      <div className="card-kpi muted small">NPV — · IRR акционера — (этап 6)</div>

      <div className="card-foot">
        <span>
          {model.used.length} {fmt.plural(model.used.length, ["параметр", "параметра", "параметров"])}
        </span>
        {model.outdatedSpec ? (
          <Link href={`/projects/${project.id}`} className="danger">
            Новая версия справочника
          </Link>
        ) : (
          <span className="muted">Обновлено {fmt.ago(project.updatedAt)}</span>
        )}
      </div>
    </article>
  );
}
