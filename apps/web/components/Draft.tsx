"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type Decimal from "decimal.js";
import { getParameter, isParameterId, spec, type ParameterId } from "@fm/spec";
import { savedAuthor } from "./Change";
import { computeProject, type ProjectModel } from "@/lib/model";
import { COLUMN_LABEL, fieldLabel, toField, unitOf } from "@/lib/field-view";
import * as fmt from "@/lib/format";
import { reducer, StoreOverride, useStore, type Action, type Store } from "@/lib/store";
import type { DemoProject } from "@/lib/types";

const AUTHOR_KEY = "fm.author";

/** Правки вводных, которые копятся в черновике до «Сохранить» (раздел 3.3 задания, «Несохранённые изменения»). */
const DRAFT_ACTIONS: Action["type"][] = ["value", "change", "revert"];

const DraftCtx = createContext<boolean>(false);

/** Правка поля идёт в черновик проекта: комментарий «почему» спрашивается один раз, в панели при сохранении. */
export const useInDraft = (): boolean => useContext(DraftCtx);

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Изменённые параметры черновика относительно сохранённого проекта. */
function changedParams(saved: DemoProject, draft: DemoProject): ParameterId[] {
  const keys = new Set([...Object.keys(saved.input.values), ...Object.keys(draft.input.values)]);
  return [...keys].filter((k): k is ParameterId => isParameterId(k) && !same(saved.input.values[k as ParameterId], draft.input.values[k as ParameterId]));
}

/** Черновик вводных проекта: поля пишут в черновик, расчёт на странице идёт по черновику, панель предлагает сохранить. */
export function DraftProvider({ projectId, children }: { projectId: string; children: ReactNode }) {
  const store = useStore();
  const saved = store.projects.find((p) => p.id === projectId);
  const [draft, setDraft] = useState<DemoProject | null>(null);
  const draftModel = useMemo(() => (draft ? computeProject(draft, store.assumptions) : null), [draft, store.assumptions]);
  const dispatch = useCallback(
    (a: Action) => {
      const own = "id" in a && a.id === projectId;
      if (own && saved && DRAFT_ACTIONS.includes(a.type)) {
        setDraft((d) => reducer([d ?? saved], a)[0] ?? d);
        return;
      }
      store.dispatch(a);
      // прочие действия (документы, статусы расхождений) сохраняются сразу — и попадают в черновик, чтобы «Сохранить» их не затёр
      if (own) setDraft((d) => (d ? (reducer([d], a)[0] ?? d) : d));
    },
    [projectId, saved, store],
  );
  const value = useMemo<Store>(
    () => ({
      ...store,
      projects: store.projects.map((p) => (p.id === projectId && draft ? draft : p)),
      dispatch,
      model: (p: DemoProject) => (draft && draftModel && p.id === projectId ? draftModel : store.model(p)),
    }),
    [store, projectId, draft, draftModel, dispatch],
  );
  const dirty = saved && draft ? changedParams(saved, draft) : [];
  return (
    <StoreOverride value={value}>
      <DraftCtx.Provider value={true}>
        {children}
        {saved && draft && draftModel && dirty.length ? (
          <UnsavedPanel
            saved={saved}
            draft={draft}
            before={store.model(saved)}
            after={draftModel}
            params={dirty}
            onCancel={() => setDraft(null)}
            onSave={(project) => {
              store.dispatch({ type: "replace", id: projectId, project });
              setDraft(null);
            }}
          />
        ) : null}
      </DraftCtx.Provider>
    </StoreOverride>
  );
}

const BILLION = 1e9;

/** Выручка с НДС и бюджет из ядра, млрд руб.; не посчитано — null. */
function totals(m: ProjectModel): { revenue: number | null; budget: number | null } {
  const rev = m.result.formulas["F.SALES.REVENUE_TOTAL"]?.value as { gross?: Decimal } | undefined;
  const budget = m.result.formulas["F.CAPEX.TOTAL"]?.value as Decimal | undefined;
  return { revenue: rev?.gross ? rev.gross.toNumber() / BILLION : null, budget: budget ? budget.toNumber() / BILLION : null };
}

