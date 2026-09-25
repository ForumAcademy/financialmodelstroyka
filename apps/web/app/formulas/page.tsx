"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { getSource, spec, type SpecFormula } from "@fm/spec";

/** Разделы — как вкладки проекта (листы Excel). */
const SECTIONS: { title: string; modules: string[] }[] = [
  { title: "ТЭП", modules: ["TEP"] },
  { title: "Бюджет", modules: ["LAND", "CAPEX"] },
  { title: "План продаж", modules: ["SALES", "BENCH"] },
  { title: "Эскроу", modules: ["ESCROW"] },
  { title: "CF", modules: ["TIME", "FIN", "TAX", "CF"] },
  { title: "Дашборд", modules: ["KPI", "CHECK"] },
];

function Formula({ f, open }: { f: SpecFormula; open: boolean }) {
  const usedBy = spec.formulas.filter((x) => (x.depends_on as string[]).includes(f.id));
  return (
    <details id={f.id} className="formula" open={open}>
      <summary>
        <span className="f-name">{f.name}</span>
        <code className="muted">{f.id}</code>
      </summary>
      <div className="f-body">
        <h3>Формула</h3>
        <pre className="expr">{f.expr.trim()}</pre>
        <h3>Почему так</h3>
        <p>{f.rationale}</p>
        {f.rejected.length ? (
          <>
            <h3>Что отклонено</h3>
            <ul>
              {f.rejected.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </>
        ) : null}
        <h3>Источники</h3>
        <ul>
          {f.source_ids.map((id) => {
            const s = getSource(id);
            return (
              <li key={id}>
                <span className={`lvl lvl${s.level}`}>{s.level}</span>{" "}
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.title}
                  </a>
                ) : (
                  s.title
                )}
              </li>
            );
          })}
        </ul>
        <h3>Где используется</h3>
        {usedBy.length ? (
          <ul>
            {usedBy.map((x) => (
              <li key={x.id}>
                <a href={`#${x.id}`}>{x.name}</a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Итоговый показатель — на него ссылаются отчёты и дашборд.</p>
        )}
      </div>
    </details>
  );
}

function FormulasPage() {
  const search = useSearchParams();
  const target = search.get("id");
  const [q, setQ] = useState("");
  useEffect(() => {
    if (target) document.getElementById(target)?.scrollIntoView({ block: "start" });
  }, [target]);
  const match = (f: SpecFormula) => !q || `${f.id} ${f.name} ${f.expr}`.toLowerCase().includes(q.toLowerCase());
  return (
    <main className="page">
      <div className="page-head">
        <h1>Формулы</h1>
      </div>
      <div className="toolbar">
        <input className="search" placeholder="Поиск по названию и формуле…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {SECTIONS.map((s) => {
        const list = spec.formulas.filter((f) => s.modules.includes(f.module) && match(f));
        if (!list.length) return null;
        return (
          <section key={s.title} className="formula-section">
            <h2>{s.title}</h2>
            {list.map((f) => (
              <Formula key={f.id} f={f} open={f.id === target || (!!q && list.length <= 3)} />
            ))}
          </section>
        );
      })}
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<main className="page">Загрузка…</main>}>
      <FormulasPage />
    </Suspense>
  );
}
