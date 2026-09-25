"use client";

import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";
import { spec, type ParameterId } from "@fm/spec";
import type { DemoProject, ProjectSource, ProjectStatus, Seed } from "./types";
import { computeProject, type ProjectModel } from "./model";

type Action =
  | { type: "create"; project: DemoProject }
  | { type: "rename"; id: string; name: string }
  | { type: "copy"; id: string; newId: string }
  | { type: "archive"; id: string; archived: boolean }
  | { type: "status"; id: string; status: ProjectStatus }
  | { type: "value"; id: string; param: ParameterId; value: unknown }
  | { type: "source"; id: string; param: ParameterId; source: ProjectSource | null }
  | { type: "milestone"; id: string; phase: number; key: string; date: string | null };

const now = () => new Date().toISOString();

function touch(p: DemoProject, patch: Partial<DemoProject>): DemoProject {
  return { ...p, ...patch, updatedAt: now(), specVersion: spec.specVersion };
}

function reducer(state: DemoProject[], a: Action): DemoProject[] {
  const target = "id" in a ? a.id : null;
  const map = (fn: (p: DemoProject) => DemoProject) => state.map((p) => (p.id === target ? fn(p) : p));
  switch (a.type) {
    case "create":
      return [...state, a.project];
    case "rename":
      return map((p) => touch(p, { name: a.name, input: { ...p.input, values: { ...p.input.values, "GEN.PROJECT_NAME": a.name } } }));
    case "copy": {
      const src = state.find((p) => p.id === a.id);
      if (!src) return state;
      const name = `${src.name} (копия)`;
      return [...state, { ...structuredClone(src), id: a.newId, name, status: "draft", archived: false, copiedFrom: src.id, updatedAt: now(), specVersion: spec.specVersion, input: { ...structuredClone(src.input), values: { ...structuredClone(src.input.values), "GEN.PROJECT_NAME": name } } }];
    }
    case "archive":
      return map((p) => touch(p, { archived: a.archived }));
    case "status":
      return map((p) => touch(p, { status: a.status }));
    case "value":
      return map((p) => touch(p, { input: { ...p.input, values: { ...p.input.values, [a.param]: a.value } } }));
    case "source":
      return map((p) => {
        const sources = { ...p.sources };
        if (a.source) sources[a.param] = a.source;
        else delete sources[a.param];
        return touch(p, { sources });
      });
    case "milestone":
      return map((p) => {
        const rows = (p.input.values["TIME.MILESTONES"] as Record<string, unknown>[] | undefined) ?? [];
        const exists = rows.some((r) => r.phase === a.phase);
        const next = (exists ? rows : [...rows, { phase: a.phase }]).map((r) => (r.phase === a.phase ? { ...r, [a.key]: a.date } : r));
        return touch(p, { input: { ...p.input, values: { ...p.input.values, "TIME.MILESTONES": next } } });
      });
  }
}

interface Store {
  projects: DemoProject[];
  dispatch: (a: Action) => void;
  model: (p: DemoProject) => ProjectModel;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ seed, children }: { seed: Seed; children: ReactNode }) {
  const [projects, dispatch] = useReducer(reducer, seed.projects);
  const models = useMemo(() => new Map(projects.map((p) => [p.id, computeProject(p)])), [projects]);
  const store = useMemo<Store>(
    () => ({ projects, dispatch, model: (p) => models.get(p.id) ?? computeProject(p) }),
    [projects, models],
  );
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("StoreProvider не подключён");
  return s;
}
