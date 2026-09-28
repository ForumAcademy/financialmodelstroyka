"use client";

import Decimal from "decimal.js";
import { Calc, Inputs, val, type CalcRow } from "../Sheet";
import { tepGroups } from "@/lib/tab-inputs";
import type { ProjectModel } from "@/lib/model";
import type { DemoProject } from "@/lib/types";

export function TepTab({ project, model }: { project: DemoProject; model: ProjectModel }) {
  const groups = tepGroups(project);

  const mix = (project.input.values["TEP.APT_MIX"] as { type_name?: string }[] | undefined) ?? [];
  const typeArea = val<Decimal[]>(model, "F.TEP.APT_TYPE_AREA");
  const counts = val<Decimal[]>(model, "F.TEP.APT_COUNT");
  const shares = val<Decimal[]>(model, "F.TEP.APT_SHARE");
  const split = val<Record<string, Decimal>>(model, "F.TEP.GFA_SPLIT");
  const storage = val<{ count: Decimal; area: Decimal }>(model, "F.TEP.STORAGE");
  const land = val<Record<string, Decimal>>(model, "F.TEP.LANDSCAPE_AREA");
  const check = val<{ diff_m2: Decimal; check: Decimal }>(model, "F.TEP.APT_AREA_CHECK");
  const sum = (xs?: Decimal[]) => xs?.reduce((a, b) => a.add(b), new Decimal(0));
  const name = (k: number) => mix[k]?.type_name ?? `Тип ${k + 1}`;

  const rows: CalcRow[] = [
    { section: "Площади" },
    { label: "ГНС наземной части", unit: "м2", formula: "F.TEP.GFA_ABOVE", total: val(model, "F.TEP.GFA_ABOVE") },
    { label: "ГНС жилой части", unit: "м2", formula: "F.TEP.GFA_SPLIT", total: split?.res },
    { label: "ГНС апартаментной части", unit: "м2", formula: "F.TEP.GFA_SPLIT", total: split?.apart },
    { label: "ГНС нежилой части", unit: "м2", formula: "F.TEP.GFA_SPLIT", total: split?.nonres },
    { label: "Площадь подземной части", unit: "м2", formula: "F.TEP.GFA_BELOW", total: val(model, "F.TEP.GFA_BELOW") },
    { label: "ГНС общая", unit: "м2", formula: "F.TEP.GFA_TOTAL", total: val(model, "F.TEP.GFA_TOTAL"), bold: true },
    { section: "Продаваемая площадь" },
    ...mix.map((_, k): CalcRow => ({ label: `Квартиры: ${name(k)}`, unit: "м2", formula: "F.TEP.APT_TYPE_AREA", total: typeArea?.[k] })),
    { label: "Квартиры итого", unit: "м2", formula: "F.TEP.APT_TYPE_AREA", total: sum(typeArea), bold: true },
    { label: "Апартаменты", unit: "м2", formula: "F.TEP.APART_AREA", total: val(model, "F.TEP.APART_AREA") },
    { label: "ПСН", unit: "м2", formula: "F.TEP.COMM_AREA", total: val(model, "F.TEP.COMM_AREA") },
    { label: "Кладовые", unit: "м2", formula: "F.TEP.STORAGE", total: storage?.area },
    { label: "Продаваемая площадь", unit: "м2", formula: "F.TEP.SALEABLE_AREA", total: val(model, "F.TEP.SALEABLE_AREA"), bold: true },
    { section: "Квартирография" },
    ...mix.map((_, k): CalcRow => ({ label: `${name(k)}: количество`, unit: "шт", formula: "F.TEP.APT_COUNT", total: counts?.[k] })),
    ...mix.map((_, k): CalcRow => ({ label: `${name(k)}: доля по количеству`, unit: "доля", formula: "F.TEP.APT_SHARE", total: shares?.[k] })),
    { label: "Квартир всего", unit: "шт", formula: "F.TEP.APT_COUNT", total: sum(counts), bold: true },
    { label: "Кладовых", unit: "шт", formula: "F.TEP.STORAGE", total: storage?.count },
    { label: "Расхождение квартирографии и ТЭП", unit: "м2", formula: "F.TEP.APT_AREA_CHECK", total: check?.diff_m2 },
    { section: "Машино-места" },
    { label: "По нормативу", unit: "шт", formula: "F.TEP.PARKING_REQUIRED", total: val(model, "F.TEP.PARKING_REQUIRED") },
    { label: "В модели", unit: "шт", formula: "F.TEP.PARKING_COUNT", total: val(model, "F.TEP.PARKING_COUNT"), bold: true },
    { section: "Благоустройство" },
    { label: "Площадь благоустройства", unit: "м2", formula: "F.TEP.LANDSCAPE_AREA", total: land?.landscape, bold: true },
    { label: "Внутриквартальные проезды", unit: "м2", formula: "F.TEP.LANDSCAPE_AREA", total: land?.roads },
    { label: "Озеленение", unit: "м2", formula: "F.TEP.LANDSCAPE_AREA", total: land?.green },
    { label: "Наземная парковка", unit: "м2", formula: "F.TEP.LANDSCAPE_AREA", total: land?.ground_parking },
  ];

  return (
    <>
      <Inputs project={project} model={model} groups={groups} />
      <Calc model={model} rows={rows} />
    </>
  );
}
