import Decimal from "decimal.js";
import { spec, type ParameterId } from "@fm/spec";
import { computeProject } from "./model";
import type { DemoProject } from "./types";
import * as fmt from "./format";

const BLUE = "FF1F4FB4"; // ввод
const HEAD = "FFE8ECF1";

/**
 * «Выгрузить в Excel» до этапа 13: вводные проекта с источниками, расчёт ТЭП (значения + ID формулы)
 * и реестр источников с гиперссылками. Полная модель с живыми формулами — этап 13.
 */
export async function exportProject(project: DemoProject): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const m = computeProject(project);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Финмодель ЖК";
  wb.created = new Date();
  const head = (ws: import("exceljs").Worksheet) => {
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD } };
  };

  const cover = wb.addWorksheet("Обложка");
  cover.addRows([
    ["Проект", project.name],
    ["Дата выгрузки", new Date()],
    ["Версия справочника", spec.specVersion],
    ["Состав", "Вводные с источниками, расчёт ТЭП, источники. Бюджет, продажи, эскроу, CF и показатели — после этапов 3–6; полная модель с формулами Excel — этап 13."],
  ]);
  cover.getColumn(1).width = 22;
  cover.getColumn(2).width = 100;
  cover.getCell("B2").numFmt = "dd.mm.yyyy";

  const inputs = wb.addWorksheet("Вводные", { views: [{ state: "frozen", ySplit: 1 }] });
  inputs.columns = [
    { header: "ID", key: "id", width: 28 },
    { header: "Параметр", key: "name", width: 50 },
    { header: "Значение", key: "value", width: 20 },
    { header: "Ед.", key: "unit", width: 10 },
    { header: "Источник", key: "source", width: 40 },
    { header: "Уровень", key: "level", width: 9 },
    { header: "Ссылка", key: "url", width: 36 },
  ];
  head(inputs);
  for (const [id, value] of Object.entries(project.input.values)) {
    const p = spec.parameters.find((x) => x.id === id);
    if (!p || value === null || value === undefined) continue;
    const src = project.sources.find((s) => s.id === project.paramSources[id as ParameterId]);
    const row = inputs.addRow({
      id,
      name: p.name,
      value: typeof value === "object" ? JSON.stringify(value) : value,
      unit: fmt.unit(p.unit),
      source: src?.title ?? "не указан",
      level: src?.level ?? "",
      url: src?.url ?? "",
    });
    row.getCell("value").font = { color: { argb: BLUE } };
    if (src?.url) row.getCell("url").value = { text: src.url, hyperlink: src.url };
  }

  const tep = wb.addWorksheet("ТЭП", { views: [{ state: "frozen", ySplit: 1 }] });
  tep.columns = [
    { header: "Показатель", key: "name", width: 44 },
    { header: "Значение", key: "value", width: 18 },
    { header: "Ед.", key: "unit", width: 8 },
    { header: "ID формулы", key: "id", width: 26 },
    { header: "Формула словами", key: "expr", width: 90 },
  ];
  head(tep);
  for (const f of spec.formulas.filter((x) => x.module === "TEP")) {
    const node = m.result.formulas[f.id];
    const v = node?.value;
    tep.addRow({ name: f.name, value: v instanceof Decimal ? v.toNumber() : node ? fmt.value(v) : "—", unit: fmt.unit(f.unit), id: f.id, expr: f.expr.trim() });
  }

  const src = wb.addWorksheet("Источники", { views: [{ state: "frozen", ySplit: 1 }] });
  src.columns = [
    { header: "Источник", key: "title", width: 70 },
    { header: "Уровень", key: "level", width: 9 },
    { header: "Вид", key: "scope", width: 14 },
    { header: "Для чего", key: "used", width: 60 },
    { header: "Проверено", key: "accessed", width: 12 },
  ];
  head(src);
  for (const s of project.sources) {
    const row = src.addRow({ title: s.title, level: s.level, scope: "проект", used: `${s.author}${s.rationale ? ` · ${s.rationale}` : ""}`, accessed: fmt.date(s.date) });
    if (s.url) row.getCell("title").value = { text: s.title, hyperlink: s.url };
  }
  for (const s of spec.sources.filter((x) => x.scope === "global")) {
    const row = src.addRow({ title: s.title, level: s.level, scope: "общий", used: s.used_for, accessed: fmt.date(s.accessed) });
    if (s.url) {
      row.getCell("title").value = { text: s.title, hyperlink: s.url };
      row.getCell("title").font = { color: { argb: BLUE }, underline: true };
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${project.name.replace(/[\\/:*?"<>|]/g, "_")}_финмодель_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
