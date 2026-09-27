"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { spec } from "@fm/spec";
import type Decimal from "decimal.js";
import { num, regionName } from "@/lib/format";
import type { ProjectModel } from "@/lib/model";
import { useStore } from "@/lib/store";
import type { DemoProject } from "@/lib/types";

/** Выручка с НДС из ядра (F.SALES.REVENUE_TOTAL), млрд руб.; не посчитана — «—». */
const revenueBn = (m: ProjectModel) => {
  const gross = (m.result.formulas["F.SALES.REVENUE_TOTAL"]?.value as { gross?: Decimal } | undefined)?.gross;
  return gross ? num(gross.div(1e9), 1) : "—";
};

const updated = (iso: string) => new Date(iso).toLocaleDateString("ru-RU");

function RowMenu({ project }: { project: DemoProject }) {
  const { dispatch } = useStore();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const close = () => (setOpen(false), setConfirm(false));
  return (
    <div className="menu-wrap">
      <button className="icon" aria-label="Действия с проектом" onClick={() => setOpen(!open)}>
        ⋮
      </button>
      {open ? (
        <div className="menu" onMouseLeave={close}>
          {confirm ? (
            <>
              <div className="menu-note">Удалить «{project.name}» безвозвратно?</div>
              <button className="danger" onClick={() => (dispatch({ type: "delete", id: project.id }), close())}>
                Удалить
              </button>
              <button onClick={() => setConfirm(false)}>Отмена</button>
            </>
          ) : (
            <>
              <button onClick={() => router.push(`/projects/${project.id}`)}>Открыть</button>
              <button onClick={() => (dispatch({ type: "copy", id: project.id, newId: `p-${Date.now()}` }), close())}>Копировать</button>
              <button onClick={() => (dispatch({ type: "archive", id: project.id, archived: !project.archived }), close())}>
                {project.archived ? "Вернуть из архива" : "Архивировать"}
              </button>
              <button className="danger" onClick={() => setConfirm(true)}>
                Удалить
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function ProjectsPage() {
  const { projects, dispatch, model } = useStore();
  const router = useRouter();
  const [archived, setArchived] = useState(false);
  const list = projects.filter((p) => p.archived === archived).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const create = () => {
    const id = `p-${Date.now()}`;
    const name = `Новый проект ${projects.length + 1}`;
    dispatch({
      type: "create",
      project: { id, name, archived: false, sources: [], paramSources: {}, specVersion: spec.specVersion, updatedAt: new Date().toISOString(), input: { values: { "GEN.PROJECT_NAME": name } } },
    });
    router.push(`/projects/${id}`);
  };

  return (
    <main className="page">
      <div className="page-head">
        <h1>Проекты</h1>
        <button className="btn primary" onClick={create}>
          + Новый проект
        </button>
      </div>
      <div className="seg">
        <button className={!archived ? "on" : ""} onClick={() => setArchived(false)}>
          Активные
        </button>
        <button className={archived ? "on" : ""} onClick={() => setArchived(true)}>
          Архив
        </button>
      </div>
      <div className="project-cards">
        {list.map((p) => (
          <article key={p.id} className="project-card" onClick={() => router.push(`/projects/${p.id}`)}>
            <div className="pc-head">
              <div>
                <Link href={`/projects/${p.id}`} className="pc-name" onClick={(e) => e.stopPropagation()}>
                  {p.name}
                </Link>
                <div className="pc-meta">
                  {p.input.values["GEN.REGION_CODE"] ? regionName(p) : "регион не указан"} · {String(p.input.values["GEN.PROJECT_STAGE"] ?? "стадия не указана")}
                </div>
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <RowMenu project={p} />
              </div>
            </div>
            <dl className="pc-kpi">
              <div>
                <dt>Выручка, млрд руб.</dt>
                <dd>{revenueBn(model(p))}</dd>
              </div>
              <div title="Расчёт — этап 6">
                <dt>NPV, млн руб.</dt>
                <dd>—</dd>
              </div>
              <div title="Расчёт — этап 6">
                <dt>IRR акционера</dt>
                <dd>—</dd>
              </div>
            </dl>
            <div className="pc-foot">Обновлено {updated(p.updatedAt)}</div>
          </article>
        ))}
        {list.length === 0 ? <p className="muted">{archived ? "В архиве пусто" : "Проектов нет"}</p> : null}
      </div>
      <p className="footnote">Демо-режим: проекты и изменения хранятся до перезагрузки страницы (хранение — этап 7). Выручка, NPV и IRR появятся после этапов 4–6.</p>
    </main>
  );
}
