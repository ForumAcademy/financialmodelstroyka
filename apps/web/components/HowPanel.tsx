"use client";

import Link from "next/link";
import Decimal from "decimal.js";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { getCapexItem, getFormula, getParameter, getSource, spec, type CapexItemId, type FormulaId, type ParameterId, type SourceId } from "@fm/spec";
import * as fmt from "@/lib/format";
import { compositeSummary, DataView } from "./DataView";
import { ChangedMark, valueText } from "./Change";
import { whence } from "@/lib/whence";
import { baseName, humanize, indexName, milestoneName, scheduleName } from "@/lib/humanize";
import { amount, compatDiff, exampleFocus, howExample, inputFields, monthName, shortSource } from "@/lib/how-example";
import { cellMln, cellPrice, cellQty, cellShare, hasUnsold, parkingWarning, pricesFromExcel, salesRows, salesTotal, salesWarnings, type SalesRow } from "@/lib/sales-panel";
import { isParameterIdLike, modePair, stageOf, type ProjectModel } from "@/lib/model";
import type { DemoProject } from "@/lib/types";
import { useStore } from "@/lib/store";

export type HowTarget =
  | { kind: "formula"; id: FormulaId; label?: string; value?: string }
  | { kind: "param"; id: ParameterId }
  | { kind: "capex"; id: CapexItemId };

interface Ctx {
  open: (t: HowTarget) => void;
  setProject: (id: string | null) => void;
}
const HowCtx = createContext<Ctx>({ open: () => {}, setProject: () => {} });
export const useHow = () => useContext(HowCtx);

function SpecSource({ id }: { id: SourceId }) {
  const s = getSource(id);
  return (
    <li>
      {s.url ? (
        <a href={s.url} target="_blank" rel="noreferrer">
          {s.title}
        </a>
      ) : (
        s.title
      )}
      {s.url ? null : <span className="nolink-badge">нет ссылки</span>}
      <div className="muted small">
        {s.accessed ? `проверено ${fmt.date(s.accessed)}` : ""}
        {s.verified === false ? " · не сверен" : ""}
      </div>
    </li>
  );
}

export function HowPanelProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HowTarget | null>(null);
  const [projectId, setProject] = useState<string | null>(null);
  const open = useCallback((t: HowTarget) => setTarget(t), []);
  return (
    <HowCtx.Provider value={{ open, setProject }}>
      {children}
      {target ? (
        <aside className="how" aria-label="Как посчитано">
          <div className="how-head">
            <span>Как посчитано</span>
            <button className="icon" onClick={() => setTarget(null)} aria-label="Закрыть">
              ✕
            </button>
          </div>
          <div className="how-body">
            {target.kind === "formula" ? <FormulaView t={target} projectId={projectId} open={open} /> : null}
            {target.kind === "param" ? <ParamView id={target.id} projectId={projectId} /> : null}
            {target.kind === "capex" ? <CapexView id={target.id} open={open} /> : null}
          </div>
        </aside>
      ) : null}
    </HowCtx.Provider>
  );
}

function Actions({ formula, source }: { formula?: string | undefined; source?: string | undefined }) {
  return (
    <div className="how-actions">
      {formula ? (
        <Link className="btn" href={`/formulas?id=${encodeURIComponent(formula)}`}>
          Открыть в Формулах
        </Link>
      ) : null}
      <Link className="btn" href={`/sources${source ? `?q=${encodeURIComponent(source)}` : ""}`}>
        Открыть в Источниках
      </Link>
    </div>
  );
}

/** Значение в заголовке — только для одного числа; ряды и таблицы раскрывает блок «Пример». */
function headlineValue(v: unknown, unit: string): string | null {
  if (v instanceof Decimal || typeof v === "number") return amount(v, unit);
  return null;
}

