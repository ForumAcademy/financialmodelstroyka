"use client";

import { useState, type ReactNode } from "react";
import Decimal from "decimal.js";
import { getParameter, spec, type FormulaId, type ParameterId } from "@fm/spec";
import { compositeSummary } from "./DataView";
import { useHow } from "./HowPanel";
import { aggregate, PERIOD_LABEL, stageOf, type Period, type ProjectModel } from "@/lib/model";
import { useStore } from "@/lib/store";
import type { DemoProject } from "@/lib/types";
import * as fmt from "@/lib/format";

// ---------------------------------------------------------------- Вводные

export interface InputGroup {
  title: string;
  params: ParameterId[];
  note?: string | undefined;
}

const COLUMN_LABEL: Record<string, string> = {
  phase: "Очередь",
  land_acquired: "Покупка ЗУ",
  design_start: "Начало ИРД/ПИР",
  expertise_done: "Экспертиза",
  rns_date: "РНС",
  construction_start: "Начало СМР",
  construction_end: "Окончание СМР",
  rnv_date: "РНВ",
  handover_start: "Начало передачи",
  handover_end: "Передача ключей",
  vri_change_date: "Смена ВРИ",
  value: "Норматив",
  unit: "Единица",
  sales_start: "Старт продаж",
  type_name: "Тип",
  count: "Кол-во, шт",
  area_share: "Доля площади",
  avg_area: "Ср. площадь, м²",
  product: "Продукт",
  stock_area: "Запас, м²",
  stock_units: "Запас, шт",
  start_price: "Стартовая цена",
  price_date: "Дата цены",
  sale_channel_before_rnv: "Канал до РНВ",
  source_ids: "Источники",
  mortgage_share: "Ипотека",
  full_payment_share: "100% оплата",
  installment_share: "Рассрочка",
  installment_months: "Рассрочка, мес",
  installment_down_payment: "Первый взнос",
};

function parseInput(kind: string, unit: string, raw: string): unknown {
  const t = raw.trim();
  if (t === "") return null;
  if (kind === "bool") return t === "true";
  if (kind === "date" || unit === "дата") return t;
  if (kind === "scalar" || ["м2", "шт", "доля", "руб", "мес", "коэф", "м", "км", "год", "руб/м2", "доля/год", "%годовых"].includes(unit)) {
    const n = Number(t.replace(/\s/g, "").replace(",", "."));
    return Number.isNaN(n) ? t : n;
  }
  return t;
}

