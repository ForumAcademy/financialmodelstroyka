"use client";

import { useState, type ReactNode } from "react";
import Decimal from "decimal.js";
import { getParameter, spec, type FormulaId, type ParameterId } from "@fm/spec";
import Link from "next/link";
import { ChangedMark, SourceMark, useChange } from "./Change";
import { compositeSummary } from "./DataView";
import { useHow } from "./HowPanel";
import { aggregate, PERIOD_LABEL, stageOf, type Period, type ProjectModel } from "@/lib/model";
import { useStore } from "@/lib/store";
import type { DemoProject } from "@/lib/types";
import * as fmt from "@/lib/format";
import type { InputGroup } from "@/lib/tab-inputs";
import { COLUMN_LABEL, excelCell, fieldLabel, fromField, itemLabel, optionLabel, toField, unitOf, type FieldUnit } from "@/lib/field-view";
import { versionOf } from "@/lib/assumptions";
import { whence, type Whence } from "@/lib/whence";

// ---------------------------------------------------------------- Вводные

export type { InputGroup };


/** Подписи столбцов, которые у параметра значат не то же, что в COLUMN_LABEL. */
const PARAM_COLUMN_LABEL: Partial<Record<ParameterId, Record<string, string>>> = {
  "SALES.PACE": { value: "Темп: доля остатка или м² (шт) в месяц" },
  "SALES.LEGACY_PRICE_GROWTH": { rate: "Рост за период", step_months: "Длина периода, мес" },
};

function parseInput(kind: string, unit: string, raw: string, id?: ParameterId): unknown {
  const t = raw.trim();
  if (t === "") return null;
  if (kind === "bool") return t === "true";
  if (kind === "date" || unit === "дата") return t;
  const u = unitOf(unit, id);
  if (kind === "scalar" || u.scale !== 1 || ["м2", "шт", "руб", "мес", "коэф", "м", "км", "год", "руб/м2"].includes(unit)) {
    const n = fromField(t, u);
    return n === null ? t : n;
  }
  // Число, показанное с разрядами («1 000»), читается обратно как число в любом столбце.
  if (/^-?\d{1,3}(\s\d{3})+([.,]\d+)?$/.test(t)) return Number(t.replace(/\s/g, "").replace(",", "."));
  return t;
}

/** Ячейка значения: число — в единицах экрана (проценты, целые м²), остальное — как есть. */
const shownText = (v: unknown, u: FieldUnit): string => (v === null || v === undefined || typeof v === "object" ? "" : typeof v === "number" ? toField(v, u) : String(v));

/** Подпись поля: с источником — подчёркнута пунктиром, клик показывает источник под полем; без источника — «Как посчитано». */
function FieldHead({ label, hasSource, onLabel, children }: { label: string; hasSource: boolean; onLabel: () => void; children?: ReactNode }) {
  return (
    <div className="fld-head">
      <button className={`fld-name ${hasSource ? "has-src" : ""}`} onClick={onLabel} title={hasSource ? "Источник" : "Как посчитано"}>
        {label}
      </button>
      {children}
    </div>
  );
}

const hasText = (w: Whence) => !["документ не указан", "обоснование не указано"].includes(w.text);

