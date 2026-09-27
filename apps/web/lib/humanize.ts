/**
 * Тексты справочника (basis, how_to_fill) пишутся для методолога и ссылаются на ID: TAX.VAT_RATE, F.CAPEX.INDEX, S_EXPERT,
 * SMR_ABOVE. В карточках для пользователя ID заменяются названиями, служебные слова — пояснениями.
 */
import { spec } from "@fm/spec";

const NAMES = new Map<string, string>([
  ...spec.parameters.map((p) => [p.id, p.name] as [string, string]),
  ...spec.formulas.map((f) => [f.id, f.name] as [string, string]),
  ...spec.sources.map((s) => [s.id, s.title] as [string, string]),
  ...spec.capexItems.map((c) => [c.item_id, c.name] as [string, string]),
]);

/** Служебные слова, которые не являются ID. */
const TERMS: [RegExp, string][] = [
  [/index_type\s*=\s*investment/g, "для строительных статей"],
  [/index_type\s*=\s*cpi/g, "для текущих расходов"],
  [/index_type\s*=\s*none/g, "статьи без индексации"],
  [/regions\.yaml(\s*→\s*[a-z_]+)?/g, "справочник регионов"],
  [/capex_items\.yaml/g, "справочник статей бюджета"],
];

const ID = /\b(?:F\.[A-Z]+\.[A-Z0-9_]+|[A-Z]+\.[A-Z0-9_]+|S_[A-Z0-9_]+|[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\b/g;

export function humanize(text: string): string {
  let out = text;
  for (const [re, to] of TERMS) out = out.replace(re, to);
  out = out.replace(/\b[a-z]+(?:_[a-z]+)+\b/g, (w) => {
    if (w === "needs_verification") return "«требует проверки»";
    if (w in MILESTONES) return `«${MILESTONES[w]}»`;
    if (w in SCHEDULES) return `«${SCHEDULES[w]}»`;
    return w;
  });
  return out.replace(ID, (id) => {
    const name = NAMES.get(id);
    return name ? `«${name}»` : id;
  });
}

/** Годовой ряд справочника: {by_year: {2026: 0.065, …}, after_last: "last"}. */
export interface YearSeries {
  by_year: Record<string, number>;
  after_last?: string;
}

export function isYearSeries(v: unknown): v is YearSeries {
  return !!v && typeof v === "object" && "by_year" in v && typeof (v as YearSeries).by_year === "object";
}

const MILESTONES: Record<string, string> = {
  land_acquired: "приобретение участка",
  vri_change_date: "смена вида разрешённого использования",
  design_start: "начало проектирования",
  expertise_done: "заключение экспертизы",
  rns_date: "разрешение на строительство",
  construction_start: "начало строительства",
  construction_end: "окончание строительства",
  rnv_date: "ввод в эксплуатацию",
  handover_start: "начало передачи квартир",
  handover_end: "окончание передачи квартир",
};

export const milestoneName = (m: string): string => MILESTONES[m] ?? m;

const SCHEDULES: Record<string, string> = {
  s_curve: "по S-кривой: медленно в начале, быстрее в середине, медленно в конце",
  uniform: "равномерно по месяцам",
  follow_smr: "вслед за оплатой строительно-монтажных работ",
  follow_sales: "вслед за поступлениями от продаж",
  at_milestone: "разово в дату события",
  formula: "по собственной формуле статьи",
  manual: "по графику, введённому вручную",
};

export const scheduleName = (r: string): string => SCHEDULES[r] ?? r;

const INDEX: Record<string, string> = {
  investment: "дорожает вместе со строительством (индекс роста цен в строительстве)",
  cpi: "дорожает вместе с инфляцией (индекс потребительских цен)",
  none: "не индексируется — считается от суммы, которая уже учитывает рост цен, или задана в текущих ценах договора",
};

export const indexName = (t: string): string => INDEX[t] ?? t;

/** База статьи: ID показателя → название; служебные слова — пояснение. */
export function baseName(base: string): string {
  if (base === "фикс") return "фиксированная сумма";
  if (base === "фикс_в_месяц") return "фиксированная сумма в месяц";
  if (base === "формула") return "собственная формула статьи";
  const name = NAMES.get(base);
  return name ?? base;
}
