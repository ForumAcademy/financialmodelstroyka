import { describe, expect, it } from "vitest";
import { spec } from "@fm/spec";
import { latest, SPEC_ASSUMPTIONS } from "../lib/assumptions";
import { computeProject, projectQuestions } from "../lib/model";
import { issueItems, issueSummary, issuesBannerText, issuesCount } from "../lib/issues";
import { loadSeed } from "../lib/seed";
import { standardInUse, unconfirmedStandard } from "../lib/standard";
import { reducer } from "../lib/store";
import { tabCount, tabMissing } from "../lib/tab-inputs";
import type { DemoProject } from "../lib/types";

const count = (text: string | null) => Number(/(\d+)/.exec(text ?? "")?.[1] ?? 0);
const [demo] = loadSeed().projects;
if (!demo) throw new Error("нет демо-проекта");
const modes = (p: DemoProject) => (["legacy", "normal"] as const).map((mode): DemoProject => ({ ...p, input: { ...p.input, mode } }));

describe("Расхождения: пункты аудита исходного Excel", () => {
  const questions = projectQuestions(demo, computeProject(demo));
  const items = issueItems(demo, questions);
  const by = (g: string) => items.filter((i) => i.group === g).map((i) => i.label);

  it("расчёт находит 19 вопросов к исходному Excel, все внутри пунктов аудита", () => {
    expect(questions.map((q) => q.no)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    const inside = items.flatMap((i) => i.questions.map((q) => q.key));
    expect(inside.sort()).toEqual(questions.map((q) => q.key).sort());
    expect(items.filter((i) => i.stale)).toEqual([]);
  });

  it("группы: 18 критических пунктов аудита + 5 по кредиту CF1, методика — раздел 2 и полная стоимость кредита, автору — раздел 3", () => {
    expect(by("distorts")).toEqual(Array.from({ length: 23 }, (_, k) => String(k + 1)));
    expect(by("method")).toEqual([...Array.from({ length: 10 }, (_, k) => `М${k + 1}`), "М11"]);
    expect(by("author")).toEqual(["В1", "В2", "В3", "В4"]);
    // ПСН (№15) и брокеридж (№6) — в «Искажают результат», вопросы автору — строками внутри
    const psn = items.find((i) => i.label === "15")!;
    expect(psn.questions.map((q) => q.key)).toEqual(["SALES.OVER_STOCK:ПСН", "LEGACY.PSN_STOCK"]);
    expect(items.find((i) => i.label === "6")!.questions.map((q) => q.key)).toContain("LEGACY.CF1_LAG");
    expect(items.find((i) => i.label === "М11")!.questions.map((q) => q.key)).toEqual(["LEGACY.FIN_EFF_RATE"]);
  });

  it("статус с комментарием, автором и историей хранится по ключу пункта; «Решено» уходит из нерешённых", () => {
    const at = "2026-09-27T10:00:00.000Z";
    let s = reducer([demo], { type: "issue", id: demo.id, key: "AUDIT.2", no: 2, question: "q", event: { status: "work", author: "Анна", at } });
    s = reducer(s, { type: "issue", id: demo.id, key: "AUDIT.2", no: 2, question: "q", event: { status: "done", author: "Анна", at, comment: "ставка подтверждена" } });
    const p = s[0]!;
    expect(p.issues?.["AUDIT.2"]?.history.map((e) => e.status)).toEqual(["work", "done"]);
    expect(issueSummary(p, projectQuestions(p, computeProject(p)))).toMatchObject({ open: 33, total: 34 });
  });

  it("пункт, которого больше нет в списке, остаётся с пометкой «не воспроизводится»; подтверждения стандарта сюда не попадают", () => {
    let s = reducer([demo], { type: "issue", id: demo.id, key: "SALES.OVER_STOCK:ПСН", no: 1, question: "Сколько ПСН построено?", event: { status: "work", author: "Анна", at: "2026-09-27T10:00:00.000Z" } });
    s = reducer(s, { type: "issue", id: demo.id, key: "STANDARD:TIME.ESCROW_RELEASE_LAG_M", no: 0, question: "q", event: { status: "done", author: "Анна", at: "2026-09-27T10:00:00.000Z" } });
    const list = issueItems(s[0]!, questions);
    expect(list.find((i) => i.key === "SALES.OVER_STOCK:ПСН")).toMatchObject({ stale: true, status: "work", title: "Сколько ПСН построено?" });
    expect(list.some((i) => i.key.startsWith("STANDARD:"))).toBe(false);
  });
});

describe("Расхождения: один подсчёт для вкладки и плашки", () => {
  it("всё исправлено — в «Расчёте сервиса» ✓, плашки нет", () => {
    const s = { shown: true, open: 0, total: 3, questions: 1, byGroup: { distorts: 0, method: 0, author: 1 }, inFile: 3, notFixed: 0 };
    const normal = { ...demo, input: { ...demo.input, mode: "normal" as const } };
    expect(issuesCount(normal, s).ok).toBe(true);
    expect(issuesBannerText(normal, s)).toBeNull();
  });

  for (const p of modes(demo)) {
    const name = p.input.mode === "legacy" ? "«Как в исходном Excel»" : "«Расчёт сервиса»";
    it(`Дербеневская, ${name}: 34 в файле (23 + 11), 4 вопроса автору; в расчёте сервиса не исправлено 7`, () => {
      const s = issueSummary(p, projectQuestions(p, computeProject(p)));
      expect(s.byGroup).toEqual({ distorts: 23, method: 11, author: 4 });
      expect(s.open).toBe(34);
      expect(s.inFile).toBe(34);
      expect(s.notFixed).toBe(7);
      const c = issuesCount(p, s);
      const banner = issuesBannerText(p, s);
      if (p.input.mode === "legacy") {
        // в «Как в исходном Excel» — сколько ошибок в файле, плашки нет
        expect(c.n).toBe(34);
        expect(c.title).toMatch(/^В файле: 34/);
        expect(banner).toBeNull();
      } else {
        expect(c.n).toBe(7);
        expect(count(c.title)).toBe(7);
        expect(banner).toBe("Не исправлено: 7.");
      }
    });

    it(`Дербеневская, ${name}: статус «исправлено» — из кода ядра`, () => {
      const items = issueItems(p, projectQuestions(p, computeProject(p))).filter((i) => i.group !== "author");
      expect(items.filter((i) => !i.fixed).map((i) => i.label)).toEqual(["3", "9", "10", "11", "17", "18", "М5"]);
    });
  }
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

  it("вкладки «Расхождения» и плашки нет; стандартные значения — только «не подтверждено» на полях вкладок", () => {
    const s = issueSummary(p, projectQuestions(p, m));
    expect(s.shown).toBe(false);
    expect(issueItems(p, projectQuestions(p, m))).toEqual([]);
    expect(issuesBannerText(p, s)).toBeNull();
    const unconfirmed = unconfirmedStandard(p, SPEC_ASSUMPTIONS);
    expect(unconfirmed).toEqual(standardInUse(p, SPEC_ASSUMPTIONS));
    expect(unconfirmed).toHaveLength(13);
    // каждое стоит на своей вкладке и попадает в её счётчик «не подтверждено»
    const onTabs = (["tep", "budget", "sales", "escrow", "cf", "dashboard"] as const).reduce((n, t) => n + tabCount(t, p, unconfirmed), 0);
    expect(onTabs).toBe(unconfirmed.length);
  });

  it("ни одна проверка не в статусе «ошибка»; незаполненные поля считаются на своих вкладках", () => {
    expect(m.result.messages.filter((x) => x.severity === "error" && x.formulaId?.startsWith("F.CHECK."))).toEqual([]);
    expect(tabMissing("tep", p, m)).toBe(7);
  });
});