function Field({ project, model, id }: { project: DemoProject; model: ProjectModel; id: ParameterId }) {
  const { dispatch } = useStore();
  const { open } = useHow();
  const p = getParameter(id);
  const own = project.input.values[id];
  const traced = model.result.parameters[id];
  const shown = own ?? traced?.value ?? p.default;
  const readonly = p.scope === "template";
  const need = model.missing.has(id);
  const commit = (raw: string) => dispatch({ type: "value", id: project.id, param: id, value: parseInput(p.kind, p.unit, raw) });
  const text = shown === null || shown === undefined ? "" : typeof shown === "object" ? "" : String(shown);

  let control: ReactNode;
  const summary = compositeSummary(shown);
  if (summary && (readonly || p.kind !== "table")) {
    control = (
      <button className="link ro-link" onClick={() => open({ kind: "param", id })}>
        {summary} — показать
      </button>
    );
  } else if (readonly || (p.kind !== "table" && typeof shown === "object" && shown !== null)) {
    control = <span className="ro">{fmt.value(shown ?? null)}</span>;
  } else if (p.kind === "table") {
    control = <TableEditor project={project} id={id} />;
  } else if (id === "GEN.REGION_CODE") {
    control = (
      <select className={need ? "need" : ""} value={text} onChange={(e) => commit(e.target.value)}>
        <option value="">—</option>
        {spec.regions.map((r) => (
          <option key={r.code} value={r.code}>
            {r.code} — {r.name}
          </option>
        ))}
      </select>
    );
  } else if (p.kind === "enum" && p.options) {
    control = (
      <select className={need ? "need" : ""} value={text} onChange={(e) => commit(e.target.value)}>
        <option value="">—</option>
        {p.options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    );
  } else if (p.kind === "bool") {
    control = (
      <select className={need ? "need" : ""} value={text} onChange={(e) => commit(e.target.value)}>
        <option value="">—</option>
        <option value="true">да</option>
        <option value="false">нет</option>
      </select>
    );
  } else if (p.kind === "series") {
    control = <span className="ro muted">помесячный ряд — ввод на этапе 8</span>;
  } else {
    control = <input key={text} className={need ? "need" : ""} type={p.kind === "date" ? "date" : "text"} defaultValue={text} onBlur={(e) => e.target.value !== text && commit(e.target.value)} />;
  }

  return (
    <div className={`field ${p.kind === "table" && !readonly ? "wide" : ""} ${readonly ? "readonly" : ""} ${need ? "is-need" : ""}`} title={need ? needHint(id) : undefined}>
      <button className="field-label" onClick={() => open({ kind: "param", id })} title={need ? needHint(id) : "Как посчитано / источник"}>
        {p.name}
        {readonly ? <span className="tag">справочник</span> : null}
        {need ? <span className="need-badge">Заполните</span> : null}
      </button>
      <div className="field-control">
        {control}
        {p.kind !== "table" || readonly ? <span className="unit">{p.kind !== "enum" && p.kind !== "bool" && p.kind !== "text" && p.kind !== "date" && p.kind !== "table" && !summary ? fmt.unit(p.unit) : ""}</span> : null}
      </div>
    </div>
  );
}

/** Подсказка к обязательному незаполненному полю: какие расчёты без него не выполняются. */
export function needHint(id: ParameterId): string {
  const used = spec.formulas.filter((f) => (f.depends_on as string[]).includes(id)).map((f) => `«${f.name}»`);
  const list = used.length > 3 ? `${used.slice(0, 3).join(", ")} и ещё ${used.length - 3}` : used.join(", ");
  return `Обязательное значение не введено — без него не считается ${list || "часть расчёта"}. Нажмите на название поля: там написано, что это и где взять значение.`;
}

export function Inputs({ project, model, groups }: { project: DemoProject; model: ProjectModel; groups: InputGroup[] }) {
  const missing = groups.flatMap((g) => g.params).filter((id) => model.missing.has(id)).length;
  // Раскладка в две колонки: блоки с редактируемой таблицей — на всю ширину; обычные ставятся парами,
  // блок без соседа в строке тоже растягивается на всю ширину.
  const hasTable = (g: InputGroup) => g.params.some((id) => getParameter(id).kind === "table" && getParameter(id).scope !== "template");
  const full = new Set<number>();
  for (let i = 0; i < groups.length; ) {
    if (hasTable(groups[i]!)) {
      full.add(i);
      i += 1;
    } else if (i + 1 < groups.length && !hasTable(groups[i + 1]!)) {
      i += 2;
    } else {
      full.add(i);
      i += 1;
    }
  }
  return (
    <section className="inputs">
      <h2 className="part-title">Вводные</h2>
      {missing ? (
        <p className="need-legend">
          <span className="need-badge">Заполните</span> — обязательное значение не введено, без него часть расчёта не выполняется. На этой вкладке таких полей: {missing}. Наведите на поле или нажмите на его название, чтобы узнать, где взять значение.
        </p>
      ) : null}
      <div className="input-groups">
        {groups.map((g, i) => (
          <div key={g.title} className={`input-group ${full.has(i) ? "wide" : ""}`}>
            <h3>{g.title}</h3>
            {g.note ? <p className="group-note">{g.note}</p> : null}
            <div className="fields">
              {g.params.map((id) => (
                <Field key={id} project={project} model={model} id={id} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

type Row = Record<string, unknown>;

const LEGACY_LABEL: Record<string, [string, "share" | "num" | "quarters"]> = {
  mortgage: ["Ипотека", "share"],
  full: ["100% оплата", "share"],
  installment: ["Рассрочка", "share"],
  down_payment: ["Первый взнос по рассрочке", "share"],
  installment_quarters: ["Срок рассрочки", "quarters"],
};

/** Объект из исходного Excel → пары «подпись — значение» на русском. */
function legacyItems(raw: Row): [string, string][] {
  if (raw.rule === "per_type" && Array.isArray(raw.values)) {
    return (raw.values as unknown[]).map((v, i) => [`Тип ${i + 1}`, `${fmt.value(v)} м/м на квартиру`]);
  }
  return Object.entries(raw).map(([k, v]) => {
    const [label, kind] = LEGACY_LABEL[k] ?? [COLUMN_LABEL[k] ?? k, "num"];
    const n = typeof v === "number" ? v : null;
    const text = n === null ? fmt.value(v) : kind === "share" ? fmt.share(n) : kind === "quarters" ? `${n} ${fmt.plural(n, ["квартал", "квартала", "кварталов"])}` : fmt.value(n);
    return [label, text];
  });
}

function TableEditor({ project, id }: { project: DemoProject; id: ParameterId }) {
  const { dispatch } = useStore();
  const p = getParameter(id);
  const columns = (p.columns ?? []).filter((c) => c.key !== "source_ids");
  const raw = project.input.values[id];
  if (raw !== null && raw !== undefined && !Array.isArray(raw)) {
    // Значение в формате исходного Excel (режим совместимости) — только просмотр, понятными словами.
    return (
      <div className="legacy-view">
        <dl>
          {legacyItems(raw as Row).map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <p className="small muted">Значения перенесены из исходного Excel, здесь их можно только посмотреть. Изменять их можно будет, когда до этих данных дойдёт расчёт.</p>
      </div>
    );
  }
  const rows = (raw as Row[] | undefined) ?? [];
  if (columns.length === 0) return <span className="ro">{fmt.value(rows.length ? rows : null)}</span>;
  const set = (next: Row[]) => dispatch({ type: "value", id: project.id, param: id, value: next });
  const cell = (r: number, key: string, raw: string, unit: string) => set(rows.map((row, i) => (i === r ? { ...row, [key]: parseInput(unit === "дата" ? "date" : "scalar", unit, raw) } : row)));
  const addRow = () => set([...rows, id === "TIME.MILESTONES" ? { phase: rows.length + 1 } : {}]);
  return (
    <div className="table-editor">
      <table className={id === "TIME.MILESTONES" ? "fit" : ""}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{COLUMN_LABEL[c.key] ?? c.key}</th>
            ))}
            <th className="col-del" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {columns.map((c) => {
                const v = row[c.key];
                const text = v === null || v === undefined ? "" : String(v);
                return (
                  <td key={c.key} className={`col-${c.key}`}>
                    {c.options ? (
                      <select value={text} onChange={(e) => cell(r, c.key, e.target.value, "текст")}>
                        <option value="">—</option>
                        {c.options.map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                    ) : (
                      <input key={text} type={c.unit === "дата" ? "date" : "text"} defaultValue={text} onBlur={(e) => e.target.value !== text && cell(r, c.key, e.target.value, c.unit)} />
                    )}
                  </td>
                );
              })}
              <td>
                <button className="icon" aria-label="Удалить строку" onClick={() => set(rows.filter((_, i) => i !== r))}>
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="link small" onClick={addRow}>
        + строка
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- Расчёт

export type CalcRow =
  | { section: string }
  | {
      label: string;
      unit?: string;
      formula?: FormulaId;
      total?: unknown;
      series?: number[] | null;
      bold?: boolean;
      /** Итог ряда: сумма (потоки) или не показывать (флаги, остатки, ставки). */
      totalMode?: "sum" | "none";
    };

export function Calc({ model, rows, periods = false, stages, title = "Расчёт" }: { model: ProjectModel; rows: CalcRow[]; periods?: boolean; stages?: number[]; title?: string }) {
  const { open } = useHow();
  const [period, setPeriod] = useState<Period>("quarter");
  const dates = model.result.formulas["F.TIME.DATE"]?.value as string[] | undefined;
  const keys = periods && dates ? aggregate(new Array(dates.length).fill(0), dates, period).keys : [];
  return (
    <section className="calc">
      <div className="calc-head">
        <h2 className="part-title">{title}</h2>
        {periods ? (
          <div className="seg">
            {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
              <button key={p} className={period === p ? "on" : ""} onClick={() => setPeriod(p)}>
                {PERIOD_LABEL[p]}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {stages?.length ? <p className="stage-note">Расчёт — этап {stages.join(", ")}: строки заполнятся, когда ядро будет считать эти формулы.</p> : null}
      {periods && !dates ? <p className="stage-note">Нет временной шкалы: заполните дату начала модели и вехи очередей на вкладке ТЭП.</p> : null}
      <div className="hscroll">
        <table className="sheet calc-table">
          <thead>
            <tr>
              <th className="sticky">Показатель</th>
              <th>Ед.</th>
              <th className="num">Итого</th>
              {keys.map((k) => (
                <th key={k} className="num">
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              if ("section" in row) {
                return (
                  <tr key={i} className="block">
                    <td className="sticky" colSpan={3}>
                      {row.section}
                    </td>
                    {keys.length ? <td colSpan={keys.length} /> : null}
                  </tr>
                );
              }
              const series = row.series && dates ? aggregate(row.series, dates, period).sums : null;
              const total = row.total !== undefined ? row.total : row.series && row.totalMode !== "none" ? row.series.reduce((a, b) => a + b, 0) : undefined;
              const totalText = total === undefined ? (row.series ? "" : "—") : fmt.value(total);
              const click = () => row.formula && open({ kind: "formula", id: row.formula, label: row.label, value: total === undefined ? "—" : `${totalText} ${fmt.unit(row.unit ?? "")}` });
              return (
                <tr key={i} className={`${row.bold ? "total" : ""} ${row.formula ? "clickable" : ""}`} onClick={click}>
                  <td className="sticky">{row.label}</td>
                  <td>{fmt.unit(row.unit ?? "")}</td>
                  <td className="num">{totalText}</td>
                  {keys.map((k, j) => (
                    <td key={k} className="num">
                      {series ? (series[j] ? fmt.num(series[j] as number, 0) : "") : "—"}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Значение формулы, если ядро его посчитало. */
export function val<T = unknown>(model: ProjectModel, id: FormulaId): T | undefined {
  return model.result.formulas[id]?.value as T | undefined;
}

export const toNum = (xs: Decimal[] | undefined) => xs?.map((x) => x.toNumber()) ?? null;

/** Этапы будущих модулей, формулы которых стоят в строках таблицы (для строки «Расчёт — этап N»). */
export function pendingStages(model: ProjectModel, ids: FormulaId[]): number[] {
  const stages = ids.filter((id) => !model.result.formulas[id]).map((id) => stageOf(id)).filter((s): s is number => s !== null && s > 2);
  return [...new Set(stages)].sort((a, b) => a - b);
}
