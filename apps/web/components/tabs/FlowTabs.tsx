"use client";

import Decimal from "decimal.js";
import type { FormulaId, ParameterId } from "@fm/spec";
import { Calc, Inputs, pendingStages, toNum, val, type CalcRow } from "../Sheet";
import { formulaIds } from "./common";
import { BUDGET_GROUPS, groupCash } from "./BudgetTab";
import type { ProjectModel } from "@/lib/model";
import type { DemoProject } from "@/lib/types";

type Props = { project: DemoProject; model: ProjectModel };

/** Итого расходы по месяцам: сумма групп бюджета. */
const totalCash = (model: ProjectModel): number[] | null => {
  const groups = BUDGET_GROUPS.map(([key]) => groupCash(model, key));
  const first = groups[0];
  return first ? first.map((_, t) => groups.reduce((a, g) => a + (g?.[t] ?? 0), 0)) : null;
};

const phases = (project: DemoProject) => Math.max(Number(project.input.values["GEN.PHASES_COUNT"] ?? 1), ((project.input.values["TIME.MILESTONES"] as unknown[] | undefined) ?? []).length, 1);
const flagRow = (model: ProjectModel, id: FormulaId, p: number) => (val<number[][]>(model, id)?.[p] ?? null);

/** Строки продуктов проекта (SALES.PRODUCTS): ключ ряда в результатах ядра — название строки, иначе продукт. */
const productRows = (project: DemoProject) =>
  ((project.input.values["SALES.PRODUCTS"] as { name?: string | null; product?: string }[] | undefined) ?? []).map((r) => ({
    key: (r.name ?? "").trim() || (r.product ?? ""),
    pieces: r.product === "машино-места" || r.product === "кладовые",
  }));

type RowSeries = Record<string, Decimal[]>;

/** Сумма рядов по строкам продуктов (для итоговой строки таблицы). */
const sumRows = (series: RowSeries | undefined): number[] | null => {
  const all = series ? Object.values(series) : [];
  const first = all[0];
  return first ? first.map((_, t) => all.reduce((a, s) => a + (s[t]?.toNumber() ?? 0), 0)) : null;
};

export function SalesTab({ project, model }: Props) {
  const sold = val<RowSeries>(model, "F.SALES.SOLD_AREA");
  const price = val<RowSeries>(model, "F.SALES.PRICE");
  const value = val<RowSeries>(model, "F.SALES.CONTRACT_VALUE");
  const cash = val<{ total: RowSeries; ddu: RowSeries }>(model, "F.SALES.CASH_IN");
  const wavg = val<Record<string, Decimal | null>>(model, "F.SALES.WAVG_PRICE");
  const end = val<Record<string, Decimal | null>>(model, "F.SALES.END_PRICE");
  const revenue = val<{ gross: Decimal }>(model, "F.SALES.REVENUE_TOTAL");
  const products = productRows(project);
  const rows: CalcRow[] = [
    ...products.flatMap(({ key, pieces }): CalcRow[] => [
      { section: key },
      { label: "Продано", unit: pieces ? "шт" : "м2", formula: "F.SALES.SOLD_AREA", series: toNum(sold?.[key]) },
      { label: "Цена продаж (на конец периода)", unit: pieces ? "руб/шт" : "руб/м2", formula: "F.SALES.PRICE", series: toNum(price?.[key]), totalMode: "none", periodMode: "last" },
      { label: "Выручка (договоры)", unit: "руб", formula: "F.SALES.CONTRACT_VALUE", series: toNum(value?.[key]) },
      { label: "Поступления от покупателей", unit: "руб", formula: "F.SALES.CASH_IN", series: toNum(cash?.total[key]) },
      { label: "Средневзвешенная цена", unit: pieces ? "руб/шт" : "руб/м2", formula: "F.SALES.WAVG_PRICE", total: wavg?.[key] ?? undefined },
      { label: "Цена в конце продаж", unit: pieces ? "руб/шт" : "руб/м2", formula: "F.SALES.END_PRICE", total: end?.[key] ?? undefined },
    ]),
    { section: "Итого" },
    { label: "Выручка итого (с НДС)", unit: "руб", formula: "F.SALES.REVENUE_TOTAL", series: sumRows(value), total: revenue?.gross, bold: true },
    { label: "Поступления денег от покупателей", unit: "руб", formula: "F.SALES.CASH_IN", series: sumRows(cash?.total), bold: true },
    { label: "из них по ДДУ — на эскроу", unit: "руб", formula: "F.SALES.CASH_IN", series: sumRows(cash?.ddu) },
  ];
  return (
    <>
      <Inputs
        project={project}
        model={model}
        groups={[
          { title: "Продукты и стартовые цены", params: ["SALES.PRODUCTS"] },
          { title: "Темп продаж", params: ["SALES.PACE"] },
          ...(project.input.mode === "legacy"
            ? [
                { title: "Рост цен (как в исходном Excel)", params: ["SALES.LEGACY_PRICE_GROWTH"] as ParameterId[], note: "В режиме совместимости цена растёт ступенькой, как в исходнике. Рост по рынку и стадиям готовности действует в обычном режиме." },
                { title: "Поступления в денежный поток (как в исходном Excel)", params: ["SALES.LEGACY_CASH_IN_END"] as ParameterId[], note: "В исходнике строка доходов CF1 обрывается раньше продаж, поэтому часть выручки в денежный поток не попадает. В обычном режиме учитываются все поступления." },
              ]
            : [
                {
                  title: "Рост цен",
                  params: ["SALES.PRICE_MARKET_GROWTH", "SALES.PRICE_STAGE_UPLIFT"] as ParameterId[],
                  note: "Известное допущение: надбавка за стадию считается по готовности СМР всего проекта, а не своей очереди. Если дальние очереди начинают продавать рано, их цена получает надбавку за стройку ближних очередей, и выручка завышается.",
                },
              ]),
        ]}
      />
      <Calc model={model} rows={rows} periods stages={pendingStages(model, formulaIds(rows))} />
    </>
  );
}

