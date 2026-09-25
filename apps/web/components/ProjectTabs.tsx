"use client";

import { useState } from "react";
import Decimal from "decimal.js";
import { getFormula, spec, type FormulaId } from "@fm/spec";
import { usePassport } from "./Passport";
import type { ProjectModel } from "@/lib/model";
import type { DemoProject } from "@/lib/types";
import * as fmt from "@/lib/format";

/** Вкладка модуля, который ещё не реализован: что будет посчитано и на каком этапе. */
export function ModulePlaceholder({ modules, stage, title, model, project }: { modules: string[]; stage: number; title: string; model: ProjectModel; project: DemoProject }) {
  const open = usePassport();
  const formulas = spec.formulas.filter((f) => modules.includes(f.module));
  return (
    <div className="placeholder">
      <h2>{title}</h2>
      <p className="muted">
        Расчёт появится на этапе {stage}. Ниже — формулы справочника, по которым он будет выполнен; по клику — паспорт формулы с обоснованием и источниками.
      </p>
      <table className="data">
        <thead>
          <tr>
            <th>Формула</th>
            <th>Что считает</th>
            <th>Ед.</th>
          </tr>
        </thead>
        <tbody>
          {formulas.map((f) => (
            <tr key={f.id} className="clickable" onClick={() => open({ id: f.id, result: model.result, project })}>
              <td>
                <code>{f.id}</code>
              </td>
              <td>{f.name}</td>
              <td>{fmt.unit(f.unit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Period = "month" | "quarter" | "year";
const PERIOD_LABEL: Record<Period, string> = { month: "Месяц", quarter: "Квартал", year: "Год" };

/** Денежный поток: пока доступны временная шкала, флаги периодов и земельный налог. */
export function CashflowTab({ model, project }: { model: ProjectModel; project: DemoProject }) {
  const open = usePassport();
  const [period, setPeriod] = useState<Period>("quarter");
  const dates = model.result.formulas["F.TIME.DATE"]?.value as string[] | undefined;
  if (!dates) {
    return (
      <div className="placeholder">
        <h2>Денежный поток</h2>
        <p className="muted">Нет временной шкалы: заполните дату начала модели и вехи очередей (вкладка «График проекта»). Денежный поток целиком — этап 6.</p>
      </div>
    );
  }
  const keyOf = (d: string) => (period === "month" ? d.slice(0, 7) : period === "year" ? d.slice(0, 4) : `${d.slice(0, 4)} ${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1} кв`);
  const keys = [...new Set(dates.map(keyOf))];
  const series: { id: FormulaId; label: string; phase?: number; values: number[] }[] = [];
  const flag = (id: FormulaId, label: string) => {
    const v = model.result.formulas[id]?.value as number[][] | undefined;
    v?.forEach((row, p) => series.push({ id, label: `${label} · оч. ${p + 1}`, phase: p + 1, values: row }));
  };
  flag("F.TIME.FLAG_CONSTRUCTION", "Стройка, мес.");
  flag("F.TIME.FLAG_PRESALE", "Продажи ДДУ, мес.");
  flag("F.TIME.FLAG_POST_RNV", "Продажи ДКП, мес.");
  flag("F.TIME.FLAG_ESCROW_RELEASE", "Раскрытие эскроу");
  const tax = model.result.formulas["F.LAND.TAX_OR_RENT"]?.value as Decimal[] | undefined;
  if (tax) series.push({ id: "F.LAND.TAX_OR_RENT", label: "Земельный налог, руб.", values: tax.map((d) => d.toNumber()) });
  const agg = (vals: number[]) => keys.map((k) => vals.reduce((s, v, t) => (keyOf(dates[t] as string) === k ? s + v : s), 0));

  return (
    <div>
      <div className="toolbar">
        <div className="seg">
          {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
            <button key={p} className={period === p ? "on" : ""} onClick={() => setPeriod(p)}>
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
        <span className="small muted">Сейчас доступны шкала времени, флаги периодов и земельный налог. Поступления, затраты, долг и налоги — этапы 3–6.</span>
      </div>
      <div className="hscroll">
        <table className="data compact">
          <thead>
            <tr>
              <th className="sticky">Строка</th>
              {keys.map((k) => (
                <th key={k} className="num">
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {series.map((s) => (
              <tr key={s.label}>
                <td className="sticky">
                  <button className="link" onClick={() => open({ id: s.id, result: model.result, project })}>
                    {s.label}
                  </button>
                </td>
                {agg(s.values).map((v, i) => (
                  <td key={i} className="num">
                    {v ? fmt.num(v, 0) : ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const SUMMARY: { id: FormulaId; label: string; pick?: string }[] = [
  { id: "F.TEP.GFA_ABOVE", label: "ГНС наземной части" },
  { id: "F.TEP.GFA_BELOW", label: "Площадь подземной части" },
  { id: "F.TEP.GFA_TOTAL", label: "ГНС общая" },
  { id: "F.TEP.APT_TYPE_AREA", label: "Площадь квартир по типам" },
  { id: "F.TEP.APART_AREA", label: "Площадь апартаментов" },
  { id: "F.TEP.COMM_AREA", label: "Площадь ПСН" },
  { id: "F.TEP.SALEABLE_AREA", label: "Продаваемая площадь" },
  { id: "F.TEP.PARKING_REQUIRED", label: "Машино-мест по нормативу" },
  { id: "F.TEP.PARKING_COUNT", label: "Машино-мест в модели" },
  { id: "F.TEP.LANDSCAPE_AREA", label: "Площадь благоустройства", pick: "landscape" },
];

export function SummaryTab({ model, project }: { model: ProjectModel; project: DemoProject }) {
  const open = usePassport();
  const show = (v: unknown, pick?: string) => fmt.value(pick && v && typeof v === "object" ? (v as Record<string, unknown>)[pick] : v);
  return (
    <div className="two-col">
      <section>
        <h2>ТЭП</h2>
        <table className="data">
          <tbody>
            {SUMMARY.map(({ id, label, pick }) => {
              const node = model.result.formulas[id];
              return (
                <tr key={id} className="clickable" onClick={() => open({ id, result: model.result, project })}>
                  <td>
                    {label}
                    <div className="small muted">
                      <code>{id}</code>
                    </div>
                  </td>
                  <td className="num">
                    <button className="link num-link">{node ? show(node.value, pick) : "—"}</button> {fmt.unit(getFormula(id).unit)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <h2>Чувствительность</h2>
        <p className="muted">Торнадо по параметрам уровня 4–5 и доля результата, зависящая от экспертных допущений, — этап 14 (после расчёта NPV).</p>
      </section>
      <section>
        <h2>Сообщения расчёта</h2>
        {model.result.messages.length === 0 ? (
          <p className="muted">Нет.</p>
        ) : (
          <ul className="messages">
            {model.result.messages.map((m, i) => (
              <li key={i} className={`msg msg-${m.severity}`}>
                <strong>{m.severity === "error" ? "Ошибка" : m.severity === "warning" ? "Предупреждение" : "Информация"}</strong> {m.text}
                <div className="small">
                  <button className="link" onClick={() => open({ id: m.parameterId ?? m.formulaId, result: model.result, project })}>
                    {m.parameterId ?? m.formulaId}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
