"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { getCapexItem, getFormula, getParameter, getSource, spec, type CapexItemId, type FormulaId, type ParameterId, type SourceId } from "@fm/spec";
import * as fmt from "@/lib/format";
import { compositeSummary, DataView } from "./DataView";
import { ChangedMark, valueText } from "./Change";
import { whence } from "@/lib/whence";
import { baseName, humanize, indexName, milestoneName, scheduleName } from "@/lib/humanize";
import { isParameterIdLike, stageOf } from "@/lib/model";
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

function FormulaView({ t, projectId, open }: { t: Extract<HowTarget, { kind: "formula" }>; projectId: string | null; open: (t: HowTarget) => void }) {
  const { projects, model } = useStore();
  const project = projects.find((p) => p.id === projectId);
  const m = project ? model(project) : null;
  const f = getFormula(t.id);
  const node = m?.result.formulas[t.id];
  const errors = m?.result.messages.filter((x) => x.formulaId === t.id && x.severity === "error") ?? [];
  return (
    <>
      <h2>{t.label ?? f.name}</h2>
      <div className="how-value">{t.value ?? (node ? `${fmt.value(node.value)} ${fmt.unit(f.unit)}` : "—")}</div>
      {!node && m ? <p className="muted small">{errors.length ? `Не посчитано: ${errors.map((e) => e.text).join("; ")}` : `Расчёт — этап ${stageOf(t.id) ?? "?"}`}</p> : null}
      <h3>Формула</h3>
      <p>{f.name}</p>
      <pre className="expr">{f.expr.trim()}</pre>
      {f.note ? <p className="formula-note">{humanize(f.note)}</p> : null}
      {f.terms && Object.keys(f.terms).length ? (
        <>
          <h3>Обозначения в формуле</h3>
          <ul className="terms">
            {Object.entries(f.terms).map(([k, v]) => (
              <li key={k}>
                <code>{k}</code> — {v}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <h3>Почему так</h3>
      <p>{humanize(f.rationale)}</p>
      {f.rejected.length ? (
        <>
          <h3>Что отклонено</h3>
          <ul>
            {f.rejected.map((r) => (
              <li key={r}>{humanize(r)}</li>
            ))}
          </ul>
        </>
      ) : null}
      <h3>Из чего складывается</h3>
      <ul className="deps">
        {f.depends_on.map((d) => {
          const isParam = isParameterIdLike(d);
          const name = isParam ? getParameter(d).name : getFormula(d as FormulaId).name;
          const v = isParam ? m?.result.parameters[d]?.value : m?.result.formulas[d as FormulaId]?.value;
          return (
            <li key={d}>
              <button className="dep" onClick={() => open(isParam ? { kind: "param", id: d } : { kind: "formula", id: d as FormulaId })}>
                <span>{name}</span>
                <span className="dep-value">{v !== undefined ? fmt.value(v) : isParam ? "не задано" : "—"}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <h3>Источники</h3>
      <ul className="sources">
        {f.source_ids.map((id) => (
          <SpecSource key={id} id={id} />
        ))}
      </ul>
      <Actions formula={f.id} source={f.source_ids[0]} />
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
