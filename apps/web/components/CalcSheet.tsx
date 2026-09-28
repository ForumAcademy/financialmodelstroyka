"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { cell, periodLabel, rowByPeriod, SCALE, type CalcSheet } from "@/lib/calc-sheets";
import { PERIOD_LABEL, type Period } from "@/lib/model";
import { sectionHref } from "@/lib/project-nav";

const PERIODS: Period[] = ["year", "quarter", "month"];

/** Переключатель «Год / Квартал / Месяц»: один на все листы, под заголовком слева. */
export function PeriodSwitch({ period, setPeriod }: { period: Period; setPeriod: (p: Period) => void }) {
  return (
    <div className="calc-bar">
      <div className="seg">
        {PERIODS.map((p) => (
          <button key={p} className={period === p ? "on" : ""} onClick={() => setPeriod(p)}>
            {PERIOD_LABEL[p]}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Лист расчёта: только просмотр. Клик по строке раскрывает под ней пояснение. */
export function CalcSheetView({ sheet, period, projectId }: { sheet: CalcSheet; period: Period; projectId: string }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!sheet.ready || !sheet.dates.length) return <p className="stage-note">Ещё не рассчитывается.</p>;
  const keys = rowByPeriod(sheet.rows[0]!, sheet.dates, period).keys;
  const cols = keys.length + 2;
  return (
    <div className="hscroll">
      <table className="sheet calc-table calc-sheet">
        <thead>
          <tr>
            <th className="sticky">{SCALE[period].unit}</th>
            <th className="num">Итого</th>
            {keys.map((k) => (
              <th key={k} className="num">
                {periodLabel(k, period)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sheet.rows.map((row, i) => {
            const isOpen = open === i;
            const toggle = () => setOpen(isOpen ? null : i);
            const caret = <span className="caret">{isOpen ? "▾" : "▸"}</span>;
            if (!row.series) {
              return (
                <Fragment key={row.label}>
                  <tr className="row pending" onClick={toggle}>
                    <td className="sticky">
                      {caret}
                      {row.label}
                    </td>
                    <td colSpan={cols - 1} className="pending-note">
                      Ещё не рассчитывается
                    </td>
                  </tr>
                  {isOpen ? <Explain row={row} cols={cols} projectId={projectId} /> : null}
                </Fragment>
              );
            }
            const r = rowByPeriod(row, sheet.dates, period);
            const text = (v: number) => cell(v, period);
            return (
              <Fragment key={row.label}>
                <tr className={`row ${row.total ? "total" : ""} ${isOpen ? "open" : ""}`} onClick={toggle}>
                  <td className="sticky">
                    {caret}
                    {row.label}
                  </td>
                  <td className="num">{r.total === null ? "" : text(r.total)}</td>
                  {r.values.map((v, j) => (
                    <td key={keys[j]} className="num">
                      {text(v)}
                    </td>
                  ))}
                </tr>
                {isOpen ? <Explain row={row} cols={cols} projectId={projectId} /> : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Explain({ row, cols, projectId }: { row: CalcSheet["rows"][number]; cols: number; projectId: string }) {
  return (
    <tr className="expl">
      <td colSpan={cols}>
        <div className="xbox">
          <div>
            <b>Как считается.</b> {row.how}
          </div>
          {row.series && row.example ? (
            <div>
              <b>На цифрах проекта.</b> {row.example}
            </div>
          ) : null}
          {row.links.length ? (
            <div>
              <b>Из каких данных:</b>{" "}
              {row.links.map((l, i) => (
                <Fragment key={`${l.step}-${l.tab}-${l.field ?? ""}`}>
                  {i ? " · " : ""}
                  <Link href={sectionHref(projectId, l.step, { t: l.tab, ...(l.field ? { field: l.field } : {}) })}>{l.label}</Link>
                </Fragment>
              ))}
            </div>
          ) : null}
          {row.formula ? (
            <div>
              <Link href={`/formulas?id=${encodeURIComponent(row.formula)}`}>Формула в справочнике →</Link>
            </div>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
