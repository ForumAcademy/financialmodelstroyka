"use client";

import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";
import { spec, type ParameterId } from "@fm/spec";
import type { DemoProject, IssueEvent, IssueNote, ProjectSource, Seed, ValueChange } from "./types";
import { computeProject, type ProjectModel } from "./model";
import type { SourceCheck } from "./sources";

type Action =
  | { type: "create"; project: DemoProject }
  | { type: "copy"; id: string; newId: string }
  | { type: "archive"; id: string; archived: boolean }
  | { type: "delete"; id: string }
  | { type: "value"; id: string; param: ParameterId; value: unknown }
  | { type: "addSource"; id: string; source: ProjectSource }
  | { type: "removeSource"; id: string; sourceId: string }
  | { type: "renameSource"; id: string; sourceId: string; title: string }
  | { type: "linkSource"; id: string; param: ParameterId; sourceId: string | null }
  | { type: "change"; id: string; param: ParameterId; before: unknown; value: unknown; why: string; url?: string; author: string }
  | { type: "revert"; id: string; param: ParameterId }
  | { type: "issue"; id: string; key: string; no: number; question: string; event: IssueEvent }
  | { type: "issueNote"; id: string; key: string; no: number; question: string; note: IssueNote };

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function touch(p: DemoProject, patch: Partial<DemoProject>): DemoProject {
  return { ...p, ...patch, updatedAt: new Date().toISOString(), specVersion: spec.specVersion };
}

export function reducer(state: DemoProject[], a: Action): DemoProject[] {
  const map = (fn: (p: DemoProject) => DemoProject) => state.map((p) => ("id" in a && p.id === a.id ? fn(p) : p));
  switch (a.type) {
    case "create":
      return [...state, a.project];
    case "copy": {
      const src = state.find((p) => p.id === a.id);
      if (!src) return state;
      const name = `${src.name} (копия)`;
      const copy = structuredClone(src);
      return [...state, { ...copy, id: a.newId, name, archived: false, updatedAt: new Date().toISOString(), input: { ...copy.input, values: { ...copy.input.values, "GEN.PROJECT_NAME": name } } }];
    }
    case "archive":
      return map((p) => touch(p, { archived: a.archived }));
    case "delete":
      return state.filter((p) => p.id !== a.id);
    case "value":
      return map((p) =>
        touch(p, {
          ...(a.param === "GEN.PROJECT_NAME" && typeof a.value === "string" && a.value.trim() ? { name: a.value.trim() } : {}),
          input: { ...p.input, values: { ...p.input.values, [a.param]: a.value } },
        }),
      );
    case "addSource":
      return map((p) => touch(p, { sources: [...p.sources, a.source] }));
    case "removeSource":
      return map((p) =>
        touch(p, {
          sources: p.sources.filter((s) => s.id !== a.sourceId),
          paramSources: Object.fromEntries(Object.entries(p.paramSources).filter(([, v]) => v !== a.sourceId)),
        }),
      );
    case "renameSource":
      return map((p) => touch(p, { sources: p.sources.map((s) => (s.id === a.sourceId ? { ...s, title: a.title } : s)) }));
    case "change":
      return map((p) => {
        const own = p.input.values[a.param];
        const prev = p.changes?.[a.param];
        const hadOwn = prev ? prev.hadOwn : own !== undefined && own !== null;
        const before = prev ? prev.before : a.before;
        const changes = { ...p.changes };
        // Возврат к исходному значению снимает пометку «изменено».
        if (same(before, a.value)) delete changes[a.param];
        else {
          const c: ValueChange = { before, hadOwn, after: a.value, why: a.why, author: a.author, at: new Date().toISOString() };
          if (a.url) c.url = a.url;
          changes[a.param] = c;
        }
        return touch(p, { changes, input: { ...p.input, values: { ...p.input.values, [a.param]: a.value } } });
      });
    case "revert":
      return map((p) => {
        const c = p.changes?.[a.param];
        if (!c) return p;
        const values = { ...p.input.values };
        if (c.hadOwn) values[a.param] = c.before;
        else delete values[a.param];
        const changes = { ...p.changes };
        delete changes[a.param];
        return touch(p, { changes, input: { ...p.input, values } });
      });
    case "issue":
      return map((p) => {
        const prev = p.issues?.[a.key];
        const state = { ...prev, status: a.event.status, history: [...(prev?.history ?? []), a.event], no: a.no, question: a.question };
        return touch(p, { issues: { ...p.issues, [a.key]: state } });
      });
    case "issueNote":
      return map((p) => {
        const prev = p.issues?.[a.key];
        const state = { status: prev?.status ?? "open", history: prev?.history ?? [], no: a.no, question: a.question, notes: [...(prev?.notes ?? []), a.note] };
        return touch(p, { issues: { ...p.issues, [a.key]: state } });
      });
    case "linkSource":
      return map((p) => {
        const paramSources = { ...p.paramSources };
        if (a.sourceId) paramSources[a.param] = a.sourceId;
        else delete paramSources[a.param];
        return touch(p, { paramSources });
      });
  }
}

interface Store {
  projects: DemoProject[];
  dispatch: (a: Action) => void;
  model: (p: DemoProject) => ProjectModel;
  /** Отметки «проверено» по общим источникам (ID источника → кто, когда, комментарий). */
  sourceChecks: Record<string, SourceCheck>;
  setSourceCheck: (sourceId: string, check: SourceCheck | null) => void;
}

function checksReducer(state: Record<string, SourceCheck>, a: { id: string; check: SourceCheck | null }): Record<string, SourceCheck> {
  const next = { ...state };
  if (a.check) next[a.id] = a.check;
  else delete next[a.id];
  return next;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ seed, children }: { seed: Seed; children: ReactNode }) {
  const [projects, dispatch] = useReducer(reducer, seed.projects);
  const [sourceChecks, dispatchCheck] = useReducer(checksReducer, {});
  const models = useMemo(() => new Map(projects.map((p) => [p.id, computeProject(p)])), [projects]);
  const store = useMemo<Store>(
    () => ({
      projects,
      dispatch,
      model: (p) => models.get(p.id) ?? computeProject(p),
      sourceChecks,
      setSourceCheck: (id, check) => dispatchCheck({ id, check }),
    }),
    [projects, models, sourceChecks],
  );
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("StoreProvider не подключён");
  return s;
}