const sign = (x: number, digits: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${fmt.num(Math.abs(x), digits)}`;

/** «цена квартир: 497 703 → 480 000 руб/м² (−3,6 %)»; таблица — «изменено». */
function changeText(id: ParameterId, before: unknown, after: unknown): string {
  const label = fieldLabel(id);
  const p = getParameter(id);
  if (typeof after === "number" && (typeof before === "number" || before === null || before === undefined)) {
    const u = unitOf(p.unit, id);
    const b = typeof before === "number" ? toField(before, u) : "—";
    const pct = typeof before === "number" && before !== 0 ? ` (${sign(((after - before) / Math.abs(before)) * 100, 1)} %)` : "";
    return `${label}: ${b} → ${toField(after, u)} ${u.label}${pct}`.replace(/\s+\(/, " (");
  }
  if (typeof after === "string" || typeof after === "boolean") return `${label}: ${fmt.value(before ?? null)} → ${fmt.value(after)}`;
  const cells = Array.isArray(after) && Array.isArray(before) ? tableCells(id, before as Row[], after as Row[]) : [];
  return cells.length ? cells.join("; ") : `${label}: изменено`;
}

type Row = Record<string, unknown>;

/** Изменённые ячейки таблицы: «Квартиры Тип 1, стартовая цена: 497 703 → 480 000 (−3,6 %)». */
function tableCells(id: ParameterId, before: Row[], after: Row[]): string[] {
  const units = new Map((getParameter(id).columns ?? []).map((c) => [c.key, c.unit]));
  const name = (r: Row | undefined, i: number) => {
    const item = typeof r?.item_id === "string" ? spec.capexItems.find((c) => c.item_id === r.item_id)?.name : undefined;
    return String(item ?? r?.name ?? r?.product ?? (r?.phase !== undefined ? `Очередь ${String(r.phase)}` : `строка ${i + 1}`));
  };
  const out: string[] = [];
  for (let i = 0; i < Math.max(before.length, after.length); i++) {
    const b = before[i] ?? {};
    const a = after[i] ?? {};
    for (const k of new Set([...Object.keys(b), ...Object.keys(a)])) {
      if (same(b[k], a[k]) || k.startsWith("schedule")) continue;
      const col = k === "rate" ? "сумма" : (COLUMN_LABEL[k] ?? k).toLowerCase();
      const x = b[k];
      const y = a[k];
      if (typeof y === "number") {
        const u = unitOf(units.get(k) ?? "");
        const pct = typeof x === "number" && x !== 0 ? ` (${sign(((y - x) / Math.abs(x)) * 100, 1)} %)` : "";
        out.push(`${name(a, i)}, ${col}: ${typeof x === "number" ? toField(x, u) : "—"} → ${toField(y, u)}${pct}`);
      } else out.push(`${name(a, i)}, ${col}: ${fmt.value(x ?? null)} → ${fmt.value(y ?? null)}`);
    }
  }
  return out.length > 3 ? [...out.slice(0, 3), `и ещё ${out.length - 3}`] : out;
}

function UnsavedPanel({
  saved,
  draft,
  before,
  after,
  params,
  onCancel,
  onSave,
}: {
  saved: DemoProject;
  draft: DemoProject;
  before: ProjectModel;
  after: ProjectModel;
  params: ParameterId[];
  onCancel: () => void;
  onSave: (project: DemoProject) => void;
}) {
  const [why, setWhy] = useState("");
  const [author, setAuthor] = useState(savedAuthor);
  const [error, setError] = useState("");
  // «почему» нужно, если меняется уже заданное значение; пустое поле заполняется без комментария
  const needWhy = params.some((id) => draft.changes?.[id] && !draft.changes[id]?.why);
  const b = totals(before);
  const a = totals(after);
  const row = (label: string, x: number | null, y: number | null) =>
    x === null && y === null ? null : (
      <tr key={label}>
        <td>{label}</td>
        <td>
          {x === null ? "—" : fmt.num(x, 1)} → <b>{y === null ? "—" : fmt.num(y, 1)}</b> млрд руб
        </td>
        <td className={y !== null && x !== null && y - x < 0 ? "neg" : ""}>{x !== null && y !== null ? sign(y - x, 1) : ""}</td>
      </tr>
    );
  const save = () => {
    if (needWhy && !why.trim()) return setError("Напишите, почему меняете значения");
    if (needWhy && !author.trim()) return setError("Укажите, кто меняет");
    if (author.trim()) {
      try {
        localStorage.setItem(AUTHOR_KEY, author.trim());
      } catch {
        /* имя автора — только удобство */
      }
    }
    const changes = Object.fromEntries(Object.entries(draft.changes ?? {}).map(([k, c]) => [k, c && !c.why ? { ...c, why: why.trim(), author: author.trim() } : c]));
    onSave({ ...draft, changes });
  };
  return (
    <aside className="unsaved" aria-label="Несохранённые изменения">
      <b>Несохранённые изменения</b>
      <ul>
        {params.map((id) => (
          <li key={id}>{changeText(id, saved.input.values[id] ?? before.standard[id], draft.input.values[id])}</li>
        ))}
      </ul>
      <table className="dtab">
        <tbody>
          {row("Выручка", b.revenue, a.revenue)}
          {b.budget !== a.budget ? row("Бюджет", b.budget, a.budget) : null}
        </tbody>
      </table>
      {needWhy ? <textarea placeholder="Почему меняете (обязательно)" value={why} onChange={(e) => setWhy(e.target.value)} rows={2} /> : null}
      {needWhy && !savedAuthor() ? <input placeholder="Кто меняет" value={author} onChange={(e) => setAuthor(e.target.value)} /> : null}
      <div className="unsaved-actions">
        <button className="btn primary small" onClick={save}>
          Сохранить
        </button>
        <button className="btn small" onClick={onCancel}>
          Отменить
        </button>
        {error ? <span className="error small">{error}</span> : null}
      </div>
    </aside>
  );
}