function Field({ project, model, id }: { project: DemoProject; model: ProjectModel; id: ParameterId }) {
  const { open } = useHow();
  const { assumptions } = useStore();
  const [showSrc, setShowSrc] = useState(false);
  const [showFile, setShowFile] = useState(false);
  const p = getParameter(id);
  const own = project.input.values[id];
  const hasOwn = own !== undefined && own !== null;
  const traced = model.result.parameters[id];
  const shown = own ?? traced?.value ?? model.standard[id] ?? p.default;
  const summary = compositeSummary(shown);
  // Любое значение проекта можно изменить; ряды и таблицы справочника смотрятся в карточке «Как посчитано».
  const reference = p.scope === "template";
  const readonly = reference && (summary !== null || p.kind === "table" || p.kind === "series");
  const need = model.missing.has(id);
  const change = useChange(project, id, shown);
  const hasValue = shown !== null && shown !== undefined && shown !== "" && !(Array.isArray(shown) && shown.length === 0);
  const u = unitOf(p.unit, id);
  const commit = (raw: string) => change.commit(parseInput(p.kind, p.unit, raw, id));
  const text = shownText(shown, u);
  const w = whence(id, project, assumptions);
  const src = hasValue && hasText(w);
  const cell = hasOwn ? excelCell(project, id) : null;
  const inRef = !hasOwn && hasValue ? (versionOf(assumptions, project.assumptionsVersion)?.items.some((i) => i.param === id) ?? false) : false;
  const byRef = !hasOwn && hasValue && w.kind !== "project";
  const table = p.kind === "table" && !readonly;

  let control: ReactNode;
  if (summary && (readonly || p.kind !== "table")) {
    control = (
      <button className="link ro-link" onClick={() => open({ kind: "param", id })}>
        {summary} — показать
      </button>
    );
  } else if (readonly || (p.kind !== "table" && typeof shown === "object" && shown !== null)) {
    control = <span className="ro">{fmt.value(shown ?? null)}</span>;
  } else if (p.kind === "table") {
    const byRow = id === "SALES.PRODUCTS" ? (model.result.formulas["F.SALES.REVENUE_TOTAL"]?.value as { byRow?: Record<string, Decimal> } | undefined)?.byRow : undefined;
    control = <TableEditor project={project} id={id} value={shown} columns={undefined} revenue={byRow} />;
  } else if (id === "GEN.REGION_CODE") {
    control = (
      <select value={text} onChange={(e) => commit(e.target.value)}>
        <option value="">—</option>
        {spec.regions.map((r) => (
          <option key={r.code} value={r.code}>
            {r.name}
          </option>
        ))}
      </select>
    );
  } else if (p.kind === "enum" && p.options) {
    control = (
      <select value={text} onChange={(e) => commit(e.target.value)}>
        <option value="">—</option>
        {p.options.map((o) => (
          <option key={o} value={o}>
            {optionLabel(o)}
          </option>
        ))}
      </select>
    );
  } else if (p.kind === "bool") {
    control = (
      <select value={text} onChange={(e) => commit(e.target.value)}>
        <option value="">—</option>
        <option value="true">да</option>
        <option value="false">нет</option>
      </select>
    );
  } else if (p.kind === "series") {
    control = <span className="ro muted">не задано</span>;
  } else {
    control = (
      <input
        key={`${text}-${change.pending}`}
        type={p.kind === "date" ? "date" : "text"}
        defaultValue={text}
        placeholder={need ? "введите" : "—"}
        onBlur={(e) => e.target.value !== text && commit(e.target.value)}
      />
    );
  }
  const unitLabel = !table && !summary && !["enum", "bool", "text", "date"].includes(p.kind) ? u.label : "";

  return (
    <div id={`field-${id}`} className={`fld ${table ? "wide" : ""} ${need ? "is-need" : ""}`} title={need ? needHint(id) : undefined}>
      <FieldHead label={fieldLabel(id)} hasSource={src} onLabel={() => (src ? setShowSrc(!showSrc) : open({ kind: "param", id }))}>
        {cell ? (
          <button className="tag file" onClick={() => setShowFile(!showFile)} title="Где в исходном файле">
            исходный файл
          </button>
        ) : null}
        {byRef ? (
          inRef ? (
            <Link className="tag" href={`/assumptions?param=${encodeURIComponent(id)}&from=${encodeURIComponent(project.id)}`} title="Открыть в справочнике">
              по справочнику
            </Link>
          ) : (
            <span className="tag">по справочнику</span>
          )
        ) : null}
        <ChangedMark project={project} id={id} />
      </FieldHead>
      {table ? (
        control
      ) : (
        <div className={`inp ${need ? "empty" : ""} ${readonly || summary || p.kind === "series" ? "ro" : ""}`}>
          {control}
          {unitLabel ? <span className="u">{unitLabel}</span> : null}
        </div>
      )}
      {showSrc && src ? (
        <div className="fld-src">
          Источник:{" "}
          {w.url ? (
            <a href={w.url} target="_blank" rel="noreferrer">
              {w.text} ↗
            </a>
          ) : (
            w.text
          )}
          {" · "}
          <button className="link small" onClick={() => open({ kind: "param", id })}>
            подробнее
          </button>{" "}
          <SourceMark project={project} id={id} inline />
        </div>
      ) : null}
      {showFile && cell ? <div className="fld-src">Из исходного файла: {cell}</div> : null}
      {change.form}
    </div>
  );
}

/** Подпись единицы статьи бюджета по её базе: сумма, ставка на м² или доля другой суммы. */
function itemUnit(base: string): FieldUnit {
  if (base === "фикс") return unitOf("руб");
  if (base === "фикс_в_месяц") return { label: "руб/мес", scale: 1, digits: null };
  const share: Record<string, string> = { "F.CAPEX.SMR_TOTAL": "% СМР", "F.SALES.REVENUE_TOTAL": "% выручки", "LAND.PURCHASE_PRICE": "% цены участка" };
  if (share[base]) return { label: share[base], scale: 100, digits: null };
  if (base === "формула") return { label: "", scale: 1, digits: null };
  return { label: "руб/м²", scale: 1, digits: null };
}

