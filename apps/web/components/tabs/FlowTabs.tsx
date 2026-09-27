"use client";

import { notAccounted } from "@/lib/assumptions";
import Decimal from "decimal.js";
import { getParameter, type FormulaId, type ParameterId } from "@fm/spec";
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
                { title: "Рост цен (как в исходном Excel)", params: ["SALES.LEGACY_PRICE_GROWTH"] as ParameterId[], note: "В расчёте «как в исходном Excel» цена растёт ступенькой, как в исходнике. Рост по рынку и стадиям готовности действует в расчёте сервиса." },
                { title: "Поступления в денежный поток (как в исходном Excel)", params: ["SALES.LEGACY_CASH_IN_END"] as ParameterId[], note: "В исходнике строка доходов CF1 обрывается раньше продаж, поэтому часть выручки в денежный поток не попадает. В расчёте сервиса учитываются все поступления." },
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
  const coverage = val<(Decimal | null)[]>(model, "F.ESC.COVERAGE");
  rows.push(
    { section: "Покрытие долга" },
    { label: "Покрытие долга с процентами остатками эскроу (на конец периода)", unit: "коэф", formula: "F.ESC.COVERAGE", series: coverage ? coverage.map((x) => x?.toNumber() ?? 0) : null, totalMode: "none", periodMode: "last" },
  );
  return (
    <>
      <Inputs
        project={project}
        model={model}
        groups={[
          { title: "Структура оплат", params: ["SALES.PAYMENT_MIX"] },
          project.input.mode === "legacy"
            ? { title: "Эскроу (как в исходном Excel)", params: ["TIME.LEGACY_ESCROW_DEPOSIT_END", "TIME.LEGACY_ESCROW_RELEASE_DATE", "FIN.ESCROW_RESERVE_RATE"], note: "В исходнике сделки идут на эскроу до даты, после которой в CF1 вбиты нули, а раскрытие одной датой для всех очередей проставлено руками. В расчёте сервиса раскрытие — через лаг после РНВ каждой очереди." }
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
    ...creditRows(project, model),
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
          project.input.mode === "legacy"
            ? {
                title: "Проектное финансирование (как в исходном Excel)",
                params: ["FIN.EQUITY_SHARE", "FIN.RATE_PREFERENTIAL", "FIN.LEGACY_KEY_RATE", "FIN.RATE_BASE_SPREAD", "FIN.RATE_DISCOUNT_COEF", "FIN.RATE_MIN", "FIN.FEE_ARRANGEMENT", "FIN.LEGACY_LIMIT"],
                note: "Кредит считается по кварталам, как в листе CF1, вместе с его ошибками: выдачи гасятся в том же квартале, проценты при раскрытии эскроу попадают в поток как поступление. Все такие места — во вкладке «Расхождения». Правильный расчёт кредита — в расчёте сервиса.",
              }
            : {
                title: "Проектное финансирование",
                params: ["FIN.EQUITY_SHARE", "FIN.RATE_PREFERENTIAL", "FIN.RATE_BASE_SPREAD", "FIN.KEY_RATE_PATH", "FIN.RATE_DISCOUNT_COEF", "FIN.RATE_MIN", "FIN.FEE_ARRANGEMENT", "FIN.FEE_COMMITMENT"],
                note: "Налоги в потребность в финансировании войдут, когда появится их расчёт.",
              },
          { title: "Налоги", params: ["TAX.VAT_RATE", "TAX.VAT_REGIME", "TAX.INPUT_VAT_RECOVERABLE", "TAX.PROFIT_RATE", "TAX.LOSS_CARRYFORWARD_LIMIT"] },
          { title: "Дисконтирование", params: ["GEN.VALUATION_DATE", "VAL.RISK_FREE", "VAL.EQUITY_PREMIUM", "VAL.HURDLE_IRR"] },
        ]}
      />
      <Calc model={model} rows={rows} periods stages={pendingStages(model, formulaIds(rows))} />
    </>
  );
}

