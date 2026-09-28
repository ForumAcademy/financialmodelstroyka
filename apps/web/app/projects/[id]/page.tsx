"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useHow } from "@/components/HowPanel";
import { Inputs } from "@/components/Sheet";
import { BudgetTab } from "@/components/tabs/BudgetTab";
import { CashflowTab, DashboardTab, EscrowTab, SalesTab } from "@/components/tabs/FlowTabs";
import { DocumentsTab } from "@/components/tabs/DocumentsTab";
import { TepCalc } from "@/components/tabs/TepTab";
import { AssumptionsUpdate } from "@/components/AssumptionsUpdate";
import { DiscrepanciesTab, ModeSwitch } from "@/components/CompatWarnings";
import { NavLayout, type NavEntry, type Tone } from "@/components/ProjectNav";
import { issueSummary } from "@/lib/issues";
import { firstMissing, inputSteps, inputsMissing, placeOfParam, SECTION_OF_TAB, sectionHref, SHEETS, stepMissing, type SectionId } from "@/lib/project-nav";
import { exportProject } from "@/lib/excel-export";
import { housingClass, plural, regionName } from "@/lib/format";
import { projectQuestions } from "@/lib/model";
import { useStore } from "@/lib/store";
import type { InputTab } from "@/lib/tab-inputs";
import type { ParameterId } from "@fm/spec";