/** Значение поля ввода в «Что влияет»: число с единицей, таблица — числом строк. */
function depValue(v: unknown, unit: string): string {
  if (v === undefined || v === null) return "не задано";
  if (Array.isArray(v) && !v.every((x) => typeof x === "number" || x instanceof Decimal)) return `${v.length} ${fmt.plural(v.length, ["строка", "строки", "строк"])}`;
  if (typeof v === "number" || v instanceof Decimal) return amount(v, unit);
  if (typeof v === "object") return "задано";
  return fmt.value(v);
}

/** Строка-ссылка под «Как считается»: из чего складываются деньги показателя. */
const RELATED: Partial<Record<FormulaId, { text: string; ids: FormulaId[] }>> = {
  "F.SALES.SOLD_AREA": { text: "Выручка = продано × цена 1 м²", ids: ["F.SALES.PRICE", "F.SALES.REVENUE_TOTAL"] },
};

interface Warn {
  text: string;
  /** Строка плана продаж, к которой ведёт кнопка. */
  product?: string;
  /** Поле ввода, которое открывает кнопка. */
  param?: ParameterId;
}

function WarnList({ items, projectId, open }: { items: Warn[]; projectId: string | undefined; open: (t: HowTarget) => void }) {
  return (
    <ul className="how-warn-now">
      {items.map((w) => (
        <li key={w.text}>
          {w.text}
          {w.product && projectId ? (
            <>
              {" "}
              <Link className="how-go" href={`/projects/${projectId}?tab=sales&row=${encodeURIComponent(w.product)}`}>
                Открыть план продаж {w.product}
              </Link>
            </>
          ) : null}
          {w.param ? (
            <>
              {" "}
              <button className="linklike how-go" onClick={() => open({ kind: "param", id: w.param! })}>
                Открыть поле «{getParameter(w.param).name}»
              </button>
            </>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function SalesTable({ rows, excelPrices }: { rows: SalesRow[]; excelPrices: boolean }) {
  const total = salesTotal(rows);
  const unsold = hasUnsold(rows);
  const rnvTip = (r: SalesRow) => `Очередь ${String(r.phase ?? "—")}, ввод ${r.rnvDate ? fmt.date(r.rnvDate) : "не задан"}`;
  return (
    <div className="how-table">
      <table>
        <thead>
          <tr>
            <th>Продукт</th>
            <th>Построено</th>
            {unsold ? <th>Не продано</th> : null}
            <th>Продано к вводу своей очереди, %</th>
            <th>Темп в месяц</th>
            <th>Срок продаж, мес</th>
            <th>Распродано к</th>
            <th>Выручка, млн руб{excelPrices ? "*" : ""}</th>
            <th>Средняя цена, руб/м² (м/м — руб/шт){excelPrices ? "*" : ""}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>{r.key}</td>
              <td>{cellQty(r.built, r.unit)}</td>
              {unsold ? <td>{cellQty(r.unsold, r.unit)}</td> : null}
              <td title={rnvTip(r)}>{cellShare(r.byRnvShare)}</td>
              <td>{cellQty(r.avgPerMonth, r.unit)}</td>
              <td>{r.months || "—"}</td>
              <td>{r.soldOut ? monthName(r.soldOut) : "—"}</td>
              <td>{cellMln(r.revenue)}</td>
              <td>{cellPrice(r.avgPrice)}</td>
            </tr>
          ))}
          <tr className="total">
            <td>Итого без машино-мест</td>
            <td>{cellQty(total.built, "м²")}</td>
            {unsold ? <td>{cellQty(total.unsold, "м²")}</td> : null}
            <td>{cellShare(total.byRnvShare)}</td>
            <td />
            <td />
            <td />
            <td>{cellMln(total.revenue)}</td>
            <td>{cellPrice(total.avgPrice)}</td>
          </tr>
        </tbody>
      </table>
      <p className="small muted">
        Выручка в «Итого» — по всем продуктам, включая машино-места. Наведите на долю к вводу, чтобы увидеть очередь и дату её ввода.
        {excelPrices ? " * Цены исходного Excel: в расчёте сервиса цена не считается, пока не заполнен «Рыночный рост цен, годовой»." : ""}
      </p>
    </div>
  );
}

/** Сколько предупреждений видно сразу, остальные — под «Ещё N». */
const WARN_SHOWN = 2;

/** Ссылка на ячейку Excel («ТЭПы!C48») — такие сообщения живут на вкладке «Расхождения», не в панели показателя. */
const CELL_REF = /[А-Яа-яA-Za-z0-9_]+!\$?[A-Z]{1,3}\$?\d+/;

/** Показатель и все промежуточные показатели, из которых он считается. */
function upstream(id: FormulaId): Set<string> {
  const out = new Set<string>();
  const walk = (f: FormulaId) => {
    if (out.has(f)) return;
    out.add(f);
    for (const d of getFormula(f).depends_on) if (!isParameterIdLike(d)) walk(d as FormulaId);
  };
  walk(id);
  return out;
}

function ParamDep({ id, m, project, open }: { id: ParameterId; m: ProjectModel | null; project: DemoProject | undefined; open: (t: HowTarget) => void }) {
  const v = m?.result.parameters[id]?.value ?? project?.input.values[id];
  return (
    <li>
      <button className="dep" onClick={() => open({ kind: "param", id })}>
        <span>{getParameter(id).name}</span>
        <span className="dep-value">{depValue(v, getParameter(id).unit)}</span>
      </button>
    </li>
  );
}

function FormulaView({ t, projectId, open }: { t: Extract<HowTarget, { kind: "formula" }>; projectId: string | null; open: (t: HowTarget) => void }) {
  const { projects, model } = useStore();
  const project = projects.find((p) => p.id === projectId);
  const m = project ? model(project) : null;
  const f = getFormula(t.id);
  const pair = project && m ? modePair(project, m) : null;
  // Пример и предупреждения — всегда из расчёта сервиса, чтобы не противоречили друг другу
  const sp = pair?.normalProject ?? project;
  const sm = pair?.normal ?? m;
  const node = sm?.result.formulas[t.id];
  // Предупреждения: только действующие, по этому показателю и тому, без чего он не считается; ячейки Excel — на вкладке «Расхождения»
  const scope = sm ? upstream(t.id) : new Set<string>();
  const active = (sm?.result.messages ?? []).filter(
    (x) => (x.formulaId === t.id || (!node && x.severity === "error" && x.formulaId && scope.has(x.formulaId))) && !x.key?.startsWith("LEGACY.") && !CELL_REF.test(x.text),
  );
  const example = sp && sm ? howExample(t.id, sp, sm) : null;
  // сначала — предупреждения по продукту из примера
  const focus = sp && sm ? exampleFocus(sp, sm) : null;
  if (focus) active.sort((x, y) => Number(y.text.includes(focus)) - Number(x.text.includes(focus)));
  // Продажи: предупреждения с суммой в рублях по убыванию влияния, с переходом к строке плана продаж
  const sales = t.id === "F.SALES.SOLD_AREA" && sp && sm ? salesRows(sp, sm, pair?.legacy ?? null) : null;
  const parking = sales && sm ? parkingWarning(sm, pair?.legacy ?? null) : null;
  const warns: Warn[] = sales && sp && sm
    ? [
        ...salesWarnings(sp, sm, pair?.legacy ?? null).map((w) => ({ text: w.text, product: w.key })),
        ...(parking ? [{ text: parking, param: "TEP.PARKING_COUNT_OVERRIDE" as ParameterId }] : []),
        ...active.filter((x) => x.parameterId !== "SALES.PACE").map((x) => ({ text: x.text })),
      ]
    : active.map((x) => ({ text: x.text }));
  const related = RELATED[t.id];
  const params = inputFields(t.id, sm);
  const diff = pair && sp && sm ? compatDiff(t.id, pair.legacy, pair.normal, focus) : null;
  const sources = f.source_ids.map(getSource).filter((s) => s.scope === "global");
  const calc = f.depends_on.filter((d) => !isParameterIdLike(d)) as FormulaId[];
  // Итог — только для скалярного показателя: у рядов по продуктам итог строки листа без названия продукта сбивает
  const value = node ? headlineValue(node.value, f.unit) : null;
  return (
    <>
      <h2>{f.plain?.title ?? t.label ?? f.name}</h2>
      {value ? <div className="how-value">{value}</div> : null}
      {!node && sm && !warns.length ? <p className="muted small">Показатель начнёт считаться на этапе {stageOf(t.id) ?? "?"}.</p> : null}
      <h3>Как считается</h3>
      <p>{f.plain?.how ?? humanize(f.note ?? f.rationale)}</p>
      {related ? (
        <p className="how-related">
          {related.text}:{" "}
          {related.ids.map((id, i) => (
            <span key={id}>
              {i ? " · " : ""}
              <button className="linklike" onClick={() => open({ kind: "formula", id })}>
                {getFormula(id).plain?.title.split(",")[0] ?? getFormula(id).name}
              </button>
            </span>
          ))}
        </p>
      ) : null}
      {sales ? (
        <>
          <h3>По продуктам</h3>
          <SalesTable rows={sales} excelPrices={sm ? pricesFromExcel(sm) : false} />
        </>
      ) : example ? (
        <>
          <h3>Пример</h3>
          <p>{example}</p>
        </>
      ) : null}
      {warns.length ? (
        <>
          <h3>Предупреждения</h3>
          <WarnList items={warns.slice(0, WARN_SHOWN)} projectId={project?.id} open={open} />
          {warns.length > WARN_SHOWN ? (
            <details className="how-more">
              <summary>Ещё {warns.length - WARN_SHOWN}</summary>
              <WarnList items={warns.slice(WARN_SHOWN)} projectId={project?.id} open={open} />
            </details>
          ) : null}
        </>
      ) : null}
      <div className="how-folds">
        {params.length ? (
          <details className="how-fold">
            <summary>Что влияет</summary>
            <ul className="deps">
              {params.map((d) => (
                <ParamDep key={d} id={d} m={sm} project={sp} open={open} />
              ))}
            </ul>
          </details>
        ) : null}
        {diff ? (
          <details className="how-fold">
            <summary>В исходном Excel</summary>
            <p>{diff}</p>
          </details>
        ) : null}
        {sources.length ? (
          <details className="how-fold">
            <summary>Источники</summary>
            <ul className="sources">
              {sources.map((s) => (
                <li key={s.id}>
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noreferrer">
                      {shortSource(s.title)}
                    </a>
                  ) : (
                    shortSource(s.title)
                  )}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        <details className="how-fold how-check">
          <summary>Для проверки (формула)</summary>
          <p className="muted small">
            {f.name} · <code>{f.id}</code>
          </p>
          <pre className="expr">{f.expr.trim()}</pre>
          {f.note ? <p className="formula-note">{humanize(f.note)}</p> : null}
          {f.terms && Object.keys(f.terms).length ? (
            <>
              <h4>Обозначения в формуле</h4>
              <ul className="terms">
                {Object.entries(f.terms).map(([k, v]) => (
                  <li key={k}>
                    <code>{k}</code> — {v}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {calc.length ? (
            <>
              <h4>Промежуточные показатели</h4>
              <ul className="deps">
                {calc.map((d) => (
                  <li key={d}>
                    <button className="dep" onClick={() => open({ kind: "formula", id: d })}>
                      <span>{getFormula(d).plain?.title ?? getFormula(d).name}</span>
                      <span className="dep-value muted">→</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <h4>Почему так</h4>
          <p>{humanize(f.rationale)}</p>
          {f.rejected.length ? (
            <>
              <h4>Что отклонено</h4>
              <ul>
                {f.rejected.map((r) => (
                  <li key={r}>{humanize(r)}</li>
                ))}
              </ul>
            </>
          ) : null}
          <h4>Коды входов</h4>
          <p className="small">
            {f.depends_on.map((d) => (
              <code key={d}>{d} </code>
            ))}
          </p>
          <Actions formula={f.id} source={f.source_ids[0]} />
        </details>
      </div>
    </>
  );
}

function ParamView({ id, projectId }: { id: ParameterId; projectId: string | null }) {
  const { projects, model, dispatch } = useStore();
  const project = projects.find((p) => p.id === projectId);
  const p = getParameter(id);
  const traced = project ? model(project).result.parameters[id] : undefined;
  const own = project?.input.values[id];
  const v = traced?.value ?? own ?? p.default;
  const origin = traced?.origin ?? (own !== undefined && own !== null ? "project" : "template");
  const linked = project ? project.sources.find((s) => s.id === project.paramSources[id]) : undefined;
  const usedBy = spec.formulas.filter((f) => (f.depends_on as string[]).includes(id));
  const change = project?.changes?.[id];
  const w = whence(id, project);
  // Типы проектных источников (документы проекта, экспертная оценка) — не документы, в список не выводятся.
  const refDocs = p.source_ids.filter((sid) => getSource(sid).scope === "global");
  return (
    <>
      <h2>{p.name}</h2>
      {compositeSummary(v) ? (
        <div className="how-table">
          <div className="muted small">{compositeSummary(v)}</div>
          <DataView value={v} />
        </div>
      ) : (
        <div className="how-value">
          {fmt.value(v ?? null)} {v !== null && v !== undefined ? fmt.unit(p.unit) : ""}
        </div>
      )}
      {project ? <ChangedMark project={project} id={id} /> : null}
      <p className="muted small">
        {change
          ? "Изменено в проекте — справочник не менялся"
          : origin === "project"
          ? "Введено в проекте"
          : origin === "region"
            ? "Из справочника регионов — подставляется по региону проекта"
            : p.scope === "template"
              ? "Значение справочника — одинаково для всех проектов; в проекте его можно изменить, указав, почему"
              : "Значение по умолчанию из справочника — можно заменить в проекте"}
      </p>
      {project && model(project).missing.has(id) ? (
        <p className="need-legend">
          <span className="need-badge">Заполните</span> Обязательное значение не введено — без него не считаются формулы из раздела «Где используется в расчёте» ниже.
        </p>
      ) : null}
      <h3>Откуда</h3>
      <p className="whence">
        {humanize(w.text)}
        {w.url ? (
          <>
            {" "}
            ·{" "}
            <a href={w.url} target="_blank" rel="noreferrer">
              открыть документ
            </a>
          </>
        ) : (
          <span className="nolink-badge" title="У значения есть только текст, ссылки на документ нет">
            нет ссылки
          </span>
        )}
      </p>
      {change ? (
        <ul className="small change-log">
          <li>Было: {valueText(id, change.before)}</li>
          <li>Стало: {valueText(id, change.after)}</li>
          <li>Кто: {change.author}</li>
          <li>
            Когда: {fmt.date(change.at.slice(0, 10))}, {change.at.slice(11, 16)}
          </li>
          <li>Почему: {change.why}</li>
        </ul>
      ) : null}
      {p.from?.text === p.basis ? null : (
        <>
          <h3>Что это</h3>
          <p>{humanize(p.basis)}</p>
        </>
      )}
      {p.how_to_fill ? (
        <>
          <h3>Где взять значение</h3>
          <p>{humanize(p.how_to_fill)}</p>
        </>
      ) : null}
      {project && (p.scope !== "template" || change) ? (
        <>
          <h3>Документ в проекте</h3>
          {linked ? (
            <p>
              {linked.url ? (
                <a href={linked.url} target="_blank" rel="noreferrer">
                  {linked.title}
                </a>
              ) : (
                linked.title
              )}
              <span className="muted small">
                {" "}
                · {linked.author}, {fmt.date(linked.date)}
                {linked.min && linked.max ? ` · диапазон ${linked.min}–${linked.max}` : ""}
              </span>
            </p>
          ) : (
            <p className="warn small">
              Документ не указан. Выберите ниже документ, из которого взято значение (договор, ТЭП, ГПЗУ, расчёт), или добавьте его в источники проекта.
              Пока документа нет, значение считается непроверенным.
            </p>
          )}
          <select value={linked?.id ?? ""} onChange={(e) => dispatch({ type: "linkSource", id: project.id, param: id, sourceId: e.target.value || null })}>
            <option value="">— выбрать источник проекта —</option>
            {project.sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          <p className="small">
            <Link href={`/projects/${project.id}?tab=docs`}>+ Загрузить документ</Link> · <Link href={`/sources?project=${project.id}&new=1`}>добавить ссылку или экспертную оценку</Link>
          </p>
        </>
      ) : null}
      {refDocs.length ? (
        <>
          <h3>Документы справочника</h3>
          <ul className="sources">
            {refDocs.map((sid) => (
              <SpecSource key={sid} id={sid} />
            ))}
          </ul>
        </>
      ) : null}
      {usedBy.length ? (
        <>
          <h3>Где используется в расчёте</h3>
          <ul className="small">
            {usedBy.map((f) => (
              <li key={f.id}>
                <Link href={`/formulas?id=${f.id}`}>{f.name}</Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <Actions source={linked ? linked.title : p.source_ids[0]} />
    </>
  );
}

function CapexView({ id, open }: { id: CapexItemId; open: (t: HowTarget) => void }) {
  const c = getCapexItem(id);
  const formula: FormulaId = c.formula ?? "F.CAPEX.ITEM_TOTAL";
  return (
    <>
      <h2>{c.name}</h2>
      <p className="muted small">Статья бюджета · группа «{c.group}»</p>
      <h3>Как считается</h3>
      <p>
        {c.base === "фикс" || c.base === "фикс_в_месяц" || c.base === "формула" ? (
          <>Основа суммы: {baseName(c.base)}. </>
        ) : (
          <>
            Сумма = {c.rate_param ? "ставка" : "стоимость"} × «{baseName(c.base)}»
            {c.rate_param ? (
              <>
                {" "}(ставка:{" "}
                <button className="link" onClick={() => open({ kind: "param", id: c.rate_param! })}>
                  {getParameter(c.rate_param).name}
                </button>
                )
              </>
            ) : null}
            .{" "}
          </>
        )}
        Цена статьи {indexName(c.index_type)}.
      </p>
      <p>
        Когда платится: {scheduleName(c.schedule_rule)}
        {c.schedule_from
          ? `, ${c.schedule_to ? `с даты «${milestoneName(c.schedule_from)}» до даты «${milestoneName(c.schedule_to)}»` : `в дату «${milestoneName(c.schedule_from)}»`}`
          : ""}
        .
      </p>
      <h3>Почему так</h3>
      <p>{humanize(c.basis)}</p>
      <h3>Формула</h3>
      <button className="dep" onClick={() => open({ kind: "formula", id: formula })}>
        <span>{getFormula(formula).name}</span>
        <span className="dep-value">→</span>
      </button>
      <h3>Источники</h3>
      <ul className="sources">
        {c.source_ids.map((sid) => (
          <SpecSource key={sid} id={sid} />
        ))}
      </ul>
      {c.legacy.issue ? <p className="small muted">В исходном Excel: {humanize(c.legacy.issue)}</p> : null}
      <Actions formula={formula} source={c.source_ids[0]} />
    </>
  );
}
