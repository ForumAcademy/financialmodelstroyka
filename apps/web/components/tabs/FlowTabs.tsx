"use client";

import Decimal from "decimal.js";
import type { FormulaId } from "@fm/spec";
import { Calc, Inputs, pendingStages, toNum, val, type CalcRow } from "../Sheet";
import { formulaIds } from "./common";
import { BUDGET_GROUPS } from "./BudgetTab";
import type { ProjectModel } from "@/lib/model";
import type { DemoProject } from "@/lib/types";

type Props = { project: DemoProject; model: ProjectModel };

const phases = (project: DemoProject) => Math.max(Number(project.input.values["GEN.PHASES_COUNT"] ?? 1), ((project.input.values["TIME.MILESTONES"] as unknown[] | undefined) ?? []).length, 1);
const flagRow = (model: ProjectModel, id: FormulaId, p: number) => (val<number[][]>(model, id)?.[p] ?? null);

export function SalesTab({ project, model }: Props) {
  const mix = (project.input.values["TEP.APT_MIX"] as { type_name?: string }[] | undefined) ?? [];
  const products = [...mix.map((m, k) => m.type_name ?? `Квартиры тип ${k + 1}`), "Апартаменты", "ПСН", "Машино-места", "Кладовые"];
  const rows: CalcRow[] = [
    ...products.flatMap((name): CalcRow[] => [
      { section: name },
      { label: "Темп продаж", unit: name === "Машино-места" || name === "Кладовые" ? "шт" : "м2", formula: "F.SALES.SOLD_AREA", series: null },
      { label: "Цена продаж", unit: name === "Машино-места" || name === "Кладовые" ? "руб/шт" : "руб/м2", formula: "F.SALES.PRICE", series: null, totalMode: "none" },
      { label: "Выручка (договоры)", unit: "руб", formula: "F.SALES.CONTRACT_VALUE", series: null },
    ]),
    { section: "Итого" },
    { label: "Выручка итого", unit: "руб", formula: "F.SALES.REVENUE_TOTAL", bold: true },
    { label: "Поступления денег от покупателей", unit: "руб", formula: "F.SALES.CASH_IN", series: null },
    { label: "Средневзвешенная цена квартир", unit: "руб/м2", formula: "F.SALES.WAVG_PRICE" },
    { label: "Цена квартир в конце продаж", unit: "руб/м2", formula: "F.SALES.END_PRICE" },
  ];
  return (
    <>
      <Inputs
        project={project}
        model={model}
        groups={[
          { title: "Продукты и стартовые цены", params: ["SALES.PRODUCTS"] },
          { title: "Темп и рост цен", params: ["SALES.PACE", "SALES.PRICE_MARKET_GROWTH", "SALES.PRICE_STAGE_UPLIFT"] },
        ]}
      />
      <Calc model={model} rows={rows} periods stages={pendingStages(model, formulaIds(rows))} />
    </>
  );
}

export function EscrowTab({ project, model }: Props) {
  const rows: CalcRow[] = Array.from({ length: phases(project) }, (_, p): CalcRow[] => [
    { section: `Очередь ${p + 1}` },
    { label: "Поступления на эскроу", unit: "руб", formula: "F.ESC.DEPOSIT", series: null },
    { label: "Остаток на эскроу", unit: "руб", formula: "F.ESC.BALANCE", series: null, totalMode: "none" },
    { label: "Покрытие долга эскроу", unit: "доля", formula: "F.ESC.COVERAGE", series: null, totalMode: "none" },
    { label: "Раскрытие эскроу (месяц)", unit: "0/1", formula: "F.TIME.FLAG_ESCROW_RELEASE", series: flagRow(model, "F.TIME.FLAG_ESCROW_RELEASE", p) },
  ]).flat();
  return (
    <>
      <Inputs
        project={project}
        model={model}
        groups={[
          { title: "Структура оплат", params: ["SALES.PAYMENT_MIX"] },
          { title: "Раскрытие", params: ["TIME.ESCROW_RELEASE_LAG_M", "FIN.ESCROW_RESERVE_RATE"] },
        ]}
      />
      <Calc model={model} rows={rows} periods stages={pendingStages(model, formulaIds(rows))} />
    </>
  );
}