type ItemRow = { item_id: string; base?: string; rate?: number | null };

/**
 * Статья бюджета полем: ставка или сумма из строки статьи в CAPEX.ITEMS проекта (у проекта из Excel — сумма
 * из листа «Бюджет»). Правка меняет строку статьи; пустая строка — статья не заполнена.
 */
function BudgetItemField({ project, itemId }: { project: DemoProject; itemId: string }) {
  const { open } = useHow();
  const [showFile, setShowFile] = useState(false);
  const item = spec.capexItems.find((c) => c.item_id === itemId)!;
  const rows = (Array.isArray(project.input.values["CAPEX.ITEMS"]) ? project.input.values["CAPEX.ITEMS"] : []) as ItemRow[];
  const row = rows.find((r) => r.item_id === itemId);
  const change = useChange(project, "CAPEX.ITEMS", project.input.values["CAPEX.ITEMS"] ?? null);
  const base = row?.base ?? item.base;
  const u = itemUnit(base);
  const rate = row?.rate;
  const text = typeof rate === "number" ? toField(rate, u) : "";
  const legacy = project.legacyCase?.capex_legacy?.find((x) => x.item_id === itemId);
  const cell = legacy?.budget_row && !project.changes?.["CAPEX.ITEMS"] ? `Лист «Бюджет», ячейка F${legacy.budget_row}` : null;
  const commit = (raw: string) => {
    const n = raw.trim() === "" ? null : fromField(raw, u);
    if (raw.trim() !== "" && n === null) return;
    const next = row ? rows.map((r) => (r.item_id === itemId ? { ...r, rate: n } : r)) : [...rows, { item_id: itemId, base, rate: n }];
    change.commit(next);
  };
  const label = itemLabel(item);
  return (
    <div className="fld">
      <FieldHead label={label} hasSource={false} onLabel={() => open({ kind: "capex", id: item.item_id })}>
        {cell && typeof rate === "number" ? (
          <button className="tag file" onClick={() => setShowFile(!showFile)} title="Где в исходном файле">
            исходный файл
          </button>
        ) : null}
      </FieldHead>
      <div className={`inp ${base === "формула" ? "ro" : ""}`}>
        {base === "формула" ? (
          <span className="ro muted">по формуле</span>
        ) : (
          <input key={`${text}-${change.pending}`} defaultValue={text} placeholder="—" onBlur={(e) => e.target.value !== text && commit(e.target.value)} />
        )}
        {u.label ? <span className="u">{u.label}</span> : null}
      </div>
      {showFile && cell ? <div className="fld-src">Из исходного файла: {cell}</div> : null}
      {change.form}
    </div>
  );
}

/** Подсказка к обязательному незаполненному полю: какие расчёты без него не выполняются. */
export function needHint(id: ParameterId): string {
  const used = spec.formulas.filter((f) => (f.depends_on as string[]).includes(id)).map((f) => `«${f.name}»`);
  const list = used.length > 3 ? `${used.slice(0, 3).join(", ")} и ещё ${used.length - 3}` : used.join(", ");
  return `Без этого значения не считается ${list || "часть расчёта"}.`;
}

/**
 * Поля вкладки шага: две колонки, таблицы — на всю ширину. bare — одна вкладка шага вводных (название — на вкладке);
 * без bare — блоки с заголовками групп (вводные на листах расчёта).
 */
export function Inputs({ project, model, groups, bare = false, footer }: { project: DemoProject; model: ProjectModel; groups: InputGroup[]; bare?: boolean; footer?: ReactNode }) {
  return (
    <section className="inputs">
      {bare ? null : <h2 className="part-title">Вводные</h2>}
      {groups.map((g) => (
        <div key={g.title} className="input-group">
          {bare ? null : <h3>{g.title}</h3>}
          {g.note ? <p className="group-note">{g.note}</p> : null}
          <div className="fields">
            {g.params.map((id) =>
              g.columns && getParameter(id).kind === "table" ? (
                <TableField key={id} project={project} model={model} id={id} columns={g.columns} />
              ) : (
                <Field key={id} project={project} model={model} id={id} />
              ),
            )}
            {(g.items ?? []).map((item) => (
              <BudgetItemField key={item} project={project} itemId={item} />
            ))}
          </div>
        </div>
      ))}
      {footer}
    </section>
  );
}

