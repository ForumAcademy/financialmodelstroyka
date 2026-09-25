/**
 * Перекрёстные проверки справочника (связи между реестрами), которые не выражаются схемой одного файла.
 * Повторяют правила scripts/validate_spec.py, чтобы TypeScript-сборка не зависела от Python.
 *
 * Файл импортирует только типы: его подключает генератор scripts/build-spec.ts.
 */
import type { SpecData } from "./schemas.ts";

export interface SpecCheckResult {
  errors: string[];
  warnings: string[];
}

/** Число субъектов РФ в справочнике регионов (docs/01, scripts/validate_spec.py). */
const REGIONS_EXPECTED = 89;

/** Базы статей бюджета, которые не являются ID параметра/формулы (шапка capex_items.yaml). */
const CAPEX_SPECIAL_BASES = new Set(["фикс", "фикс_в_месяц", "формула"]);

function duplicates(ids: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) dup.add(id);
    seen.add(id);
  }
  return [...dup];
}

export function checkSpec(spec: SpecData): SpecCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const S = new Set(spec.sources.map((s) => s.id));
  const P = new Set(spec.parameters.map((p) => p.id));
  const F = new Set(spec.formulas.map((f) => f.id));

  for (const [what, ids] of [
    ["источник", spec.sources.map((s) => s.id)],
    ["параметр", spec.parameters.map((p) => p.id)],
    ["формула", spec.formulas.map((f) => f.id)],
    ["статья бюджета", spec.capexItems.map((c) => c.item_id)],
    ["регион", spec.regions.map((r) => r.code)],
  ] as const) {
    for (const id of duplicates([...ids])) errors.push(`${what}: дубль ID ${id}`);
  }

  for (const s of spec.sources) {
    if (s.level <= 3 && !s.url) errors.push(`источник ${s.id} уровня ${s.level} без URL`);
  }

  const checkSources = (owner: string, ids: string[]) => {
    for (const id of ids) if (!S.has(id)) errors.push(`${owner}: источник ${id} отсутствует в sources.yaml`);
  };
  for (const p of spec.parameters) checkSources(`параметр ${p.id}`, p.source_ids);
  for (const f of spec.formulas) checkSources(`формула ${f.id}`, f.source_ids);
  for (const c of spec.capexItems) checkSources(`статья ${c.item_id}`, c.source_ids);
  for (const r of spec.regions) {
    const owner = `регион ${r.code}`;
    checkSources(owner, r.ncs_k_per_source_ids);
    checkSources(owner, r.land_tax_source_ids);
    checkSources(owner, r.land_rent_source_ids);
    checkSources(owner, r.vri_fee.source_ids);
    checkSources(owner, r.parking_norm.source_ids);
    checkSources(owner, r.ngp_source_ids);
    if (r.vri_fee.formula && !F.has(r.vri_fee.formula)) {
      warnings.push(`регион ${r.code}: vri_fee.formula ${r.vri_fee.formula} нет в formulas.yaml`);
    }
  }

  for (const c of spec.capexItems) {
    if (c.rate_param && !P.has(c.rate_param)) errors.push(`статья ${c.item_id}: rate_param ${c.rate_param} не найден`);
    if (!CAPEX_SPECIAL_BASES.has(c.base) && !P.has(c.base) && !F.has(c.base)) {
      errors.push(`статья ${c.item_id}: база ${c.base} не является ID параметра/формулы`);
    }
    if (c.base === "формула" && !c.formula) errors.push(`статья ${c.item_id}: база «формула» без поля formula`);
    if (c.formula && !F.has(c.formula)) errors.push(`статья ${c.item_id}: формула ${c.formula} не найдена`);
  }

  for (const f of spec.formulas) {
    for (const dep of f.depends_on) {
      if (!P.has(dep) && !F.has(dep)) errors.push(`формула ${f.id}: зависимость ${dep} не найдена`);
    }
    for (const dep of f.lag_depends_on ?? []) {
      if (!f.depends_on.includes(dep)) errors.push(`формула ${f.id}: lag_depends_on ${dep} нет в depends_on`);
    }
  }
  const cycle = findCycle(spec);
  if (cycle) errors.push(`цикл без лага в графе формул: ${cycle.join(" → ")}`);

  if (spec.regions.length !== REGIONS_EXPECTED) {
    errors.push(`regions.yaml: ${spec.regions.length} субъектов вместо ${REGIONS_EXPECTED}`);
  }

  for (const p of spec.parameters) if (p.status === "needs_verification") warnings.push(`параметр ${p.id}: needs_verification`);
  for (const f of spec.formulas) if (f.status === "needs_verification") warnings.push(`формула ${f.id}: needs_verification`);

  return { errors, warnings };
}

/** Поиск цикла без лага в графе depends_on формул (DFS с раскраской). Возвращает путь цикла или null. */
function findCycle(spec: SpecData): string[] | null {
  // Зависимости за прошлый месяц (lag_depends_on) разрывают цикл и в проверке не участвуют.
  const deps = new Map(
    spec.formulas.map((f) => [f.id, f.depends_on.filter((d) => d.startsWith("F.") && !f.lag_depends_on?.includes(d))]),
  );
  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];

  const visit = (id: string): string[] | null => {
    const s = state.get(id);
    if (s === "done") return null;
    if (s === "visiting") return [...stack.slice(stack.indexOf(id)), id];
    state.set(id, "visiting");
    stack.push(id);
    for (const d of deps.get(id) ?? []) {
      const found = visit(d);
      if (found) return found;
    }
    stack.pop();
    state.set(id, "done");
    return null;
  };

  for (const id of deps.keys()) {
    const found = visit(id);
    if (found) return found;
  }
  return null;
}
