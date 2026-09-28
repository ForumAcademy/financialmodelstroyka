import { describe, expect, it } from "vitest";
import { spec } from "@fm/spec";
import { latest, SPEC_ASSUMPTIONS } from "../lib/assumptions";
import { computeProject, projectQuestions } from "../lib/model";
import { groupOf, issueItems, issueSummary, issuesBannerText, issuesTabLabel } from "../lib/issues";
import { loadSeed } from "../lib/seed";
import { reducer } from "../lib/store";
import { tabMissing } from "../lib/tab-inputs";
import type { DemoProject } from "../lib/types";

const count = (text: string | null) => Number(/(\d+)/.exec(text ?? "")?.[1] ?? 0);

describe("Расхождения с Excel: вопросы и статусы", () => {
  const [demo] = loadSeed().projects;
  if (!demo) throw new Error("нет демо-проекта");
  const questions = projectQuestions(demo, computeProject(demo));

  it("19 вопросов по исходному Excel и 10 по стандартным значениям компании, все не решены", () => {
    expect(questions.filter((q) => !q.parameterId).map((q) => q.no)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    // номера стандартных значений — после 19 (13–19 — кредит в CF1), по месту в справочнике; маркетинг, брокеридж и вознаграждение за
    // управление в демо-проекте заданы суммами Excel — ставки из справочника в расчёте не участвуют, вопросов нет;
    // резерв в «Расчёте сервиса» считается ставкой 2% от СМР — вопрос 25; у скидки к ставке (31) стандарта нет —
    // только по договору банка
    expect(questions.filter((q) => q.parameterId).map((q) => q.no)).toEqual([22, 25, 27, 28, 29, 30, 32, 33, 34, 36]);
    // демо открывается «как в исходном Excel»: считаются только 19 пунктов файла, из них 2 — вопросы автору, в нерешённые не входят
    expect(issueSummary(demo, questions)).toEqual({ shown: true, open: 17, total: 17, questions: 2 });
    // «Расчёт сервиса»: плюс 10 стандартных значений
    const normal: DemoProject = { ...demo, input: { ...demo.input, mode: "normal" } };
    expect(issueSummary(normal, questions)).toEqual({ shown: true, open: 27, total: 27, questions: 2 });
  });

  it("статус с комментарием, автором и историей сохраняется по ключу; «Решено» уходит из нерешённых", () => {
    const at = "2026-09-27T10:00:00.000Z";
    let s = reducer([demo], { type: "issue", id: demo.id, key: "LEGACY.CONTINGENCY_F42", no: 4, question: "q", event: { status: "work", author: "Анна", at } });
    s = reducer(s, { type: "issue", id: demo.id, key: "LEGACY.CONTINGENCY_F42", no: 4, question: "q", event: { status: "done", author: "Анна", at, comment: "ставка 10% подтверждена" } });
    const p = s[0]!;
    expect(p.issues?.["LEGACY.CONTINGENCY_F42"]?.history.map((e) => e.status)).toEqual(["work", "done"]);
    expect(issueSummary(p, projectQuestions(p, computeProject(p)))).toMatchObject({ open: 16, total: 17 });
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

describe("Расхождения: один подсчёт для вкладки и плашки", () => {
  const [demo] = loadSeed().projects;
  if (!demo) throw new Error("нет демо-проекта");

  it("группы: 16 искажают результат, 11 — методика, 2 — вопросы автору файла", () => {
    const items = issueItems(demo, projectQuestions(demo, computeProject(demo)));
    const by = (g: string) => items.filter((i) => groupOf(i) === g).map((i) => i.no);
    expect(by("author")).toEqual([2, 11]);
    expect(by("distorts")).toHaveLength(16);
    expect(by("method")).toHaveLength(11);
  });

  for (const mode of ["legacy", "normal"] as const) {
    it(`Дербеневская, ${mode === "legacy" ? "«Как в исходном Excel»" : "«Расчёт сервиса»"}: число на вкладке равно числу в плашке`, () => {
      const p: DemoProject = { ...demo, input: { ...demo.input, mode } };
      const s = issueSummary(p, projectQuestions(p, computeProject(p)));
      const tab = issuesTabLabel(s);
      const banner = issuesBannerText(p, s);
      expect(s.open).toBeGreaterThan(0);
      expect(count(tab)).toBe(s.open);
      expect(count(banner)).toBe(count(tab));
      expect(tab).not.toMatch(/ из /);
      expect(banner).not.toMatch(/ из /);
      // «как в исходном Excel» — только ошибки файла: 19 − 2 вопроса автору
      if (mode === "legacy") expect(s.open).toBe(17);
    });
  }

  it("всё решено — «Расхождения ✓», плашки нет", () => {
    const s = { shown: true, open: 0, total: 3, questions: 1 };
    expect(issuesTabLabel(s)).toBe("Расхождения ✓");
    expect(issuesBannerText(demo, s)).toBeNull();
  });
});

describe("Новый проект без исходного Excel", () => {
  const p: DemoProject = {
    id: "new",
    name: "Новый проект",
    archived: false,
    sources: [],
    paramSources: {},
    specVersion: spec.specVersion,
    assumptionsVersion: latest(SPEC_ASSUMPTIONS).version,
    updatedAt: "2026-09-28T00:00:00.000Z",
    input: { values: { "GEN.PROJECT_NAME": "Новый проект" } },
  };
  const m = computeProject(p);

  it("вкладки «Расхождения» и плашки нет", () => {
    const s = issueSummary(p, projectQuestions(p, m));
    expect(s.shown).toBe(false);
    expect(issuesBannerText(p, s)).toBeNull();
  });

  it("ни одна проверка не в статусе «ошибка»; незаполненные поля считаются на своих вкладках", () => {
    expect(m.result.messages.filter((x) => x.severity === "error" && x.formulaId?.startsWith("F.CHECK."))).toEqual([]);
    expect(m.missing.size).toBeGreaterThan(0);
    expect(tabMissing("tep", p, m)).toBeGreaterThan(0);
  });
});