/** Таблица с частью столбцов (график по очередям): без подписи — название уже на вкладке. */
function TableField({ project, model, id, columns }: { project: DemoProject; model: ProjectModel; id: ParameterId; columns: string[] }) {
  const own = project.input.values[id];
  const shown = own ?? model.result.parameters[id]?.value ?? model.standard[id] ?? getParameter(id).default;
  return (
    <div id={`field-${id}`} className={`fld wide ${model.missing.has(id) ? "is-need" : ""}`}>
      <TableEditor project={project} id={id} value={shown} columns={columns} />
    </div>
  );
}

type Row = Record<string, unknown>;

const LEGACY_LABEL: Record<string, [string, "share" | "num" | "quarters"]> = {
  mortgage: ["Ипотека", "share"],
  full: ["100% оплата", "share"],
  installment: ["Рассрочка", "share"],
  down_payment: ["Первый взнос по рассрочке", "share"],
  installment_quarters: ["Срок рассрочки", "quarters"],
  rate: ["Рост за период", "share"],
  step_months: ["Длина периода, мес", "num"],
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

/** Кратко о составной ячейке: ручной ряд {from, step_months, values} → «32 периода по 3 мес с 31.03.2026, итого 1 234». */
function cellSummary(v: object): string {
  const m = v as { from?: string; step_months?: number; values?: unknown[] };
  if (Array.isArray(m.values)) {
    const total = m.values.reduce((a: number, x) => a + (typeof x === "number" ? x : 0), 0);
    const n = m.values.length;
    return `${n} ${fmt.plural(n, ["период", "периода", "периодов"])} по ${m.step_months ?? "?"} мес с ${fmt.date(m.from)}, итого ${fmt.num(total, 0)}`;
  }
  return fmt.value(v);
}

/** value — значение, которое действует в проекте: своё значение проекта или стандарт компании. */
const BILLION = 1e9;

/** Штучные продукты: цена за штуку, остальные — за м². */
const PER_UNIT = ["машино-места", "кладовые"];

function TableEditor({ project, id, value, columns: only, revenue }: { project: DemoProject; id: ParameterId; value: unknown; columns: string[] | undefined; revenue?: Record<string, Decimal> | undefined }) {
  const { dispatch } = useStore();
  const p = getParameter(id);
  const products = id === "SALES.PRODUCTS";
  // Одна «Цены на дату» для всех продуктов, пока у строк одна дата цены.
  const priceDates = products && Array.isArray(value) ? new Set((value as Row[]).map((r) => r.price_date ?? null)) : new Set();
  const oneDate = products && priceDates.size === 1;
  const columns = (p.columns ?? []).filter((c) => c.key !== "source_ids" && (!only || only.includes(c.key)) && !(oneDate && c.key === "price_date"));
  const raw = value;
  const change = useChange(project, id, raw);
  if (raw !== null && raw !== undefined && !Array.isArray(raw)) {
    // Значение в формате исходного Excel (расчёт «как в исходном Excel») — только просмотр, понятными словами.
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
        <p className="small muted">Из исходного файла, только просмотр.</p>
      </div>
    );
  }
  const rows = (raw as Row[] | undefined) ?? [];
  if (columns.length === 0) return <span className="ro">{fmt.value(rows.length ? rows : null)}</span>;
  const set = (next: Row[]) => change.commit(next);
  // Пустая строка или пустая ячейка заполняются без комментария: исходного значения, которое меняется, ещё нет.
  const fill = (next: Row[]) => {
    const c = project.changes?.[id];
    if (c) dispatch({ type: "change", id: project.id, param: id, before: c.before, value: next, why: c.why, ...(c.url ? { url: c.url } : {}), author: c.author });
    else dispatch({ type: "value", id: project.id, param: id, value: next });
  };
  const cell = (r: number, key: string, raw: string, unit: string) => {
    const next = rows.map((row, i) => (i === r ? { ...row, [key]: parseInput(unit === "дата" ? "date" : "scalar", unit, raw) } : row));
    const old = rows[r]?.[key];
    // Стандарт компании меняется только с комментарием «почему», даже пустая ячейка.
    const own = project.input.values[id] !== undefined && project.input.values[id] !== null;
    (own && (old === null || old === undefined || old === "") ? fill : set)(next);
  };
  const addRow = () => {
    const next = [...rows, id === "TIME.MILESTONES" ? { phase: rows.length + 1 } : {}];
    if (rows.length && (project.input.values[id] === undefined || project.input.values[id] === null)) set(next);
    else fill(next);
  };
  const date = oneDate ? String([...priceDates][0] ?? "") : "";
  return (
    <div className="table-editor">
      {oneDate ? (
        <div className="bar">
          <span className="small muted">Цены на дату</span>
          <input
            key={`${date}-${change.pending}`}
            type="date"
            defaultValue={date}
            onBlur={(e) => e.target.value !== date && set(rows.map((row) => ({ ...row, price_date: e.target.value || null })))}
          />
        </div>
      ) : null}
      <table className={id === "TIME.MILESTONES" ? "fit" : ""} data-param={id}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>
                {PARAM_COLUMN_LABEL[id]?.[c.key] ?? COLUMN_LABEL[c.key] ?? c.key}
                {unitOf(c.unit).scale !== 1 ? ", %" : ""}
              </th>
            ))}
            {revenue ? <th className="num">{COLUMN_LABEL.revenue}</th> : null}
            <th className="col-del" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} data-row={String(row.name ?? row.product ?? "")}>
              {columns.map((c) => {
                const v = row[c.key];
                const text = shownText(v, unitOf(c.unit));
                // Составное значение ячейки (ручной ряд темпа) — просмотр кратко; ввод рядов — на этапе 8
                if (v !== null && typeof v === "object") {
                  return (
                    <td key={c.key} className={`col-${c.key}`}>
                      <span className="ro small">{cellSummary(v)}</span>
                    </td>
                  );
                }
                return (
                  <td key={c.key} className={`col-${c.key}`}>
                    {c.options ? (
                      <select key={`${text}-${change.pending}`} value={text} onChange={(e) => cell(r, c.key, e.target.value, "текст")}>
                        <option value="">—</option>
                        {c.options.map((o) => (
                          <option key={o} value={o}>
                            {optionLabel(o)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="cell-u">
                        <input key={`${text}-${change.pending}`} type={c.unit === "дата" ? "date" : "text"} defaultValue={text} onBlur={(e) => e.target.value !== text && cell(r, c.key, e.target.value, c.unit)} />
                        {products && c.key === "start_price" ? <span className="u">{PER_UNIT.includes(String(row.product)) ? "руб/шт" : "руб/м²"}</span> : null}
                      </span>
                    )}
                  </td>
                );
              })}
              {revenue ? <td className="num ro">{revenue[String(row.name)] ? fmt.num(revenue[String(row.name)]!.div(BILLION), 1) : "—"}</td> : null}
              <td className="col-del">
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
      {change.form}
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
      /** Значение за период: сумма месяцев (потоки) или на конец периода (остатки, цены). */
      periodMode?: "sum" | "last";
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
      {stages?.length ? <p className="stage-note">Часть строк ещё не рассчитывается.</p> : null}
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
              const series = row.series && dates ? aggregate(row.series, dates, period, row.periodMode).sums : null;
              const total = row.total !== undefined ? row.total : row.series && row.totalMode !== "none" ? row.series.reduce((a, b) => a + b, 0) : undefined;
              // Деньги в итогах — до рубля, как в ячейках по периодам; доли — в процентах
              const isNum = typeof total === "number" || total instanceof Decimal;
              const totalText = total === undefined ? (row.series ? "" : "—") : isNum && (row.unit?.startsWith("руб") || row.unit === "доля" || row.unit === "%годовых" || row.unit === "коэф") ? cellText(new Decimal(total).toNumber(), row.unit) : fmt.value(total);
              const click = () => row.formula && open({ kind: "formula", id: row.formula, label: row.label, value: total === undefined ? "—" : `${totalText} ${fmt.unit(row.unit ?? "")}` });
              return (
                <tr key={i} className={`${row.bold ? "total" : ""} ${row.formula ? "clickable" : ""}`} onClick={click}>
                  <td className="sticky">{row.label}</td>
                  <td>{fmt.unit(row.unit ?? "")}</td>
                  <td className="num">{totalText}</td>
                  {keys.map((k, j) => (
                    <td key={k} className="num">
                      {series ? (series[j] ? cellText(series[j] as number, row.unit) : "") : row.total !== undefined ? "" : "—"}
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

/** Число в ячейке расчёта: доли и ставки — в процентах, коэффициенты — с двумя знаками, остальное — целыми. */
function cellText(v: number, unit: string | undefined): string {
  if (unit === "доля" || unit === "%годовых") return fmt.share(Math.round(v * PERCENT_CELL) / PERCENT_CELL);
  if (unit === "коэф") return fmt.num(v, 2);
  return fmt.num(v, 0);
}
const PERCENT_CELL = 10_000;

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
