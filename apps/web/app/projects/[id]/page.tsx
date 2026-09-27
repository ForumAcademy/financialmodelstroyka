"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useHow } from "@/components/HowPanel";
import { BudgetTab } from "@/components/tabs/BudgetTab";
import { CashflowTab, DashboardTab, EscrowTab, SalesTab } from "@/components/tabs/FlowTabs";
import { DocumentsTab } from "@/components/tabs/DocumentsTab";
import { CompatBanner, DiscrepanciesTab } from "@/components/CompatWarnings";
import { TepTab } from "@/components/tabs/TepTab";
import { exportProject } from "@/lib/excel-export";
import { regionName } from "@/lib/format";
import { compatWarnings } from "@/lib/model";
import { useStore } from "@/lib/store";

const TABS = [
  { id: "issues", label: "Расхождения с Excel" },
  { id: "tep", label: "ТЭП" },
  { id: "budget", label: "Бюджет" },
  { id: "sales", label: "План продаж" },
  { id: "escrow", label: "Эскроу" },
  { id: "cf", label: "CF" },
  { id: "dashboard", label: "Дашборд" },
  { id: "docs", label: "Документы" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { projects, model, sourceChecks } = useStore();
  const { setProject } = useHow();
  const [exporting, setExporting] = useState(false);
  const project = projects.find((p) => p.id === id);
  useEffect(() => {
    setProject(project ? project.id : null);
    return () => setProject(null);
  }, [project, setProject]);

  if (!project) {
    return (
      <main className="page">
        <h1>Проект не найден</h1>
        <p className="muted">В демо-режиме проекты хранятся до перезагрузки страницы.</p>
        <Link href="/">← К проектам</Link>
      </main>
    );
  }
  const m = model(project);
  const warnings = compatWarnings(project, m);
  const tab = (TABS.find((t) => t.id === search.get("tab"))?.id ?? "tep") as TabId;
  const view = search.get("view") === "calc" ? "calc" : "inputs";
  const go = (t: TabId, v: string) => router.replace(`/projects/${project.id}?tab=${t}${v === "calc" ? "&view=calc" : ""}`, { scroll: false });

  return (
    <main className="page wide">
      <div className="project-head">
        <div>
          <h1>{project.name}</h1>
          <div className="meta">
            {regionName(project)} · {String(project.input.values["GEN.PROJECT_STAGE"] ?? "стадия не указана")}
          </div>
        </div>
        <button
          className="btn"
          disabled={exporting}
          onClick={async () => {
            setExporting(true);
            try {
              await exportProject(project, sourceChecks);
            } finally {
              setExporting(false);
            }
          }}
        >
          Выгрузить в Excel
        </button>
      </div>
      {tab === "issues" ? null : <CompatBanner count={warnings.length} open={() => go("issues", view)} />}
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => go(t.id, view)}>
            {t.label}
            {t.id === "issues" && warnings.length ? <span className="tab-count">{warnings.length}</span> : null}
          </button>
        ))}
      </nav>
      <div className="sheet-page" data-view={view}>
        {tab === "docs" ? <DocumentsTab project={project} /> : null}
        {tab === "issues" ? <DiscrepanciesTab warnings={warnings} legacy={project.input.mode === "legacy"} go={(t) => go(t, "calc")} /> : null}
        <div className="view-switch" hidden={tab === "docs" || tab === "issues"}>
          <div className="seg">
            <button className={view === "inputs" ? "on" : ""} onClick={() => go(tab, "inputs")}>
              Вводные
            </button>
            <button className={view === "calc" ? "on" : ""} onClick={() => go(tab, "calc")}>
              Расчёт
            </button>
          </div>
          <span className="small muted">{view === "inputs" ? "Исходные данные листа: голубые поля можно менять" : "Что посчитано из вводных. Нажмите на строку, чтобы увидеть формулу и источники"}</span>
        </div>
        {tab === "tep" ? <TepTab project={project} model={m} /> : null}
        {tab === "budget" ? <BudgetTab project={project} model={m} /> : null}
        {tab === "sales" ? <SalesTab project={project} model={m} /> : null}
        {tab === "escrow" ? <EscrowTab project={project} model={m} /> : null}
        {tab === "cf" ? <CashflowTab project={project} model={m} /> : null}
        {tab === "dashboard" ? <DashboardTab project={project} model={m} /> : null}
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<main className="page">Загрузка…</main>}>
      <ProjectPage />
    </Suspense>
  );
}
