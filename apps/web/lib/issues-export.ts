import { GROUPS, TAB_TITLE, type IssueItem } from "./issues";
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
    { header: "Группа", key: "group", width: 22 },
    { header: "Вкладка", key: "tab", width: 12 },
    { header: "Что не так в файле", key: "title", width: 50 },
    { header: "Ячейки", key: "where", width: 26 },
    { header: "Что это меняет", key: "effect", width: 60 },
    { header: "Вопросы автору", key: "questions", width: 60 },
    { header: "Дополнения к пояснению", key: "notes", width: 50 },
    { header: "Влияние, руб. (Excel − исправленное)", key: "amount", width: 20 },
    { header: "В расчёте сервиса", key: "fix", width: 50 },
    { header: "Статус", key: "status", width: 14 },
    { header: "Последний комментарий", key: "comment", width: 40 },
    { header: "История статусов", key: "history", width: 60 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD } };
  for (const i of [...items].sort((a, b) => a.no - b.no)) {
    const history = i.state?.history ?? [];
    const last = [...history].reverse().find((e) => e.comment);
    const amounts = i.questions.map((q) => q.impact.amount).filter((x) => x !== null);
    const row = ws.addRow({
      no: i.label,
      group: GROUPS.find((g) => g.id === i.group)?.title ?? "",
      tab: TAB_TITLE[i.tab],
      title: i.title,
      where: i.where,
      effect: i.stale ? "Не воспроизводится: после обновления исходника пункт пропал" : i.effect,
      questions: [i.question, ...i.questions.map((q) => `${q.question} ${q.compared}`)].filter(Boolean).join("\n"),
      notes: (i.state?.notes ?? []).map((n) => `${new Date(n.at).toLocaleString("ru-RU")} · ${n.author} · ${n.text}`).join("\n"),
      amount: amounts.length ? Number(amounts.reduce((s, x) => s.add(x)).toFixed(2)) : null,
      fix: i.fix,
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