/** Строки кредита: потребность → взнос застройщика → выдача → ставка → проценты → погашение → остатки. */
function creditRows(project: DemoProject, model: ProjectModel): CalcRow[] {
  const need = val<{ need: Decimal[]; cash_bop: (Decimal | null)[] }>(model, "F.FIN.FUNDING_NEED");
  const equity = val<{ total: Decimal[]; gap: Decimal[] }>(model, "F.FIN.EQUITY_IN");
  const rep = val<{ interest_paid: Decimal[]; principal: Decimal[]; from_escrow: Decimal[]; from_dkp: Decimal[] }>(model, "F.FIN.REPAYMENT");
  const debt = val<{ debt: Decimal[]; accrued: Decimal[] }>(model, "F.FIN.DEBT");
  const legacy = project.input.mode === "legacy";
  const rows: CalcRow[] = [
    { section: "Кредит" },
    { label: legacy ? "Расходы квартала — база выдачи" : "Потребность в финансировании", unit: "руб", formula: "F.FIN.FUNDING_NEED", series: toNum(need?.need) },
    { label: "Собственные средства", unit: "руб", formula: "F.FIN.EQUITY_IN", series: toNum(equity?.total) },
    ...(legacy ? [] : [{ label: "из них сверх лимита кредита", unit: "руб", formula: "F.FIN.EQUITY_IN", series: toNum(equity?.gap) } as CalcRow]),
    { label: "Выдача кредита", unit: "руб", formula: "F.FIN.DRAW", series: toNum(val<Decimal[]>(model, "F.FIN.DRAW")) },
    { label: "Комиссии банка", unit: "руб", formula: "F.FIN.FEES", series: toNum(val<Decimal[]>(model, "F.FIN.FEES")) },
    { label: "Ставка (на конец периода)", unit: "%годовых", formula: "F.FIN.RATE", series: toNum(val<Decimal[]>(model, "F.FIN.RATE")), totalMode: "none", periodMode: "last" },
    { label: "Проценты начисленные", unit: "руб", formula: "F.FIN.INTEREST", series: toNum(val<Decimal[]>(model, "F.FIN.INTEREST")) },
    { label: "Погашение процентов", unit: "руб", formula: "F.FIN.REPAYMENT", series: toNum(rep?.interest_paid) },
    { label: "Погашение основного долга", unit: "руб", formula: "F.FIN.REPAYMENT", series: toNum(rep?.principal) },
    ...(legacy ? [] : [{ label: "из них из договоров купли-продажи", unit: "руб", formula: "F.FIN.REPAYMENT", series: toNum(rep?.from_dkp) } as CalcRow]),
    { label: "Остаток основного долга", unit: "руб", formula: "F.FIN.DEBT", series: toNum(debt?.debt), totalMode: "none", periodMode: "last", bold: true },
    { label: "Неоплаченные проценты", unit: "руб", formula: "F.FIN.DEBT", series: toNum(debt?.accrued), totalMode: "none", periodMode: "last" },
  ];
  if (!legacy) rows.push({ label: "Свободные деньги проекта на начало месяца", unit: "руб", formula: "F.FIN.FUNDING_NEED", series: need ? need.cash_bop.map((x) => x?.toNumber() ?? 0) : null, totalMode: "none", periodMode: "last" });
  return rows;
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
    { label: "Лимит кредита", unit: "руб", formula: "F.FIN.LIMIT", total: val(model, "F.FIN.LIMIT") },
    ...(project.input.mode === "legacy" ? [] : [{ label: "Собственное участие до первой выдачи", unit: "руб", formula: "F.FIN.EQUITY_REQUIRED", total: val(model, "F.FIN.EQUITY_REQUIRED") } as CalcRow]),
    { label: "Выдано кредита", unit: "руб", formula: "F.FIN.DRAW", total: sum(val<Decimal[]>(model, "F.FIN.DRAW")) },
    { label: "Начисленные проценты", unit: "руб", formula: "F.FIN.INTEREST", total: sum(val<Decimal[]>(model, "F.FIN.INTEREST")) },
    { label: "Полная стоимость кредита", unit: "%годовых", formula: "F.FIN.EFFECTIVE_RATE", total: val(model, "F.FIN.EFFECTIVE_RATE") ?? undefined },
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
  const missed = notAccounted(project, model.versions);
  return (
    <>
      {missed.length ? (
        <div className="not-accounted small">
          <b>Не учтено в расчёте:</b> {missed.map((id) => getParameter(id).name).join("; ")}. Значений нет ни в проекте, ни в справочнике допущений — это не ноль. Введите их на вкладках проекта или в справочнике.
        </div>
      ) : null}
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
