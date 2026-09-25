import { legacyCaseInput, type LegacyCase } from "@fm/engine";
import { spec } from "@fm/spec";
import derbenevskaya from "./generated/derbenevskaya.json";
import type { Seed } from "./types";

/** Демо-данные (docs/01: демо-проект из tests/cases). До этапа 7 изменения живут до перезагрузки страницы. */
export function loadSeed(): Seed {
  const c = derbenevskaya as unknown as LegacyCase;
  const input = legacyCaseInput(c);
  return {
    projects: [
      {
        id: "derbenevskaya",
        name: "Дербеневская (демо)",
        status: "in_progress",
        archived: false,
        input: { ...input, values: { ...input.values, "GEN.PROJECT_NAME": "Дербеневская (демо)" } },
        sources: {},
        specVersion: spec.specVersion,
        updatedAt: "2026-09-25T09:00:00.000Z",
        note: String(c.project_inputs["TIME.MILESTONES_NOTE"] ?? ""),
      },
    ],
  };
}