/** Прежние адреса «?tab=…&view=…» (ссылки из панелей «Как посчитано») ведут в новый раздел. */
function sectionFromSearch(search: URLSearchParams): SectionId | null {
  const s = search.get("s");
  if (s) return s as SectionId;
  const tab = search.get("tab");
  if (tab === "docs" || tab === "issues") return tab;
  if (tab && tab in SECTION_OF_TAB) return SECTION_OF_TAB[tab as InputTab];
  return null;
}

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

  // Переход к полю: ?s=<шаг>&t=<вкладка>&field=<параметр>
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

  // Переход из панели «Как посчитано» к строке плана продаж: ?s=sales&row=<продукт>
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
        <p className="muted">Проекты хранятся до перезагрузки страницы.</p>
        <Link href="/">← Все проекты</Link>
      </main>
    );
  }
  const m = model(project);
  const questions = projectQuestions(project, m);
  const summary = issueSummary(project, questions);
  const steps = inputSteps(project);
  const missing = inputsMissing(project, m);
  const first = firstMissing(project, m);

  // Поле из ссылки «?field=» без шага — открываем шаг, где оно стоит.
  const fieldPlace = field ? placeOfParam(project, field as ParameterId) : null;
  const requested = sectionFromSearch(search) ?? fieldPlace?.step ?? "site";
  const section: SectionId = requested === "issues" && !summary.shown ? "site" : requested;
  const go = (s: string, extra: Record<string, string | number> = {}) => router.replace(sectionHref(project.id, s as SectionId, extra), { scroll: false });

  const stepStatus = (n: number): [string, Tone] => (n ? [`нет ${n}`, "need"] : ["✓", "done"]);
  const entries: NavEntry[] = [
    {
      group: {
        id: "inputs",
        title: "Вводные показатели",
        icon: "✎",
        short: "Вводные",
        status: missing ? `нет ${missing}` : undefined,
        tone: missing ? "need" : "done",
        items: steps.map((s) => {
          const [status, tone] = stepStatus(stepMissing(s, m));
          return { id: s.id, mark: String(s.n), title: s.title, status, tone };
        }),
      },
    },
    { group: { id: "calc", title: "Расчёт", icon: "Σ", short: "Расчёт", items: SHEETS.map((s) => ({ id: s.id, mark: "·", title: s.title })) } },
    { divider: true },
    { item: { id: "dashboard", mark: "★", title: "Дашборд", icon: "★", short: "Дашборд" } },
    { item: { id: "docs", mark: "▤", title: "Документы проекта", icon: "▤", short: "Документы" } },
    ...(summary.shown
      ? [{ item: { id: "issues", mark: "⇄", title: "Расхождения с Excel", status: summary.open ? String(summary.open) : "✓", tone: (summary.open ? "bad" : "done") as Tone, icon: "⇄", short: "Расхождения" } }]
      : []),
  ];

  const step = steps.find((s) => s.id === section);
  const tRaw = Number(search.get("t") ?? fieldPlace?.tab ?? 0) || 0;
  // У ТЭП после вкладок полей — «Итоги площадей» (что посчитано из вводных).
  const tepTotals = step?.id === "tep" && tRaw === step.tabs.length;
  const tabIndex = tepTotals ? tRaw : Math.min(tRaw, (step?.tabs.length ?? 1) - 1);

  return (
    <div className="shell">
      <header className="card-head">
        <Link href="/" className="back">
          ← Все проекты
        </Link>
        <h1>{project.name}</h1>
        <span className="meta">
          {[project.input.values["GEN.REGION_CODE"] ? regionName(project) : null, housingClass(project)].filter(Boolean).join(" · ")}
        </span>
        <span className="sp" />
        {first ? (
          <button className="chip warn" onClick={() => go(first.step, { t: first.tab, field: first.id })}>
            Не хватает {missing} {plural(missing, ["значения", "значений", "значений"])}
          </button>
        ) : null}
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
      </header>
      <NavLayout entries={entries} active={section} go={(s) => go(s)}>
        <AssumptionsUpdate project={project} />
        {step ? (
          <>
            <div className="work-head">
              <h2>{step.title}</h2>
              <p>{step.hint}</p>
            </div>
            <nav className="work-tabs">
              {step.tabs.map((g, k) => (
                <button key={g.title} className={k === tabIndex ? "on" : ""} onClick={() => go(step.id, { t: k })}>
                  {g.title}
                  {g.params.some((p) => m.missing.has(p)) ? <i className="dot dot-need" /> : null}
                </button>
              ))}
              {step.id === "tep" ? (
                <button className={tabIndex === step.tabs.length ? "on" : ""} onClick={() => go(step.id, { t: step.tabs.length })}>
                  Итоги площадей
                </button>
              ) : null}
            </nav>
            {tepTotals ? (
              <TepCalc project={project} model={m} />
            ) : (
              <Inputs project={project} model={m} groups={[step.tabs[tabIndex]!]} bare />
            )}
          </>
        ) : null}
        {SHEETS.some((s) => s.id === section) ? (
          <>
            <div className="work-head">
              <h2>{SHEETS.find((s) => s.id === section)!.title}</h2>
            </div>
            <div className="sheet-page" data-view="calc">
              {section === "sales" ? <SalesTab project={project} model={m} /> : null}
              {section === "budget" ? <BudgetTab project={project} model={m} /> : null}
              {section === "escrow" ? <EscrowTab project={project} model={m} /> : null}
              {section === "cf" ? <CashflowTab project={project} model={m} /> : null}
            </div>
          </>
        ) : null}
        {section === "dashboard" ? (
          <>
            <div className="work-head">
              <h2>Дашборд</h2>
            </div>
            <div className="sheet-page" data-view="calc">
              <DashboardTab project={project} model={m} />
            </div>
          </>
        ) : null}
        {section === "docs" ? (
          <>
            <div className="work-head">
              <h2>Документы проекта</h2>
            </div>
            <DocumentsTab project={project} />
          </>
        ) : null}
        {section === "issues" ? (
          <>
            <div className="work-head">
              <h2>Расхождения с Excel</h2>
            </div>
            <ModeSwitch project={project} />
            <DiscrepanciesTab project={project} questions={questions} go={(t) => go(SECTION_OF_TAB[t])} />
          </>
        ) : null}
      </NavLayout>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<main className="page">Загрузка…</main>}>
      <ProjectPage />
    </Suspense>
  );
}