export function CashflowTab({ project, model }: Props) {
  const n = phases(project);
  const perPhase = (label: string, id: FormulaId): CalcRow[] => Array.from({ length: n }, (_, p) => ({ label: `${label} · очередь ${p + 1}`, unit: "мес", formula: id, series: flagRow(model, id, p) }));
  const days = val<number[]>(model, "F.TIME.DAYS");
  const rows: CalcRow[] = [
    { section: "Шкала" },
    { label: "Количество дней", unit: "дни", formula: "F.TIME.DAYS", series: days ?? null },
    ...perPhase("Строительство", "F.TIME.FLAG_CONSTRUCTION"),
    ...perPhase("Продажи по эскроу (ДДУ)", "F.TIME.FLAG_PRESALE"),
    ...perPhase("Продажи по ДКП", "F.TIME.FLAG_POST_RNV"),
    ...perPhase("Раскрытие эскроу", "F.TIME.FLAG_ESCROW_RELEASE"),
    { section: "Доходы" },
    { label: "Поступления от продаж", unit: "руб", formula: "F.SALES.CASH_IN", series: null, bold: true },
    { section: "Расходы" },
    { label: "Земельный налог / аренда", unit: "руб", formula: "F.LAND.TAX_OR_RENT", series: toNum(val<Decimal[]>(model, "F.LAND.TAX_OR_RENT")) },
    ...BUDGET_GROUPS.map(([, title]): CalcRow => ({ label: title, unit: "руб", formula: "F.CAPEX.ITEM_CASH", series: null })),
    { label: "Итого расходы", unit: "руб", formula: "F.CAPEX.TOTAL", series: null, bold: true },
    { section: "Налоги" },
    { label: "НДС к уплате", unit: "руб", formula: "F.TAX.VAT_PAYABLE", series: null },
    { label: "Налог на прибыль", unit: "руб", formula: "F.TAX.PROFIT_TAX", series: null },
    { label: "Итого налоги", unit: "руб", formula: "F.TAX.PAYMENTS", series: null, bold: true },
    { section: "Кредит" },
    { label: "Собственные средства", unit: "руб", formula: "F.FIN.EQUITY_IN", series: null },
    { label: "Выборка кредита", unit: "руб", formula: "F.FIN.DRAW", series: null },
    { label: "Ставка", unit: "доля", formula: "F.FIN.RATE", series: null, totalMode: "none" },
    { label: "Проценты", unit: "руб", formula: "F.FIN.INTEREST", series: null },
    { label: "Погашение", unit: "руб", formula: "F.FIN.REPAYMENT", series: null },
    { label: "Остаток долга", unit: "руб", formula: "F.FIN.DEBT", series: null, totalMode: "none", bold: true },
    { section: "Оценка" },
    { label: "CFADS", unit: "руб", formula: "F.CF.CFADS", series: null },
    { label: "FCFE", unit: "руб", formula: "F.CF.FCFE", series: null },
    { label: "Остаток денег", unit: "руб", formula: "F.CF.CASH_BALANCE", series: null, totalMode: "none", bold: true },
  ];
  return (
    <>
      <Inputs
        project={project}
        model={model}
        groups={[
          { title: "Проектное финансирование", params: ["FIN.EQUITY_SHARE", "FIN.RATE_PREFERENTIAL", "FIN.RATE_BASE_SPREAD", "FIN.KEY_RATE_PATH", "FIN.RATE_DISCOUNT_COEF", "FIN.RATE_MIN", "FIN.FEE_ARRANGEMENT", "FIN.FEE_COMMITMENT", "FIN.COLLATERAL_DISCOUNT"] },
          { title: "Налоги", params: ["TAX.VAT_RATE", "TAX.VAT_REGIME", "TAX.INPUT_VAT_RECOVERABLE", "TAX.PROFIT_RATE", "TAX.LOSS_CARRYFORWARD_LIMIT"] },
          { title: "Дисконтирование", params: ["GEN.VALUATION_DATE", "VAL.RISK_FREE", "VAL.EQUITY_PREMIUM", "VAL.HURDLE_IRR"] },
        ]}
      />
      <Calc model={model} rows={rows} periods stages={pendingStages(model, formulaIds(rows))} />
    </>
  );
}

