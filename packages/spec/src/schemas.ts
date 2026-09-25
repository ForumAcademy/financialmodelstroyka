/**
 * zod-схемы справочника data/*.yaml. Схемы строгие (`strict`): неизвестное поле в YAML —
 * ошибка сборки, чтобы опечатка в имени поля не терялась молча.
 *
 * Файл не импортирует других модулей пакета: его подключает генератор scripts/build-spec.ts.
 */
import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "дата в формате ГГГГ-ММ-ДД");
const idList = z.array(z.string().min(1));

// ---------- sources.yaml ----------

export const SOURCE_LEVELS = [1, 2, 3, 4, 5] as const;

export const sourceSchema = z
  .object({
    id: z.string().regex(/^S_[A-Z0-9_]+$/, "ID источника: S_ВЕРХНИЙ_РЕГИСТР"),
    level: z.union(SOURCE_LEVELS.map((l) => z.literal(l))),
    title: z.string().min(1),
    issuer: z.string().min(1),
    url: z.string().regex(/^https?:\/\//, "URL должен начинаться с http(s)://").nullable(),
    used_for: z.string().min(1),
    accessed: isoDate.nullable(),
    verified: z.boolean().nullable(),
    note: z.string().optional(),
  })
  .strict();

// ---------- parameters.yaml ----------

export const PARAMETER_KINDS = ["scalar", "series", "table", "enum", "date", "bool", "text"] as const;
export const PARAMETER_SCOPES = ["template", "region", "project"] as const;
export const PARAMETER_STATUSES = ["verified", "needs_verification", "project_input", "expert_allowed"] as const;

const legacyCellSchema = z
  .object({
    cell: z.string().nullable(),
    value: z.unknown().optional(),
    verdict: z.string().min(1),
    note: z.string().optional(),
  })
  .strict();

const tableColumnSchema = z
  .object({
    key: z.string().min(1),
    unit: z.string().min(1),
    options: z.array(z.string()).optional(),
    note: z.string().optional(),
  })
  .strict();

export const parameterSchema = z
  .object({
    id: z.string().regex(/^[A-Z]+\.[A-Z0-9_]+$/, "ID параметра: МОДУЛЬ.ИМЯ"),
    name: z.string().min(1),
    unit: z.string().min(1),
    kind: z.enum(PARAMETER_KINDS),
    scope: z.enum(PARAMETER_SCOPES),
    default: z.unknown(),
    options: z.array(z.string()).optional(),
    columns: z.array(tableColumnSchema).optional(),
    range: z.tuple([z.number(), z.number()]).optional(),
    source_ids: idList.min(1, "нужен хотя бы один источник"),
    basis: z.string().min(1, "нужно обоснование (basis)"),
    how_to_fill: z.string().optional(),
    status: z.enum(PARAMETER_STATUSES),
    legacy: z.array(legacyCellSchema).min(1, "нужна связь с исходником или 'new'"),
  })
  .strict();

// ---------- capex_items.yaml ----------

export const CAPEX_SCHEDULE_RULES = [
  "uniform",
  "s_curve",
  "at_milestone",
  "follow_smr",
  "follow_sales",
  "manual",
  "formula",
] as const;

export const MILESTONE_KEYS = [
  "land_acquired",
  "design_start",
  "expertise_done",
  "rns_date",
  "construction_start",
  "construction_end",
  "rnv_date",
  "handover_end",
  "sales_start",
] as const;

export const capexItemSchema = z
  .object({
    item_id: z.string().regex(/^[A-Z0-9_]+$/, "ID статьи: ВЕРХНИЙ_РЕГИСТР"),
    name: z.string().min(1),
    group: z.string().min(1),
    base: z.string().min(1),
    rate_param: z.string().optional(),
    formula: z.string().optional(),
    schedule_rule: z.enum(CAPEX_SCHEDULE_RULES),
    schedule_from: z.enum(MILESTONE_KEYS).nullable().optional(),
    schedule_to: z.enum(MILESTONE_KEYS).nullable().optional(),
    source_ids: idList.min(1, "нужен хотя бы один источник"),
    basis: z.string().min(1),
    legacy: z
      .object({
        budget_row: z.number().int().nullable(),
        cf_rows: z.array(z.number().int()).nullable(),
        amount: z.union([z.number(), z.string()]).nullable(),
        issue: z.string().optional(),
      })
      .strict(),
  })
  .strict();

// ---------- regions.yaml ----------

export const REGION_STATUSES = ["structure_only", "reference_partially_filled", "reference_filled"] as const;

export const regionSchema = z
  .object({
    code: z.string().regex(/^\d{2}$/, "код субъекта — две цифры"),
    name: z.string().min(1),
    fns_rates_url: z.string().regex(/^https?:\/\//),
    ncs_k_per: z.number().positive().nullable(),
    ncs_k_per_source_ids: idList,
    tariff_authority: z.string().nullable(),
    land_tax_level: z.string().min(1),
    land_tax_source_ids: idList,
    land_rent_source_ids: idList,
    vri_fee: z
      .object({
        exists: z.boolean().nullable(),
        source_ids: idList,
        formula: z.string().nullable(),
        note: z.string().optional(),
      })
      .strict(),
    parking_norm: z
      .object({
        source_ids: idList,
        rule: z.enum(["to_fill", "by_apartment_area"]),
        values: z
          .array(z.object({ max_area: z.number().positive().nullable(), per_apt: z.number().nonnegative() }).strict())
          .nullable(),
        status: z.enum(["to_fill", "needs_verification", "verified"]),
      })
      .strict(),
    ngp_source_ids: idList,
    status: z.enum(REGION_STATUSES),
  })
  .strict();

// ---------- formulas.yaml ----------

export const FORMULA_MODULES = [
  "TIME",
  "TEP",
  "LAND",
  "CAPEX",
  "SALES",
  "ESCROW",
  "FIN",
  "TAX",
  "CF",
  "KPI",
  "CHECK",
] as const;
export const FORMULA_STATUSES = ["verified", "needs_verification"] as const;

export const formulaSchema = z
  .object({
    id: z.string().regex(/^F\.[A-Z]+\.[A-Z0-9_]+$/, "ID формулы: F.МОДУЛЬ.ИМЯ"),
    module: z.enum(FORMULA_MODULES),
    name: z.string().min(1),
    unit: z.string().min(1),
    dims: z.array(z.string()),
    expr: z.string().min(1),
    depends_on: idList,
    rationale: z.string().min(1, "нужно обоснование (rationale)"),
    rejected: z.array(z.string()),
    source_ids: idList.min(1, "нужен хотя бы один источник"),
    legacy: z
      .object({
        cells: z.string().nullable(),
        verdict: z.string().min(1),
        issue: z.string().optional(),
      })
      .strict(),
    status: z.enum(FORMULA_STATUSES),
    example: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

// ---------- файлы целиком ----------

export const sourcesFileSchema = z.object({ sources: z.array(sourceSchema) }).strict();
export const parametersFileSchema = z.object({ parameters: z.array(parameterSchema) }).strict();
export const capexFileSchema = z.object({ items: z.array(capexItemSchema) }).strict();
export const regionsFileSchema = z.object({ regions: z.array(regionSchema) }).strict();
export const formulasFileSchema = z.object({ formulas: z.array(formulaSchema) }).strict();

export type Source = z.infer<typeof sourceSchema>;
export type Parameter = z.infer<typeof parameterSchema>;
export type CapexItem = z.infer<typeof capexItemSchema>;
export type Region = z.infer<typeof regionSchema>;
export type Formula = z.infer<typeof formulaSchema>;

/** Весь справочник после проверки схемами. */
export interface SpecData {
  sources: Source[];
  parameters: Parameter[];
  capexItems: CapexItem[];
  regions: Region[];
  formulas: Formula[];
}
