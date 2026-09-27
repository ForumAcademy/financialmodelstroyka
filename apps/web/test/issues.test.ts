import { describe, expect, it } from "vitest";
import { computeProject, projectQuestions } from "../lib/model";
import { issueCounts, issueItems } from "../lib/issues";
import { loadSeed } from "../lib/seed";
import { reducer } from "../lib/store";

describe("Расхождения с Excel: вопросы и статусы", () => {
  const [demo] = loadSeed().projects;
  if (!demo) throw new Error("нет демо-проекта");
  const questions = projectQuestions(demo, computeProject(demo));

  it("12 вопросов демо-проекта, все не решены", () => {
    expect(questions.map((q) => q.no)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(issueCounts(demo, questions)).toEqual({ open: 12, total: 12 });
  });

  it("статус с комментарием, автором и историей сохраняется по ключу; «Решено» уходит из нерешённых", () => {
    const at = "2026-09-27T10:00:00.000Z";
    let s = reducer([demo], { type: "issue", id: demo.id, key: "LEGACY.CONTINGENCY_F42", no: 4, question: "q", event: { status: "work", author: "Анна", at } });
    s = reducer(s, { type: "issue", id: demo.id, key: "LEGACY.CONTINGENCY_F42", no: 4, question: "q", event: { status: "done", author: "Анна", at, comment: "ставка 10% подтверждена" } });
    const p = s[0]!;
    expect(p.issues?.["LEGACY.CONTINGENCY_F42"]?.history.map((e) => e.status)).toEqual(["work", "done"]);
    expect(issueCounts(p, projectQuestions(p, computeProject(p)))).toEqual({ open: 11, total: 12 });
  });

  it("если расхождение пропало, пункт остаётся с пометкой «не воспроизводится», статус не меняется", () => {
    const s = reducer([demo], { type: "issue", id: demo.id, key: "SALES.OVER_STOCK:ПСН", no: 1, question: "Какой запас ПСН верный?", event: { status: "work", author: "Анна", at: "2026-09-27T10:00:00.000Z" } });
    const p = s[0]!;
    const items = issueItems(p, questions.filter((q) => q.key !== "SALES.OVER_STOCK:ПСН"));
    expect(items.find((i) => i.key === "SALES.OVER_STOCK:ПСН")).toMatchObject({ stale: true, status: "work", question: "Какой запас ПСН верный?" });
  });

  it("ручное дополнение к пояснению сохраняется по ключу с автором и не меняет статус", () => {
    const at = "2026-09-27T11:00:00.000Z";
    let s = reducer([demo], { type: "issueNote", id: demo.id, key: "LEGACY.MARKETING_F51", no: 3, question: "q", note: { text: "сумма считалась от выручки 119,85 млрд ₽, которой нет в плане продаж", author: "Анна", at } });
    s = reducer(s, { type: "issue", id: demo.id, key: "LEGACY.MARKETING_F51", no: 3, question: "q", event: { status: "work", author: "Анна", at } });
    const st = s[0]!.issues?.["LEGACY.MARKETING_F51"];
    expect(st?.notes).toEqual([{ text: "сумма считалась от выручки 119,85 млрд ₽, которой нет в плане продаж", author: "Анна", at }]);
    expect(st?.status).toBe("work");
    expect(issueItems(s[0]!, questions).find((i) => i.key === "LEGACY.MARKETING_F51")?.stale).toBe(false);
  });
});
