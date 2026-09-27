"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, Suspense, useEffect, useState } from "react";
import { getFormula, getParameter, getSource, isFormulaId, isParameterId, spec, type SpecFormula } from "@fm/spec";
import { unit } from "@/lib/format";

/** Разделы — как вкладки проекта (листы Excel). */
const SECTIONS: { title: string; modules: string[] }[] = [
  { title: "ТЭП", modules: ["TEP"] },
  { title: "Бюджет", modules: ["LAND", "CAPEX"] },
  { title: "План продаж", modules: ["SALES", "BENCH"] },
  { title: "Эскроу", modules: ["ESCROW"] },
  { title: "CF", modules: ["TIME", "FIN", "TAX", "CF"] },
  { title: "Дашборд", modules: ["KPI", "CHECK"] },
];

/** Расшифровка обозначения из формулы: вводное значение или результат другой формулы. */
function Term({ id }: { id: string }) {
  if (isParameterId(id)) {
    const p = getParameter(id);
    return (
      <li>
        <code>{id}</code> — {p.name}
        {p.unit && !["текст", "enum", "bool", "дата", "table", "text"].includes(p.unit) && p.kind !== "enum" && p.kind !== "table" ? <span className="muted">, {unit(p.unit)}</span> : null} <span className="term-kind">вводное</span>
      </li>
    );
  }
  if (isFormulaId(id)) {
    const f = getFormula(id);
    return (
      <li>
        <code>{id}</code> — <Link href={`/formulas?id=${id}`} scroll={false}>{f.name}</Link>
        {f.unit ? <span className="muted">, {unit(f.unit)}</span> : null} <span className="term-kind calc">расчёт</span>
      </li>
    );
  }
  return (
    <li>
      <code>{id}</code>
    </li>
  );
}

function Details({ f }: { f: SpecFormula }) {
  const usedBy = spec.formulas.filter((x) => (x.depends_on as string[]).includes(f.id));
  return (
    <div className="f-body">
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
              <Link href={`/formulas?id=${x.id}`} scroll={false}>{x.name}</Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Итоговый показатель — на него ссылаются отчёты и дашборд.</p>
      )}
    </div>
  );
}

function FormulasPage() {
  const search = useSearchParams();
  const router = useRouter();
  const target = search.get("id");
  const targetSection = target ? SECTIONS.find((s) => spec.formulas.some((f) => f.id === target && s.modules.includes(f.module)))?.title : undefined;
  const [section, setSection] = useState(targetSection ?? SECTIONS[0]!.title);
  const [openId, setOpenId] = useState<string | null>(target);
  const [q, setQ] = useState("");
  useEffect(() => {
    if (!target) return;
    if (targetSection) setSection(targetSection);
    setOpenId(target);
    setTimeout(() => document.getElementById(target)?.scrollIntoView({ block: "center" }), 50);
  }, [target, targetSection]);

  const match = (f: SpecFormula) => {
    if (!q) return true;
    const terms = (f.depends_on as string[]).map((id) => (isParameterId(id) ? getParameter(id).name : isFormulaId(id) ? getFormula(id).name : id)).join(" ");
    return `${f.id} ${f.name} ${f.expr} ${f.note ?? ""} ${Object.values(f.terms ?? {}).join(" ")} ${terms}`.toLowerCase().includes(q.toLowerCase());
  };
  const inSection = (title: string) => spec.formulas.filter((f) => SECTIONS.find((s) => s.title === title)!.modules.includes(f.module) && match(f));
  const list = inSection(section);

  return (
    <main className="page wide">
      <div className="page-head">
        <h1>Формулы</h1>
      </div>
      <div className="toolbar">
        <input className="search" placeholder="Поиск по названию, формуле и обозначениям…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <nav className="tabs">
        {SECTIONS.map((s) => (
          <button key={s.title} className={section === s.title ? "on" : ""} onClick={() => (setSection(s.title), target && router.replace("/formulas", { scroll: false }))}>
            {s.title} <span className="block-count">{inSection(s.title).length}</span>
          </button>
        ))}
      </nav>
      <div className="sheet-page">
        <p className="small muted" style={{ margin: 0 }}>
          Нажмите на строку, чтобы увидеть обоснование, отклонённые варианты, источники и где используется формула. В колонке «Формула» — только математика; пояснения, обозначения и значения из модели — в расшифровке. «Вводное» — значение, которое вводится в проекте или берётся из справочника; «расчёт» — результат другой формулы.
        </p>
        <div className="hscroll">
          <table className="sheet formulas-table">
            <thead>
              <tr>
                <th>Показатель</th>
                <th>Формула</th>
                <th>Что в формуле (расшифровка)</th>
              </tr>
            </thead>
            <tbody>
              {list.map((f) => (
                <Fragment key={f.id}>
                  <tr id={f.id} className={`clickable ${openId === f.id ? "open" : ""}`} onClick={() => setOpenId(openId === f.id ? null : f.id)}>
                    <td>
                      <div className="f-name">{f.name}</div>
                      <code className="muted small">{f.id}</code>
                      {f.unit ? <div className="small muted">{unit(f.unit)}</div> : null}
                    </td>
                    <td>
                      <pre className="expr">{f.expr.trim()}</pre>
                    </td>
                    <td>
                      {f.note ? <p className="formula-note">{f.note}</p> : null}
                      {f.terms && Object.keys(f.terms).length ? (
                        <>
                          <div className="terms-title">Обозначения</div>
                          <ul className="terms">
                            {Object.entries(f.terms).map(([k, v]) => (
                              <li key={k}>
                                <code>{k}</code> — {v}
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : null}
                      <div className="terms-title">Значения из модели</div>
                      <ul className="terms">
                        {(f.depends_on as string[]).length === 0 ? <li className="muted">—</li> : null}
                        {(f.depends_on as string[]).map((id) => (
                          <Term key={id} id={id} />
                        ))}
                      </ul>
                    </td>
                  </tr>
                  {openId === f.id ? (
                    <tr className="details-row">
                      <td colSpan={3}>
                        <Details f={f} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
              {list.length === 0 ? (
                <tr>
                  <td colSpan={3} className="muted">
                    Ничего не найдено в этом разделе
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
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
