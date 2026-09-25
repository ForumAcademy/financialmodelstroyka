import { spec } from "@fm/spec";
import type { DemoProject } from "./types";
import { computeProject } from "./model";
import * as fmt from "./format";

const BLUE = "FF1F4FB4"; // ввод
const HEAD = "FFE8ECF1";

/** «Выгрузить шаблон в Excel»: исходные данные проекта с колонками для значения и источника + реестр источников. */
export async function downloadTemplate(project: DemoProject): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const model = computeProject(project);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Финмодель ЖК";
  wb.created = new Date();

  const ws = wb.addWorksheet("Исходные данные", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "Раздел", key: "section", width: 16 },
    { header: "ID", key: "id", width: 28 },
    { header: "Параметр", key: "name", width: 48 },
    { header: "Ед.", key: "unit", width: 10 },
    { header: "Значение", key: "value", width: 18 },
    { header: "Уровень источника (4/5)", key: "level", width: 12 },
    { header: "Источник: документ", key: "doc", width: 32 },
    { header: "Ссылка", key: "url", width: 28 },
    { header: "Автор", key: "author", width: 18 },
    { header: "Дата", key: "date", width: 12 },
    { header: "Для уровня 5: обоснование, min–max", key: "expert", width: 30 },
    { header: "Где взять значение", key: "how", width: 48 },
    { header: "Статус в сервисе", key: "status", width: 16 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD } };
  const rows = [...model.used, ...model.rows.filter((r) => !r.used)];
  for (const r of rows) {
    const scalar = typeof r.value !== "object" || r.value === null;
    const row = ws.addRow({
      section: r.section,
      id: r.param.id,
      name: r.param.name,
      unit: fmt.unit(r.param.unit),
      value: scalar ? (r.value ?? "") : "таблица — заполняется в сервисе",
      level: r.source?.level ?? "",
      doc: r.source?.title ?? "",
      url: r.source?.url ?? "",
      author: r.source?.author ?? "",
      date: r.source?.date ?? "",
      expert: r.source?.level === 5 ? `${r.source.rationale ?? ""}; ${r.source.min ?? ""}–${r.source.max ?? ""}` : "",
      how: r.param.how_to_fill ?? r.param.basis,
      status: r.used ? { empty: "Не заполнено", no_source: "Без источника", ok: "С источником", check: "Требует сверки" }[r.status] : "пока не в расчёте",
    });
    for (const key of ["value", "level", "doc", "url", "author", "date", "expert"]) row.getCell(key).font = { color: { argb: BLUE } };
    row.getCell("level").dataValidation = { type: "list", allowBlank: true, formulae: ['"4,5"'] };
  }
  ws.autoFilter = { from: "A1", to: "M1" };

  const src = wb.addWorksheet("Источники", { views: [{ state: "frozen", ySplit: 1 }] });
  src.columns = [
    { header: "ID", key: "id", width: 26 },
    { header: "Уровень", key: "level", width: 9 },
    { header: "Источник", key: "title", width: 70 },
    { header: "Для чего", key: "used", width: 60 },
    { header: "Проверено", key: "accessed", width: 12 },
    { header: "Сверено", key: "verified", width: 9 },
  ];
  src.getRow(1).font = { bold: true };
  src.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD } };
  for (const s of spec.sources.filter((x) => x.scope === "global")) {
    const row = src.addRow({ id: s.id, level: s.level, title: s.title, used: s.used_for, accessed: s.accessed ? fmt.date(s.accessed) : "", verified: s.verified ? "да" : s.verified === false ? "нет" : "" });
    if (s.url) row.getCell("title").value = { text: s.title, hyperlink: s.url };
    if (s.url) row.getCell("title").font = { color: { argb: BLUE }, underline: true };
  }

  const lv = wb.addWorksheet("Уровни источников");
  lv.addRows([
    ["Уровень", "Что это", "Требования"],
    [1, "Закон, НПА", "Ссылка на текст статьи/акта"],
    [2, "Официальная статистика", "Ссылка + дата выгрузки"],
    [3, "Рыночные данные", "Ссылка + выборка не менее 3 аналогов"],
    [4, "Документ компании / проекта", "Вложение или ссылка на документ"],
    [5, "Экспертная оценка", "Автор, дата, обоснование, диапазон min–max"],
  ]);
  lv.getRow(1).font = { bold: true };
  lv.columns.forEach((c, i) => (c.width = [10, 30, 48][i] ?? 12));

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${project.name.replace(/[\\/:*?"<>|]/g, "_")}_шаблон_исходных_данных_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
