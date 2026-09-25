"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { ResultSet } from "@fm/engine";
import { getFormula, getParameter, getSource, spec, type FormulaId, type ParameterId, type SourceId } from "@fm/spec";
import * as fmt from "@/lib/format";
import { isParameterIdLike, stageOf } from "@/lib/model";
import type { DemoProject } from "@/lib/types";
import { SourceEditor } from "./SourceEditor";

type Target = { id: FormulaId | ParameterId; result?: ResultSet; project?: DemoProject };

const Ctx = createContext<(t: Target) => void>(() => {});
export const usePassport = () => useContext(Ctx);

const LEVEL = ["", "закон / НПА", "статистика", "рынок", "документ компании / проекта", "экспертная оценка"];

function SourceLink({ id }: { id: SourceId }) {
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
        {s.scope === "project" ? " · документ прикладывается в проекте" : ""}
        {s.accessed ? ` · проверено ${fmt.date(s.accessed)}` : ""}
        {s.verified === false ? " · не сверен" : ""}
      </div>
    </li>
  );
}

function Tree({ id, result, open, depth }: { id: FormulaId | ParameterId; result?: ResultSet | undefined; open: (id: FormulaId | ParameterId) => void; depth: number }) {
  const isParam = isParameterIdLike(id);
  const name = isParam ? getParameter(id).name : getFormula(id as FormulaId).name;
  const v = isParam ? result?.parameters[id]?.value : result?.formulas[id as FormulaId]?.value;
  const deps = isParam ? [] : getFormula(id as FormulaId).depends_on;
  return (
    <li>
      <button className="link" onClick={() => open(id)}>
        <code>{id}</code>
      </button>{" "}
      <span className="muted">{name}</span>
      {v !== undefined ? <span className="tree-value"> = {fmt.value(v)}</span> : null}
      {deps.length > 0 && depth < 2 ? (
        <ul className="tree">
          {deps.map((d) => (
            <Tree key={d} id={d} result={result} open={open} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function PassportProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<Target | null>(null);
  const open = useCallback((t: Target) => setTarget(t), []);
  const goto = (id: FormulaId | ParameterId) => target && setTarget({ ...target, id });

  return (
    <Ctx.Provider value={open}>
      {children}
      {target ? (
        <aside className="drawer" role="dialog" aria-label="Паспорт показателя">
          <div className="drawer-head">
            <span className="muted small">Паспорт показателя</span>
            <button className="icon" onClick={() => setTarget(null)} aria-label="Закрыть">
              ✕
            </button>
          </div>
          {isParameterIdLike(target.id) ? <ParamPassport target={target as Target & { id: ParameterId }} /> : <FormulaPassport target={target as Target & { id: FormulaId }} goto={goto} />}
        </aside>
      ) : null}
    </Ctx.Provider>
  );
}

function FormulaPassport({ target, goto }: { target: Target & { id: FormulaId }; goto: (id: FormulaId | ParameterId) => void }) {
  const f = getFormula(target.id);
  const node = target.result?.formulas[target.id];
  const stage = stageOf(target.id);
  return (
    <div className="drawer-body">
      <h2>{f.name}</h2>
      <code>{f.id}</code>
      <div className="passport-value">
        {node ? `${fmt.value(node.value)} ${fmt.unit(f.unit)}` : target.result ? `ещё не считается — этап ${stage ?? "?"}` : "формула справочника"}
      </div>
      <h3>Формула</h3>
      <pre className="expr">{f.expr.trim()}</pre>
      {f.lag_depends_on?.length ? <p className="small muted">Значение за прошлый месяц: {f.lag_depends_on.join(", ")}</p> : null}
      <h3>Почему так</h3>
      <p>{f.rationale}</p>
      {f.rejected.length ? (
        <>
          <h3>Отклонённые варианты</h3>
          <ul>
            {f.rejected.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </>
      ) : null}
      <h3>Зависит от</h3>
      <ul className="tree">
        {f.depends_on.map((d) => (
          <Tree key={d} id={d} result={target.result} open={goto} depth={0} />
        ))}
      </ul>
      <h3>Источники</h3>
      <ul className="sources">
        {f.source_ids.map((id) => (
          <SourceLink key={id} id={id} />
        ))}
      </ul>
      <p className="small muted">
        Статус: {f.status === "verified" ? "сверено" : "требует сверки"} · справочник {spec.specVersion}
      </p>
    </div>
  );
}

function ParamPassport({ target }: { target: Target & { id: ParameterId } }) {
  const p = getParameter(target.id);
  const traced = target.result?.parameters[target.id];
  const own = target.project?.input.values[target.id];
  const v = traced?.value ?? own ?? p.default;
  const origin = traced?.origin ?? (own !== undefined && own !== null ? "project" : "template");
  const usedBy = spec.formulas.filter((f) => (f.depends_on as string[]).includes(target.id));
  return (
    <div className="drawer-body">
      <h2>{p.name}</h2>
      <code>{p.id}</code>
      <div className="passport-value">
        {fmt.value(v ?? null)} {v !== null && v !== undefined ? fmt.unit(p.unit) : ""}
      </div>
      <p className="small muted">
        {origin === "project" ? "Введено по проекту" : origin === "region" ? "Из справочника регионов" : "Значение справочника"} · область: {p.scope}
      </p>
      {target.project && p.scope !== "template" ? <SourceEditor project={target.project} param={target.id} /> : null}
      <h3>Почему такое значение</h3>
      <p>{p.basis}</p>
      {p.how_to_fill ? (
        <>
          <h3>Где взять значение</h3>
          <p>{p.how_to_fill}</p>
        </>
      ) : null}
      <h3>Источники справочника</h3>
      <ul className="sources">
        {p.source_ids.map((id) => (
          <SourceLink key={id} id={id} />
        ))}
      </ul>
      {usedBy.length ? (
        <>
          <h3>Используется в формулах</h3>
          <ul>
            {usedBy.map((f) => (
              <li key={f.id}>
                <code>{f.id}</code> <span className="muted">{f.name}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
