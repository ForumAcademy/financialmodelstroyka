"use client";

import Decimal from "decimal.js";
import { getFormula, getParameter, isFormulaId, isParameterId, spec, type ParameterId } from "@fm/spec";
import { Hint } from "../Hint";
import { useHow } from "../HowPanel";
import { Inputs, val } from "../Sheet";
import { BUDGET_GROUPS, budgetGroups } from "@/lib/tab-inputs";
import { modePair, type ProjectModel } from "@/lib/model";
import type { DemoProject } from "@/lib/types";
import * as fmt from "@/lib/format";

export { BUDGET_GROUPS };

type Series = Partial<Record<string, Decimal[]>>;

/** Платежи статей группы бюджета по месяцам (Σ F.CAPEX.ITEM_CASH по статьям группы); null — ядро не посчитало. */
export function groupCash(model: ProjectModel, group: string): number[] | null {
  const cash = val<Series>(model, "F.CAPEX.ITEM_CASH");
  const dates = val<string[]>(model, "F.TIME.DATE");
  if (!cash || !dates) return null;
  const rows = spec.capexItems.filter((c) => c.group === group).map((c) => cash[c.item_id]).filter((x): x is Decimal[] => Boolean(x));
  return dates.map((_, t) => rows.reduce((a, r) => a.add(r[t] ?? 0), new Decimal(0)).toNumber());
}

/** Строка статьи в CAPEX.ITEMS проекта (поправки к справочнику). */
type ItemRow = { item_id: string; base?: string; rate?: number | null };