export function EscrowTab({ project, model }: Props) {
  const deposit = val<Decimal[][]>(model, "F.ESC.DEPOSIT");
  const esc = val<{ balance: Decimal[][]; release: Decimal[][] }>(model, "F.ESC.BALANCE");
  const rows: CalcRow[] = Array.from({ length: phases(project) }, (_, p): CalcRow[] => [
    { section: `Очередь ${p + 1}` },
    { label: "Поступления на эскроу", unit: "руб", formula: "F.ESC.DEPOSIT", series: toNum(deposit?.[p]) },
    { label: "Раскрытие эскроу", unit: "руб", formula: "F.ESC.BALANCE", series: toNum(esc?.release[p]) },
    { label: "Остаток на эскроу (на конец периода)", unit: "руб", formula: "F.ESC.BALANCE", series: toNum(esc?.balance[p]), totalMode: "none", periodMode: "last" },
    { label: "Месяц раскрытия", unit: "0/1", formula: "F.TIME.FLAG_ESCROW_RELEASE", series: flagRow(model, "F.TIME.FLAG_ESCROW_RELEASE", p) },
  ]).flat();
  rows.push({ section: "Покрытие долга" }, { label: "Покрытие долга эскроу — появится с расчётом кредита (этап 5)", unit: "доля", formula: "F.ESC.COVERAGE", series: null, totalMode: "none" });
  return (
    <>
      <Inputs
        project={project}
        model={model}
        groups={[
          { title: "Структура оплат", params: ["SALES.PAYMENT_MIX"] },
          project.input.mode === "legacy"
            ? { title: "Эскроу (как в исходном Excel)", params: ["TIME.LEGACY_ESCROW_DEPOSIT_END", "TIME.LEGACY_ESCROW_RELEASE_DATE", "FIN.ESCROW_RESERVE_RATE"], note: "В исходнике сделки идут на эскроу до даты, после которой в CF1 вбиты нули, а раскрытие одной датой для всех очередей проставлено руками. В обычном режиме раскрытие — через лаг после РНВ каждой очереди." }
            : { title: "Раскрытие", params: ["TIME.ESCROW_RELEASE_LAG_M", "FIN.ESCROW_RESERVE_RATE"] },
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
    { label: "Поступления от продаж", unit: "руб", formula: "F.SALES.CASH_IN", series: sumRows(val<{ total: RowSeries }>(model, "F.SALES.CASH_IN")?.total), bold: true },
    { section: "Расходы" },
    ...BUDGET_GROUPS.map(([key, title]): CalcRow => ({ label: title, unit: "руб", formula: "F.CAPEX.ITEM_CASH", series: groupCash(model, key) })),
    { label: "Итого расходы", unit: "руб", formula: "F.CAPEX.TOTAL", series: totalCash(model), bold: true },
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
    { label: "Выручка (с НДС)", unit: "руб", formula: "F.SALES.REVENUE_TOTAL", total: val<{ gross: Decimal }>(model, "F.SALES.REVENUE_TOTAL")?.gross, bold: true },
    ...productRows(project).map(({ key, pieces }): CalcRow => ({ label: `Средневзвешенная цена · ${key}`, unit: pieces ? "руб/шт" : "руб/м2", formula: "F.SALES.WAVG_PRICE", total: val<Record<string, Decimal | null>>(model, "F.SALES.WAVG_PRICE")?.[key] ?? undefined })),
    { section: "Расходы и маржа" },
    { label: "Затраты", unit: "руб", formula: "F.CAPEX.TOTAL", total: val(model, "F.CAPEX.TOTAL"), bold: true },
    { label: "Эффект индексации затрат", unit: "руб", formula: "F.CAPEX.INDEX_EFFECT", total: val(model, "F.CAPEX.INDEX_EFFECT") },
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