export function DashboardTab({ project, model }: Props) {
  const sum = (xs?: Decimal[]) => xs?.reduce((a, b) => a.add(b), new Decimal(0));
  const rows: CalcRow[] = [
    { section: "ТЭП проекта" },
    { label: "ГНС общая", unit: "м2", formula: "F.TEP.GFA_TOTAL", total: val(model, "F.TEP.GFA_TOTAL") },
    { label: "ГНС наземной части", unit: "м2", formula: "F.TEP.GFA_ABOVE", total: val(model, "F.TEP.GFA_ABOVE") },
    { label: "Продаваемая площадь", unit: "м2", formula: "F.TEP.SALEABLE_AREA", total: val(model, "F.TEP.SALEABLE_AREA"), bold: true },
    { label: "Квартиры", unit: "м2", formula: "F.TEP.APT_TYPE_AREA", total: sum(val<Decimal[]>(model, "F.TEP.APT_TYPE_AREA")) },
    { label: "ПСН", unit: "м2", formula: "F.TEP.COMM_AREA", total: val(model, "F.TEP.COMM_AREA") },
    { label: "Кладовые", unit: "м2", formula: "F.TEP.STORAGE", total: val<{ area: Decimal }>(model, "F.TEP.STORAGE")?.area },
    { label: "Паркинг", unit: "шт", formula: "F.TEP.PARKING_COUNT", total: val(model, "F.TEP.PARKING_COUNT") },
    { section: "Выручка" },
    { label: "Выручка", unit: "руб", formula: "F.SALES.REVENUE_TOTAL", bold: true },
    { label: "Средневзвешенная цена квартир", unit: "руб/м2", formula: "F.SALES.WAVG_PRICE" },
    { label: "Цена квартир в конце продаж", unit: "руб/м2", formula: "F.SALES.END_PRICE" },
    { section: "Расходы и маржа" },
    { label: "Затраты", unit: "руб", formula: "F.CAPEX.TOTAL", bold: true },
    { label: "Себестоимость 1 м² и наценка", unit: "руб/м2", formula: "F.KPI.COST_PER_M2" },
    { label: "Маржа", unit: "доля", formula: "F.KPI.MARGIN", bold: true },
    { label: "Налоги", unit: "руб", formula: "F.TAX.PAYMENTS" },
    { section: "Кредит" },
    { label: "Лимит финансирования", unit: "руб", formula: "F.FIN.LIMIT" },
    { label: "Начисленные проценты", unit: "руб", formula: "F.FIN.INTEREST" },
    { label: "Эффективная ставка", unit: "доля", formula: "F.FIN.EFFECTIVE_RATE" },
    { label: "LTC / LTV", unit: "доля", formula: "F.KPI.LTC_LTV" },
    { section: "Итоги по проекту" },
    { label: "Ставка дисконтирования", unit: "доля", formula: "F.KPI.DISCOUNT_RATE" },
    { label: "NPV", unit: "руб", formula: "F.KPI.NPV", bold: true },
    { label: "IRR проекта", unit: "доля", formula: "F.KPI.IRR" },
    { label: "IRR акционера", unit: "доля", formula: "F.KPI.IRR", bold: true },
    { label: "Пиковый капитал", unit: "руб", formula: "F.KPI.PEAK_EQUITY" },
    { label: "LLCR", unit: "коэф", formula: "F.KPI.LLCR" },
  ];
  const stages = pendingStages(model, formulaIds(rows));
  return (
    <>
      <Inputs project={project} model={model} groups={[{ title: "Оценка", params: ["GEN.VALUATION_DATE"] }]} />
      <Calc model={model} rows={rows} stages={stages} title="Показатели" />
      <section className="charts">
        {["CF по годам", "Долг", "Эскроу"].map((t) => (
          <div key={t} className="chart">
            <h3>{t}</h3>
            <div className="chart-empty">График появится на этапе 6</div>
          </div>
        ))}
      </section>
    </>
  );
}
