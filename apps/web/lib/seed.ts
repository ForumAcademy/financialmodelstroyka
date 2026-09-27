import { legacyCaseInput, legacyChecks, type LegacyCase } from "@fm/engine";
import { spec, type ParameterId } from "@fm/spec";
import derbenevskaya from "./generated/derbenevskaya.json";
import { assumptionParams, SPEC_ASSUMPTIONS } from "./assumptions";
import type { Seed } from "./types";

/** Демо-данные (docs/01: демо-проект из tests/cases). До этапа 7 изменения живут до перезагрузки страницы. */
export function loadSeed(): Seed {
  const c = derbenevskaya as unknown as LegacyCase;
  const excel = legacyCaseInput(c);
  // Значения справочника допущений (маркетинг, структура оплат, условия финансирования…) проект берёт из справочника:
  // версия 1 заполнена из этого же Excel, поэтому числа те же, а вопросы к данным просят финансистов их подтвердить.
  // Расчёт «как в исходном Excel» берёт их из исходника (lib/model.ts, effectiveInput).
  const params = assumptionParams(SPEC_ASSUMPTIONS);
  const input = { ...excel, values: Object.fromEntries(Object.entries(excel.values).filter(([k]) => !params.has(k as ParameterId))) };
  return {
    projects: [
      {
        id: "derbenevskaya",
        name: "Дербеневская (демо)",
        archived: false,
        input: { ...input, values: { ...input.values, "GEN.PROJECT_NAME": "Дербеневская (демо)" } },
        sources: [],
        paramSources: {},
        legacyWarnings: legacyChecks(c),
        legacyCase: c,
        specVersion: spec.specVersion,
        assumptionsVersion: 1,
        updatedAt: "2026-09-25T09:00:00.000Z",
        note: String(c.project_inputs["TIME.MILESTONES_NOTE"] ?? ""),
      },
    ],
  };
}
