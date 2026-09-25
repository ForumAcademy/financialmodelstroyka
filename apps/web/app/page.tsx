"use client";

import Link from "next/link";
import { useState } from "react";
import { Breadcrumbs } from "@/components/AppShell";
import { NewProjectModal } from "@/components/NewProjectModal";
import { ProjectCard } from "@/components/ProjectCard";
import { useStore } from "@/lib/store";

type Sort = "updated" | "npv" | "name";
const SORT_LABEL: Record<Sort, string> = { updated: "по дате изменения", npv: "по NPV", name: "по названию" };

export default function ProjectsPage() {
  const { projects, model } = useStore();
  const [archived, setArchived] = useState(false);
  const [sort, setSort] = useState<Sort>("updated");
  const [creating, setCreating] = useState(false);

  const list = projects
    .filter((p) => p.archived === archived)
    .sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name, "ru") : sort === "updated" ? b.updatedAt.localeCompare(a.updatedAt) : 0));

  return (
    <>
      <Breadcrumbs items={[{ label: "Проекты" }]} />
      <main className="page wide">
        <div className="page-head">
          <h1>Проекты</h1>
          <div className="row">
            <Link href="/reference" className="btn dark">
              Справочник
            </Link>
            <button className="btn primary" onClick={() => setCreating(true)}>
              + Новый проект
            </button>
          </div>
        </div>
        <div className="toolbar">
          <div className="seg">
            <button className={!archived ? "on" : ""} onClick={() => setArchived(false)}>
              Активные
            </button>
            <button className={archived ? "on" : ""} onClick={() => setArchived(true)}>
              Архив
            </button>
          </div>
          <label className="sort">
            ⇅ Сортировка:
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              {(Object.keys(SORT_LABEL) as Sort[]).map((s) => (
                <option key={s} value={s}>
                  {SORT_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          {sort === "npv" ? <span className="small muted">NPV появится на этапе 6 — порядок пока прежний</span> : null}
        </div>
        {list.length === 0 ? (
          <p className="muted">{archived ? "В архиве пусто." : "Проектов нет — создайте первый."}</p>
        ) : (
          <div className="grid">
            {list.map((p) => (
              <ProjectCard key={p.id} project={p} model={model(p)} />
            ))}
          </div>
        )}
      </main>
      {creating ? <NewProjectModal onClose={() => setCreating(false)} /> : null}
    </>
  );
}
