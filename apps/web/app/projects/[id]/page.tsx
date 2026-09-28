"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useHow } from "@/components/HowPanel";
import { BudgetTab } from "@/components/tabs/BudgetTab";
import { CashflowTab, DashboardTab, EscrowTab, SalesTab } from "@/components/tabs/FlowTabs";
import { DocumentsTab } from "@/components/tabs/DocumentsTab";
import { AssumptionsUpdate } from "@/components/AssumptionsUpdate";
import { CompatBanner, DiscrepanciesTab, ModeSwitch } from "@/components/CompatWarnings";
import { inputTabCount, issueSummary, issuesBannerText, issuesTabCount, type TabCount } from "@/lib/issues";
import { Hint } from "@/components/Hint";
import { tabCount, tabMissing, tabOfParam, type InputTab } from "@/lib/tab-inputs";
import { unconfirmedStandard } from "@/lib/standard";
import { getParameter } from "@fm/spec";
import { TepTab } from "@/components/tabs/TepTab";
import { exportProject } from "@/lib/excel-export";
import { regionName } from "@/lib/format";
import { projectQuestions } from "@/lib/model";
import { useStore } from "@/lib/store";

const TABS = [
  { id: "issues", label: "Расхождения" },
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
  const { projects, model, sourceChecks, assumptions } = useStore();
  const { setProject } = useHow();
  const [exporting, setExporting] = useState(false);
  const [showUnconfirmed, setShowUnconfirmed] = useState(false);
  const project = projects.find((p) => p.id === id);
  useEffect(() => {
    setProject(project ? project.id : null);
    return () => setProject(null);
  }, [project, setProject]);

  // Переход к полю из строки «Не подтверждено стандартных значений»: ?tab=<вкладка>&field=<параметр>
  const field = search.get("field");
  useEffect(() => {
    if (!field) return;
    const t = setTimeout(() => {
      const el = document.getElementById(`field-${field}`);
      if (!el) return;
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      el.classList.add("row-flash");
    }, 100);
    return () => clearTimeout(t);
  }, [field]);

  // Переход из панели «Как посчитано» к строке плана продаж: ?tab=sales&row=<продукт>
  const row = search.get("row");
  useEffect(() => {
    if (!row) return;
    const t = setTimeout(() => {
      const el = document.querySelector(`table[data-param="SALES.PACE"] tr[data-row="${CSS.escape(row)}"]`);
      if (!el) return;
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      el.classList.add("row-flash");
    }, 100);
    return () => clearTimeout(t);
  }, [row]);

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
  const questions = projectQuestions(project, m);
  // Одна сводка для заголовка вкладки «Расхождения» и плашки над вкладками
  const summary = issueSummary(project, questions);
  const banner = issuesBannerText(project, summary);
  const tabs = TABS.filter((t) => t.id !== "issues" || summary.shown);
  const tab = (tabs.find((t) => t.id === search.get("tab"))?.id ?? "tep") as TabId;
  const unconfirmed = unconfirmedStandard(project, assumptions);
  // Счётчик на вкладке — только число с цветом («ТЭП 7»), подробности — в подсказке
  const count = (t: (typeof TABS)[number]): TabCount | null =>
    t.id === "issues" ? issuesTabCount(summary) : t.id === "docs" ? null : inputTabCount(tabMissing(t.id as InputTab, project, m), tabCount(t.id as InputTab, project, unconfirmed));
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
      {project.legacyCase ? <ModeSwitch project={project} /> : null}
      <AssumptionsUpdate project={project} />
      {tab === "issues" || !banner ? null : <CompatBanner text={banner} go={() => go("issues", view)} />}
      {unconfirmed.length ? (
        <div className="standard-line small">
          Подтвердите стандарт: {unconfirmed.length}.{" "}
          <button className="linklike" onClick={() => setShowUnconfirmed(!showUnconfirmed)}>
            {showUnconfirmed ? "Скрыть" : "Показать"}
          </button>
          {showUnconfirmed ? <br /> : null}
          {showUnconfirmed && unconfirmed.map((id, k) => {
            const t = tabOfParam(project, id);
            return (
              <span key={id}>
                {k ? ", " : ""}
                {t ? (
                  <button className="linklike" onClick={() => router.replace(`/projects/${project.id}?tab=${t}&field=${id}`, { scroll: false })}>
                    {getParameter(id).name}
                  </button>
                ) : (
                  getParameter(id).name
                )}
              </span>
            );
          })}
        </div>
      ) : null}
      <nav className="tabs">
        {tabs.map((t) => (
          <TabButton key={t.id} label={t.label} count={count(t)} on={tab === t.id} onClick={() => go(t.id, view)} />
        ))}
      </nav>
      <div className="sheet-page" data-view={view}>
        {tab === "docs" ? <DocumentsTab project={project} /> : null}
        {tab === "issues" ? <DiscrepanciesTab project={project} questions={questions} go={(t) => go(t, "calc")} /> : null}
        <div className="view-switch" hidden={tab === "docs" || tab === "issues"}>
          <div className="seg">
            <button className={view === "inputs" ? "on" : ""} onClick={() => go(tab, "inputs")}>
              Вводные
            </button>
            <button className={view === "calc" ? "on" : ""} onClick={() => go(tab, "calc")}>
              Расчёт
            </button>
          </div>
          {view === "calc" ? <span className="small muted">Нажмите на строку — формула и источники</span> : null}
          <Hint text={HELP} />
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

/** Справка по виду полей — один раз, у переключателя «Вводные | Расчёт». */
const HELP =
  "Голубые поля можно менять. «Заполните» — обязательное значение не введено, без него часть расчёта не выполняется. «Стандарт» — значение из справочника компании: подтвердите его или замените. Число на вкладке — сколько полей ждут действия. Нажмите на название поля или строку расчёта — откроется, как посчитано и откуда значение.";

function TabButton({ label, count, on, onClick }: { label: string; count: TabCount | null; on: boolean; onClick: () => void }) {
  return (
    <button className={on ? "on" : ""} onClick={onClick} title={count?.title}>
      {label}
      {count ? <span className={`tab-count tc-${count.tone}`}>{count.tone === "ok" ? "✓" : count.n}</span> : null}
    </button>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<main className="page">Загрузка…</main>}>
      <ProjectPage />
    </Suspense>
  );
}
