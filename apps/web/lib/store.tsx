"use client";

import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";
import { spec, type ParameterId } from "@fm/spec";
import type { DemoProject, ProjectSource, Seed } from "./types";
import { computeProject, type ProjectModel } from "./model";

type Action =
  | { type: "create"; project: DemoProject }
  | { type: "copy"; id: string; newId: string }
  | { type: "archive"; id: string; archived: boolean }
  | { type: "delete"; id: string }
  | { type: "value"; id: string; param: ParameterId; value: unknown }
  | { type: "addSource"; id: string; source: ProjectSource }
  | { type: "removeSource"; id: string; sourceId: string }
  | { type: "linkSource"; id: string; param: ParameterId; sourceId: string | null };

function touch(p: DemoProject, patch: Partial<DemoProject>): DemoProject {
  return { ...p, ...patch, updatedAt: new Date().toISOString(), specVersion: spec.specVersion };
}

function reducer(state: DemoProject[], a: Action): DemoProject[] {
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
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ seed, children }: { seed: Seed; children: ReactNode }) {
  const [projects, dispatch] = useReducer(reducer, seed.projects);
  const models = useMemo(() => new Map(projects.map((p) => [p.id, computeProject(p)])), [projects]);
  const store = useMemo<Store>(() => ({ projects, dispatch, model: (p) => models.get(p.id) ?? computeProject(p) }), [projects, models]);
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("StoreProvider не подключён");
  return s;
}
