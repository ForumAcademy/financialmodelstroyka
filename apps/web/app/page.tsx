"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { spec } from "@fm/spec";
import { regionName } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { DemoProject } from "@/lib/types";

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
  const { projects, dispatch } = useStore();
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
      <table className="sheet">
        <thead>
          <tr>
            <th>Название ЖК</th>
            <th>Регион</th>
            <th>Стадия</th>
            <th className="num">Выручка, млрд руб.</th>
            <th className="num">NPV, млн руб.</th>
            <th className="num">IRR акционера</th>
            <th>Обновлено</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {list.map((p) => (
            <tr key={p.id}>
              <td>
                <Link href={`/projects/${p.id}`}>{p.name}</Link>
              </td>
              <td>{regionName(p)}</td>
              <td>{String(p.input.values["GEN.PROJECT_STAGE"] ?? "—")}</td>
              <td className="num" title="Расчёт — этап 4">—</td>
              <td className="num" title="Расчёт — этап 6">—</td>
              <td className="num" title="Расчёт — этап 6">—</td>
              <td>{updated(p.updatedAt)}</td>
              <td className="menu-cell">
                <RowMenu project={p} />
              </td>
            </tr>
          ))}
          {list.length === 0 ? (
            <tr>
              <td colSpan={8} className="muted">
                {archived ? "В архиве пусто" : "Проектов нет"}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      <p className="footnote">Демо-режим: проекты и изменения хранятся до перезагрузки страницы (хранение — этап 7). Выручка, NPV и IRR появятся после этапов 4–6.</p>
    </main>
  );
}
