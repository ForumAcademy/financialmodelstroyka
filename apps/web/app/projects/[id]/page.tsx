"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useHow } from "@/components/HowPanel";
import { BudgetTab } from "@/components/tabs/BudgetTab";
import { CashflowTab, DashboardTab, EscrowTab, SalesTab } from "@/components/tabs/FlowTabs";
import { TepTab } from "@/components/tabs/TepTab";
import { exportProject } from "@/lib/excel-export";
import { regionName } from "@/lib/format";
import { useStore } from "@/lib/store";

const TABS = [
  { id: "tep", label: "ТЭП" },
  { id: "budget", label: "Бюджет" },
  { id: "sales", label: "План продаж" },
  { id: "escrow", label: "Эскроу" },
  { id: "cf", label: "CF" },
  { id: "dashboard", label: "Дашборд" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { projects, model } = useStore();
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
  const tab = (TABS.find((t) => t.id === search.get("tab"))?.id ?? "tep") as TabId;

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
              await exportProject(project);
            } finally {
              setExporting(false);
            }
          }}
        >
          Выгрузить в Excel
        </button>
      </div>
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => router.replace(`/projects/${project.id}?tab=${t.id}`, { scroll: false })}>
            {t.label}
          </button>
        ))}
      </nav>
      <div className="sheet-page">
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
