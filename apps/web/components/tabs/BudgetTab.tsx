"use client";

import Decimal from "decimal.js";
import { getFormula, getParameter, isFormulaId, isParameterId, spec, type ParameterId } from "@fm/spec";
import { useHow } from "../HowPanel";
import { Inputs, val, type InputGroup } from "../Sheet";
import type { ProjectModel } from "@/lib/model";
import type { DemoProject } from "@/lib/types";
import * as fmt from "@/lib/format";

/** Группы бюджета в порядке листа «Бюджет» исходного Excel. */
export const BUDGET_GROUPS: [string, string][] = [
  ["правообладание", "Правообладание"],
  ["ПИР", "ПИР"],
  ["СМР", "СМР"],
  ["сети", "Сети"],
  ["благоустройство", "Благоустройство"],
  ["соцобъекты", "Соцобъекты"],
  ["управление", "Управление"],
  ["коммерческие", "Коммерческие"],
];

export function BudgetTab({ project, model }: { project: DemoProject; model: ProjectModel }) {
  const { open } = useHow();
  const groups: InputGroup[] = BUDGET_GROUPS.map(([key, title]) => {
    const params = [...new Set(spec.capexItems.filter((c) => c.group === key && c.rate_param).map((c) => c.rate_param as ParameterId))];
    if (key === "правообладание") params.push("TAX.LAND_RATE", "LAND.CADASTRAL_VALUE_AFTER_VRI");
    return { title, params };
  }).filter((g) => g.params.length > 0);
  groups.push({ title: "Индексация затрат", params: ["CAPEX.COST_INDEX"] });

  const volume = (base: string): string => {
    if (isParameterId(base)) {
      const v = project.input.values[base] ?? model.result.parameters[base]?.value;
      return v === undefined || v === null ? "—" : fmt.value(v);
    }
    if (isFormulaId(base)) {
      const v = val(model, base);
      // Благоустройство: база — площадь благоустройства из состава F.TEP.LANDSCAPE_AREA
      const picked = v && typeof v === "object" && "landscape" in v ? (v as { landscape: Decimal }).landscape : v;
      return picked === undefined ? "—" : fmt.value(picked);
    }
    return base === "фикс" || base === "фикс_в_месяц" ? "1" : "—";
  };
  const baseName = (base: string) => (isParameterId(base) ? getParameter(base).name : isFormulaId(base) ? getFormula(base).name : base === "формула" ? "по формуле" : base);
  const rate = (id?: ParameterId) => {
    if (!id) return "—";
    const v = project.input.values[id] ?? model.result.parameters[id]?.value ?? getParameter(id).default;
    return v === null || v === undefined ? "—" : `${fmt.value(v)} ${fmt.unit(getParameter(id).unit)}`;
  };
  const sumOf = (formula?: string): Decimal | null => {
    if (!formula || !isFormulaId(formula)) return null;
    const v = val<Decimal[] | Decimal>(model, formula);
    if (!v) return null;
    return Array.isArray(v) ? v.reduce((a, b) => a.add(b), new Decimal(0)) : v;
  };

  return (
    <>
      <Inputs project={project} model={model} groups={groups} />
      <section className="calc">
        <div className="calc-head">
          <h2>Расчёт</h2>
        </div>
        <p className="stage-note">Расчёт — этап 3: суммы по статьям появятся, когда ядро будет считать бюджет (ставка × база × индекс). Сейчас считается земельный налог.</p>
        <table className="sheet calc-table">
          <thead>
            <tr>
              <th>Статья</th>
              <th>Ставка</th>
              <th>База</th>
              <th className="num">Объём</th>
              <th className="num">Сумма, руб.</th>
              <th className="num">% от итога</th>
            </tr>
          </thead>
          <tbody>
            {BUDGET_GROUPS.map(([key, title]) => {
              const items = spec.capexItems.filter((c) => c.group === key);
              if (!items.length) return null;
              return [
                <tr key={key} className="block">
                  <td colSpan={6}>{title}</td>
                </tr>,
                ...items.map((c) => {
                  const s = sumOf(c.formula);
                  return (
                    <tr key={c.item_id} className="clickable" onClick={() => open({ kind: "capex", id: c.item_id })}>
                      <td>{c.name}</td>
                      <td>{rate(c.rate_param)}</td>
                      <td className="small">{baseName(c.base)}</td>
                      <td className="num">{volume(c.base)}</td>
                      <td className="num">{s ? fmt.num(s, 0) : "—"}</td>
                      <td className="num">—</td>
                    </tr>
                  );
                }),
                <tr key={`${key}-total`} className="total">
                  <td colSpan={4}>Итого {title.toLowerCase()}</td>
                  <td className="num">—</td>
                  <td className="num">—</td>
                </tr>,
              ];
            })}
            <tr className="total grand clickable" onClick={() => open({ kind: "formula", id: "F.CAPEX.TOTAL", label: "ИТОГО расходы" })}>
              <td colSpan={4}>ИТОГО расходы</td>
              <td className="num">—</td>
              <td className="num">—</td>
            </tr>
          </tbody>
        </table>
      </section>
    </>
  );
}