export function BudgetTab({ project, model }: { project: DemoProject; model: ProjectModel }) {
  const { open } = useHow();
  // строки статей, с которыми посчитан проект (в расчёте сервиса резерв проекта из Excel считается по ставке)
  const rows = new Map(((model.input.values["CAPEX.ITEMS"] as ItemRow[] | undefined) ?? []).filter((r) => typeof r === "object").map((r) => [r.item_id, r]));
  // База статьи-доли для сравнения суммы Excel со ставкой: из текущего расчёта, иначе из другого режима проекта
  const other = modePair(project, model);
  const baseAmount = (base: string): Decimal | null => {
    if (!isFormulaId(base)) return null;
    const pick = (m: ProjectModel | undefined) => {
      const v = m ? val(m, base) : undefined;
      if (v instanceof Decimal) return v;
      if (v && typeof v === "object" && "gross" in v) return (v as { gross: Decimal }).gross;
      return null;
    };
    return pick(model) ?? pick(other ? (project.input.mode === "legacy" ? other.normal : other.legacy) : undefined);
  };
  const BASE_WORD: Record<string, string> = { "F.SALES.REVENUE_TOTAL": "выручки", "F.CAPEX.SMR_TOTAL": "СМР" };
  /** Сумма Excel у статьи-доли → расчётная доля от базы (сумма ÷ база), чтобы сравнить со ставкой нового проекта. */
  const impliedShare = (c: (typeof spec.capexItems)[number], amount: Decimal | undefined): string | null => {
    if (!c.rate_param || rows.get(c.item_id)?.base !== "фикс" || !amount || !BASE_WORD[c.base]) return null;
    const b = baseAmount(c.base);
    return b && !b.isZero() ? `≈ ${fmt.share(amount.div(b).toNumber())} ${BASE_WORD[c.base]}` : null;
  };
  const intent = project.input.mode === "legacy" ? project.legacyCase?.legacy_checks?.budget : undefined;
  const totals = val<Partial<Record<string, Decimal>>>(model, "F.CAPEX.ITEM_TOTAL") ?? {};
  const cash = val<Series>(model, "F.CAPEX.ITEM_CASH") ?? {};
  const grand = val<Decimal>(model, "F.CAPEX.TOTAL");
  const cashSum = (id: string) => cash[id]?.reduce((a, b) => a.add(b), new Decimal(0));
  const pct = (x: Decimal | undefined) => (x && grand && !grand.isZero() ? fmt.share(x.div(grand).toNumber()) : "—");
  const money = (x: Decimal | undefined) => (x ? fmt.num(x, 0) : "—");
  const groups = budgetGroups();

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
  const rate = (itemId: string, id?: ParameterId) => {
    const own = rows.get(itemId)?.rate;
    if (own !== undefined && own !== null) return fmt.num(own, 6);
    if (!id) return "—";
    const v = project.input.values[id] ?? model.result.parameters[id]?.value ?? getParameter(id).default;
    return v === null || v === undefined ? "—" : `${fmt.value(v)} ${fmt.unit(getParameter(id).unit)}`;
  };

  return (
    <>
      <Inputs project={project} model={model} groups={groups} />
      <section className="calc">
        <div className="calc-head">
          <h2 className="part-title">
            Расчёт
            <Hint
              text={`Сумма — ставка × база в ценах даты расценки. «В CF» — платежи по графику статьи с индексом цен и НДС. У статей-долей, заданных суммой из Excel, под ставкой — сумма, делённая на базу.${
                project.input.mode === "legacy" ? " «Как в исходном Excel»: суммы статей, ручные графики и земельные платежи — из исходного Excel, без индексации цен." : ""
              }`}
            />
          </h2>
        </div>
        <div className="hscroll">
        <table className="sheet calc-table">
          <thead>
            <tr>
              <th>Статья</th>
              <th>Ставка</th>
              <th>База</th>
              <th className="num">Объём</th>
              <th className="num">Сумма, руб.</th>
              <th className="num">В CF, руб.</th>
              <th className="num">% от итога</th>
            </tr>
          </thead>
          <tbody>
            {BUDGET_GROUPS.map(([key, title]) => {
              const items = spec.capexItems.filter((c) => c.group === key);
              if (!items.length) return null;
              return [
                <tr key={key} className="block">
                  <td colSpan={7}>{title}</td>
                </tr>,
                ...items.map((c) => {
                  const base = rows.get(c.item_id)?.base ?? c.base;
                  const inCf = cashSum(c.item_id);
                  return (
                    <tr key={c.item_id} className="clickable" onClick={() => open({ kind: "capex", id: c.item_id })}>
                      <td>{c.name}</td>
                      <td>
                        {rate(c.item_id, c.rate_param)}
                        {impliedShare(c, totals[c.item_id]) ? <div className="small muted" title="Сумма статьи, делённая на базу: для сравнения со ставкой справочника допущений">{impliedShare(c, totals[c.item_id])}</div> : null}
                        {c.item_id === "CONTINGENCY" && intent ? (
                          <div className="small muted" title="Бюджет!F42 складывает площадь со ставкой; автор задумывал произведение">
                            по замыслу автора: {fmt.num(new Decimal(intent.contingency_D42).mul(intent.contingency_E42), 0)}
                            {impliedShare(c, new Decimal(intent.contingency_D42).mul(intent.contingency_E42)) ? ` (${impliedShare(c, new Decimal(intent.contingency_D42).mul(intent.contingency_E42))})` : ""}
                          </div>
                        ) : null}
                      </td>
                      <td className="small">{baseName(base)}</td>
                      <td className="num">{volume(base)}</td>
                      <td className="num">{money(totals[c.item_id])}</td>
                      <td className="num">{money(inCf)}</td>
                      <td className="num">{pct(inCf)}</td>
                    </tr>
                  );
                }),
                (() => {
                  const sum = (xs: (Decimal | undefined)[]) => (xs.some(Boolean) ? xs.reduce<Decimal>((a, b) => a.add(b ?? 0), new Decimal(0)) : undefined);
                  const t = sum(items.map((c) => totals[c.item_id]));
                  const f = sum(items.map((c) => cashSum(c.item_id)));
                  return (
                    <tr key={`${key}-total`} className="total">
                      <td colSpan={4}>Итого {title.toLowerCase()}</td>
                      <td className="num">{money(t)}</td>
                      <td className="num">{money(f)}</td>
                      <td className="num">{pct(f)}</td>
                    </tr>
                  );
                })(),
              ];
            })}
            <tr className="total grand clickable" onClick={() => open({ kind: "formula", id: "F.CAPEX.TOTAL", label: "ИТОГО расходы" })}>
              <td colSpan={4}>ИТОГО расходы</td>
              <td className="num">{money(Object.values(totals).reduce<Decimal>((a, b) => a.add(b ?? 0), new Decimal(0)))}</td>
              <td className="num">{money(grand)}</td>
              <td className="num">{grand ? "100%" : "—"}</td>
            </tr>
          </tbody>
        </table>
        </div>
      </section>
    </>
  );
}
