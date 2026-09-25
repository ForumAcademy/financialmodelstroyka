"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { getCapexItem, getFormula, getParameter, getSource, spec, type CapexItemId, type FormulaId, type ParameterId, type SourceId } from "@fm/spec";
import * as fmt from "@/lib/format";
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

const LEVEL = ["", "закон / НПА", "статистика", "рынок", "документ компании / проекта", "экспертная оценка"];

function SpecSource({ id }: { id: SourceId }) {
  const s = getSource(id);
  return (
    <li>
      <span className={`lvl lvl${s.level}`}>{s.level}</span>{" "}
      {s.url ? (
        <a href={s.url} target="_blank" rel="noreferrer">
          {s.title}
        </a>
      ) : (
        s.title
      )}
      <div className="muted small">
        {LEVEL[s.level]}
        {s.accessed ? ` · проверено ${fmt.date(s.accessed)}` : ""}
        {s.verified === false ? " · не сверен" : ""}
        {s.scope === "project" ? " · документ указывается в проекте" : ""}
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
  return (
    <>
      <h2>{p.name}</h2>
      <div className="how-value">
        {fmt.value(v ?? null)} {v !== null && v !== undefined ? fmt.unit(p.unit) : ""}
      </div>
      <p className="muted small">{origin === "project" ? "Вводное значение проекта" : origin === "region" ? "Из справочника регионов" : "Значение справочника"}</p>
      <h3>Что это</h3>
      <p>{p.basis}</p>
      {p.how_to_fill ? (
        <>
          <h3>Где взять значение</h3>
          <p>{p.how_to_fill}</p>
        </>
      ) : null}
      {project && p.scope !== "template" ? (
        <>
          <h3>Источник значения в проекте</h3>
          {linked ? (
            <p>
              <span className={`lvl lvl${linked.level}`}>{linked.level}</span>{" "}
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
                {linked.level === 5 ? ` · диапазон ${linked.min}–${linked.max}` : ""}
              </span>
            </p>
          ) : (
            <p className="warn small">Источник не указан</p>
          )}
          <select value={linked?.id ?? ""} onChange={(e) => dispatch({ type: "linkSource", id: project.id, param: id, sourceId: e.target.value || null })}>
            <option value="">— выбрать источник проекта —</option>
            {project.sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.level} · {s.title}
              </option>
            ))}
          </select>
          <p className="small">
            <Link href={`/sources?project=${project.id}&new=1`}>+ Добавить источник проекта</Link>
          </p>
        </>
      ) : null}
      <h3>Источники справочника</h3>
      <ul className="sources">
        {p.source_ids.map((sid) => (
          <SpecSource key={sid} id={sid} />
        ))}
      </ul>
      {usedBy.length ? (
        <>
          <h3>Используется в формулах</h3>
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
        Сумма = ставка × база × индекс. База: <strong>{c.base}</strong>
        {c.rate_param ? (
          <>
            , ставка: <button className="link" onClick={() => open({ kind: "param", id: c.rate_param! })}>{getParameter(c.rate_param).name}</button>
          </>
        ) : null}
        . График расходования: {c.schedule_rule}
        {c.schedule_from ? ` (${c.schedule_from}${c.schedule_to ? ` → ${c.schedule_to}` : ""})` : ""}.
      </p>
      <h3>Почему так</h3>
      <p>{c.basis}</p>
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
      {c.legacy.issue ? <p className="small muted">В исходном Excel: {c.legacy.issue}</p> : null}
      <Actions formula={formula} source={c.source_ids[0]} />
    </>
  );
}
