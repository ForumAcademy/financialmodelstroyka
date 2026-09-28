"use client";

import { notAccounted } from "@/lib/assumptions";
import Decimal from "decimal.js";
import { getParameter } from "@fm/spec";
import { Calc, Inputs, pendingStages, val, type CalcRow } from "../Sheet";
import { formulaIds } from "./common";
import { dashboardGroups } from "@/lib/tab-inputs";
import type { ProjectModel } from "@/lib/model";
import type { DemoProject } from "@/lib/types";

type Props = { project: DemoProject; model: ProjectModel };

/** Строки продуктов проекта (SALES.PRODUCTS): ключ ряда в результатах ядра — название строки, иначе продукт. */
const productRows = (project: DemoProject) =>
  ((project.input.values["SALES.PRODUCTS"] as { name?: string | null; product?: string }[] | undefined) ?? []).map((r) => ({
    key: (r.name ?? "").trim() || (r.product ?? ""),
    pieces: r.product === "машино-места" || r.product === "кладовые",
  }));

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
      <Inputs project={project} model={model} groups={dashboardGroups()} />
      <Calc model={model} rows={rows} stages={stages} title="Показатели" />
      <section className="charts">
        {["CF по годам", "Долг", "Эскроу"].map((t) => (
          <div key={t} className="chart">
            <h3>{t}</h3>
            <div className="chart-empty">Ещё не рассчитывается</div>
          </div>
        ))}
      </section>
    </>
  );
}
