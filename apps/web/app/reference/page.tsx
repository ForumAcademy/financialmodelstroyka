"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState, type ReactNode } from "react";
import { FORMULA_MODULES, getRegion, spec, type RegionCode } from "@fm/spec";
import { Breadcrumbs } from "@/components/AppShell";
import { usePassport } from "@/components/Passport";
import * as fmt from "@/lib/format";

const TABS = [
  { id: "method", label: "Методика" },
  { id: "norms", label: "Нормативы и ставки" },
  { id: "sources", label: "Источники" },
  { id: "bench", label: "Бенчмарки" },
  { id: "log", label: "Журнал изменений" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function Filters({ q, setQ, children, shown, total, reset }: { q: string; setQ: (s: string) => void; children?: ReactNode; shown: number; total: number; reset: () => void }) {
  return (
    <div className="filters">
      <div className="filters-row">
        <input className="search" placeholder="Поиск по ID и названию…" value={q} onChange={(e) => setQ(e.target.value)} />
        {children}
        <span className="spacer" />
        <span className="small muted">
          Показано {shown} из {total}
        </span>
        <button className="link" onClick={reset}>
          ↺ Сбросить фильтры
        </button>
      </div>
    </div>
  );
}

function Method() {
  const open = usePassport();
  const [q, setQ] = useState("");
  const [module, setModule] = useState("");
  const [status, setStatus] = useState("");
  const list = spec.formulas.filter((f) => (!q || `${f.id} ${f.name}`.toLowerCase().includes(q.toLowerCase())) && (!module || f.module === module) && (!status || f.status === status));
  return (
    <>
      <Filters q={q} setQ={setQ} shown={list.length} total={spec.formulas.length} reset={() => (setQ(""), setModule(""), setStatus(""))}>
        <select value={module} onChange={(e) => setModule(e.target.value)}>
          <option value="">Модуль</option>
          {FORMULA_MODULES.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Статус</option>
          <option value="verified">сверено</option>
          <option value="needs_verification">требует сверки</option>
        </select>
      </Filters>
      <table className="data">
        <thead>
          <tr>
            <th>Формула</th>
            <th>Что считает</th>
            <th>Модуль</th>
            <th>Источники</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          {list.map((f) => (
            <tr key={f.id} className="clickable" onClick={() => open({ id: f.id })}>
              <td>
                <code>{f.id}</code>
              </td>
              <td>{f.name}</td>
              <td>{f.module}</td>
              <td className="small">{f.source_ids.join(", ")}</td>
              <td>
                <span className={`status ${f.status === "verified" ? "st-ok" : "st-check"}`}>{f.status === "verified" ? "сверено" : "требует сверки"}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function Norms() {
  const open = usePassport();
  const [q, setQ] = useState("");
  const [scope, setScope] = useState("");
  const [region, setRegion] = useState<RegionCode>("77");
  const list = spec.parameters.filter((p) => p.scope !== "project" && (!scope || p.scope === scope) && (!q || `${p.id} ${p.name}`.toLowerCase().includes(q.toLowerCase())));
  const r = getRegion(region);
  return (
    <>
      <Filters q={q} setQ={setQ} shown={list.length} total={spec.parameters.filter((p) => p.scope !== "project").length} reset={() => (setQ(""), setScope(""))}>
        <select value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="">Область</option>
          <option value="template">общие (все проекты)</option>
          <option value="region">региональные</option>
        </select>
      </Filters>
      <table className="data">
        <thead>
          <tr>
            <th>Параметр</th>
            <th className="num">Значение</th>
            <th>Ед.</th>
            <th>Источники</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          {list.map((p) => (
            <tr key={p.id} className="clickable" onClick={() => open({ id: p.id })}>
              <td>
                {p.name}
                <div className="small muted">
                  <code>{p.id}</code> · {p.scope === "region" ? "региональный" : "общий"}
                </div>
              </td>
              <td className="num">{p.scope === "region" ? "по региону" : fmt.value(p.default)}</td>
              <td>{fmt.unit(p.unit)}</td>
              <td className="small">{p.source_ids.join(", ")}</td>
              <td>
                <span className={`status ${p.status === "needs_verification" ? "st-check" : "st-ok"}`}>{p.status === "needs_verification" ? "требует сверки" : p.status === "expert_allowed" ? "методолог" : "сверено"}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Справочник региона</h2>
      <select value={region} onChange={(e) => setRegion(e.target.value as RegionCode)}>
        {spec.regions.map((x) => (
          <option key={x.code} value={x.code}>
            {x.code} — {x.name}
          </option>
        ))}
      </select>
      <table className="data">
        <tbody>
          <tr>
            <td>Статус наполнения</td>
            <td>{{ structure_only: "только структура — нормативы вводятся по проекту", reference_partially_filled: "заполнен частично", reference_filled: "заполнен" }[r.status]}</td>
          </tr>
          <tr>
            <td>Коэффициент перехода НЦС (Кпер)</td>
            <td>{r.ncs_k_per ?? "не заполнен — таблица 1 НЦС"}</td>
          </tr>
          <tr>
            <td>Земельный налог</td>
            <td>
              {r.land_tax_level} ·{" "}
              <a href={r.fns_rates_url} target="_blank" rel="noreferrer">
                ставки ФНС по ОКТМО
              </a>
            </td>
          </tr>
          <tr>
            <td>Норматив машино-мест</td>
            <td>{r.parking_norm.values ? r.parking_norm.values.map((v) => `${v.max_area ? `до ${v.max_area} м²` : "больше"} — ${v.per_apt}`).join("; ") : "не заполнен — ручной ввод с документом"}</td>
          </tr>
          <tr>
            <td>Плата за изменение ВРИ</td>
            <td>{r.vri_fee.exists === true ? "есть (формула — ручной ввод до выписки акта)" : r.vri_fee.exists === false ? "нет" : "не определено"}</td>
          </tr>
        </tbody>
      </table>
    </>
  );
}

function Sources({ initial }: { initial: string }) {
  const [q, setQ] = useState(initial);
  const [level, setLevel] = useState("");
  const [verified, setVerified] = useState("");
  const usage = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of [...spec.parameters, ...spec.formulas]) for (const id of x.source_ids) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }, []);
  const all = spec.sources.filter((s) => s.scope === "global");
  const list = all.filter((s) => (!q || `${s.id} ${s.title}`.toLowerCase().includes(q.toLowerCase())) && (!level || String(s.level) === level) && (!verified || (verified === "yes" ? s.verified === true : s.verified === false)));
  return (
    <>
      <Filters q={q} setQ={setQ} shown={list.length} total={all.length} reset={() => (setQ(""), setLevel(""), setVerified(""))}>
        <select value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="">Уровень</option>
          {[1, 2, 3, 4].map((l) => (
            <option key={l} value={l}>
              уровень {l}
            </option>
          ))}
        </select>
        <select value={verified} onChange={(e) => setVerified(e.target.value)}>
          <option value="">Сверка</option>
          <option value="yes">сверен</option>
          <option value="no">не сверен</option>
        </select>
      </Filters>
      <table className="data">
        <thead>
          <tr>
            <th>Ур.</th>
            <th>Источник</th>
            <th>Для чего</th>
            <th>Проверено</th>
            <th>Сверен</th>
            <th className="num">Ссылок</th>
          </tr>
        </thead>
        <tbody>
          {list.map((s) => (
            <tr key={s.id}>
              <td>
                <span className={`lvl lvl${s.level}`}>{s.level}</span>
              </td>
              <td>
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.title}
                  </a>
                ) : (
                  s.title
                )}
                <div className="small muted">
                  <code>{s.id}</code>
                  {s.note ? ` · ${s.note}` : ""}
                </div>
              </td>
              <td className="small">{s.used_for}</td>
              <td>{fmt.date(s.accessed)}</td>
              <td>{s.verified ? <span className="status st-ok">да</span> : s.verified === false ? <span className="status st-check">нет</span> : "—"}</td>
              <td className="num">{usage.get(s.id) ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small muted">Проектные источники (ГПЗУ, ППТ, ТЭП, договоры, term sheet, экспертные оценки) хранятся внутри проектов и здесь не показываются.</p>
    </>
  );
}

function ReferencePage() {
  const search = useSearchParams();
  const router = useRouter();
  const tab = (TABS.find((t) => t.id === search.get("tab"))?.id ?? "method") as TabId;
  return (
    <>
      <Breadcrumbs items={[{ label: "Справочник", href: "/reference" }, { label: TABS.find((t) => t.id === tab)!.label }]} />
      <main className="page wide">
        <div className="page-head">
          <div>
            <h1>Справочник</h1>
            <p className="muted small">
              Общий для всех проектов. Версия {spec.specVersion}, актуализирован {fmt.date(spec.actualizedAt)} · формул {spec.formulas.length}, параметров {spec.parameters.length}, источников {spec.sources.length}, регионов {spec.regions.length}
            </p>
          </div>
        </div>
        <nav className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => router.replace(`/reference?tab=${t.id}`, { scroll: false })}>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="panel">
          {tab === "method" ? <Method /> : null}
          {tab === "norms" ? <Norms /> : null}
          {tab === "sources" ? <Sources initial={search.get("q") ?? ""} /> : null}
          {tab === "bench" ? (
            <div className="placeholder">
              <h2>Бенчмарки</h2>
              <p className="muted">Расценки компании и аналоги рынка с выборками и статистикой — этап 11. Правила статистики уже в методике: модуль BENCH (медиана / средневзвешенная, окна данных, выбросы).</p>
            </div>
          ) : null}
          {tab === "log" ? (
            <div className="placeholder">
              <h2>Журнал изменений</h2>
              <p>
                Текущая версия справочника: <code>{spec.specVersion}</code> от {fmt.date(spec.actualizedAt)}.
              </p>
              <p className="muted">История версий с обоснованиями и затронутыми проектами — этап 10; журнал правок методолога — этап 12. Изменения справочника сейчас видны в истории репозитория (PR).</p>
            </div>
          ) : null}
        </div>
      </main>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<main className="page">Загрузка…</main>}>
      <ReferencePage />
    </Suspense>
  );
}
