import { BLOCKS, type IssueItem } from "./issues";
import { ISSUE_STATUS_LABEL, type DemoProject } from "./types";

const HEAD = "FFE8ECF1";

/** Выгрузка «Расхождения с Excel» для авторов файла: все столбцы, статус, комментарии и история. */
export async function exportIssues(project: DemoProject, items: IssueItem[]): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Финмодель ЖК";
  wb.created = new Date();
  const ws = wb.addWorksheet("Расхождения");
  ws.columns = [
    { header: "№", key: "no", width: 6 },
    { header: "Блок", key: "block", width: 16 },
    { header: "Вопрос", key: "question", width: 42 },
    { header: "Что смутило систему", key: "explanation", width: 70 },
    { header: "Влияние", key: "impact", width: 40 },
    { header: "Влияние, руб. (Excel − исправленное)", key: "amount", width: 20 },
    { header: "Рекомендация", key: "recommendation", width: 50 },
    { header: "Статус", key: "status", width: 14 },
    { header: "Последний комментарий", key: "comment", width: 40 },
    { header: "История статусов", key: "history", width: 60 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD } };
  for (const i of [...items].sort((a, b) => a.no - b.no)) {
    const history = i.state?.history ?? [];
    const last = [...history].reverse().find((e) => e.comment);
    const row = ws.addRow({
      no: i.no,
      block: BLOCKS.find((b) => b.id === i.q?.block)?.title ?? "",
      question: i.question,
      explanation: i.stale ? "Не воспроизводится: после обновления исходника расхождение пропало" : i.q?.explanation,
      impact: i.q?.impact.text ?? "",
      amount: i.q?.impact.amount ? Number(i.q.impact.amount.toFixed(2)) : null,
      recommendation: i.q?.recommendation ?? "",
      status: ISSUE_STATUS_LABEL[i.status],
      comment: last?.comment ?? "",
      history: history.map((e) => `${new Date(e.at).toLocaleString("ru-RU")} · ${e.author} · ${ISSUE_STATUS_LABEL[e.status]}${e.comment ? ` · ${e.comment}` : ""}`).join("\n"),
    });
    row.alignment = { vertical: "top", wrapText: true };
    row.getCell("amount").numFmt = "#,##0";
  }
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${project.name.replace(/[\\/:*?"<>|]/g, "_")}_расхождения_с_Excel_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
