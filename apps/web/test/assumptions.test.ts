import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { calculate, legacyCaseInput } from "@fm/engine";
import { checkAssumptions, spec } from "@fm/spec";
import { diffVersions, latest, SPEC_ASSUMPTIONS, standardValues, valueSource } from "../lib/assumptions";
import { computeProject, effectiveInput, effectiveValue, provisionalHorizon } from "../lib/model";
import { standardInUse, unconfirmedStandard } from "../lib/standard";
import { loadSeed } from "../lib/seed";
import { assumptionsReducer, reducer } from "../lib/store";
import type { DemoProject } from "../lib/types";
import { whence } from "../lib/whence";

const demo = loadSeed().projects[0] as DemoProject;
const at = "2026-09-27T12:00:00.000Z";
const fresh: DemoProject = { id: "p1", name: "Новый", archived: false, sources: [], paramSources: {}, specVersion: spec.specVersion, assumptionsVersion: 1, updatedAt: at, input: { values: {} } };
const edited = assumptionsReducer(SPEC_ASSUMPTIONS, {
  type: "edit",
  param: "TIME.ESCROW_RELEASE_LAG_M",
  patch: { value: 2, from: { text: "Практика банка-партнёра", url: null } },
  why: "банк раскрывает быстрее",
  author: "Методолог",
});

describe("справочник допущений компании", () => {
  it("версия 1 проходит проверки и заполнена из исходного Excel", () => {
    expect(checkAssumptions(spec)).toEqual([]);
    const v1 = standardValues(latest(SPEC_ASSUMPTIONS));
    const excel = legacyCaseInput(demo.legacyCase!).values;
    for (const id of ["OPEX.MARKETING_RATE", "OPEX.BROKERAGE_RATE", "OPEX.DEV_FEE_RATE", "SALES.PAYMENT_MIX", "FIN.EQUITY_SHARE", "FIN.FEE_ARRANGEMENT"] as const) {
      expect(v1[id]).toEqual(excel[id]);
    }
    // «Рыночный рост цен» — не заполняется (решение владельца продукта), комиссии банку по ипотеке в Excel нет
    expect("SALES.PRICE_MARKET_GROWTH" in v1).toBe(false);
    expect("SALES.MORTGAGE_BANK_FEE_RATE" in v1).toBe(false);
  });

  it("новый проект получает стандарт своей версии; своё значение проекта главнее", () => {
    expect(effectiveInput(fresh).standard?.["OPEX.MARKETING_RATE"]).toBe(0.035);
    expect(valueSource(fresh, "OPEX.MARKETING_RATE", SPEC_ASSUMPTIONS)).toBe("standard");
    const own = { ...fresh, input: { values: { "OPEX.MARKETING_RATE": 0.03 } } };
    expect(valueSource(own, "OPEX.MARKETING_RATE", SPEC_ASSUMPTIONS)).toBe("project");
    expect(valueSource(fresh, "LAND.AREA", SPEC_ASSUMPTIONS)).toBeNull();
    expect(whence("OPEX.MARKETING_RATE", fresh).text).toMatch(/^Справочник допущений компании, версия 1: Исходный Excel/);
  });

  it("правка справочника — новая версия с историей; проект остаётся на своей версии до «Обновить»", () => {
    expect(edited.map((v) => v.version)).toEqual([1, 2]);
    expect(edited[1]).toMatchObject({ author: "Методолог", note: "банк раскрывает быстрее" });
    expect(diffVersions(edited[0]!, edited[1]!)).toMatchObject([{ param: "TIME.ESCROW_RELEASE_LAG_M", valueChanged: true }]);
    const p = { ...demo, input: { ...demo.input, mode: "normal" as const } };
    expect(effectiveValue(p, "TIME.ESCROW_RELEASE_LAG_M", edited)).toBe(3);
    const updated = reducer([p], { type: "assumptionsVersion", id: p.id, version: 2 })[0]!;
    expect(effectiveValue(updated, "TIME.ESCROW_RELEASE_LAG_M", edited)).toBe(2);
  });

  it("подтверждение финансистов (статус «Решено») → «подтверждено финансистами», справочник не меняется", () => {
    const [p] = reducer([fresh], { type: "issue", id: fresh.id, key: "STANDARD:OPEX.MARKETING_RATE", no: 1, question: "q", event: { status: "done", author: "Финансист", at, comment: "по бюджету 2027" } });
    expect(valueSource(p!, "OPEX.MARKETING_RATE", SPEC_ASSUMPTIONS)).toBe("confirmed");
    expect(whence("OPEX.MARKETING_RATE", p!).text).toContain("Подтверждение финансистов: по бюджету 2027");
  });

  it("стандартное значение без подтверждения — на поле «не подтверждено»; «Подтвердить» убирает его из списка", () => {
    const normal: DemoProject = { ...demo, input: { ...demo.input, mode: "normal" } };
    expect(unconfirmedStandard(normal, SPEC_ASSUMPTIONS)).toContain("TIME.ESCROW_RELEASE_LAG_M");
    // статьи бюджета демо-проекта заданы суммами Excel — ставка маркетинга в расчёте не участвует и подтверждения не ждёт
    expect(standardInUse(normal, SPEC_ASSUMPTIONS)).not.toContain("OPEX.MARKETING_RATE");
    const [p] = reducer([normal], { type: "issue", id: normal.id, key: "STANDARD:TIME.ESCROW_RELEASE_LAG_M", no: 0, question: "q", event: { status: "done", author: "Финансист", at } });
    expect(unconfirmedStandard(p!, SPEC_ASSUMPTIONS)).not.toContain("TIME.ESCROW_RELEASE_LAG_M");
    expect(p!.issues?.["STANDARD:TIME.ESCROW_RELEASE_LAG_M"]?.history).toEqual([{ status: "done", author: "Финансист", at }]);
    // «Как в исходном Excel» берёт значения из Excel — стандарта нет
    expect(unconfirmedStandard(demo, SPEC_ASSUMPTIONS)).toEqual([]);
  });

  it("«Как в исходном Excel» берёт значения из Excel, даже если справочник изменился", () => {
    const changed = assumptionsReducer(SPEC_ASSUMPTIONS, { type: "edit", param: "SALES.PAYMENT_MIX", patch: { value: null }, why: "проверка", author: "Методолог" });
    const p = { ...demo, assumptionsVersion: 2 };
    const excel = calculate(legacyCaseInput(demo.legacyCase!), { horizonMonths: provisionalHorizon(demo) as number }, ["F.SALES.REVENUE_TOTAL", "F.ESC.BALANCE"]);
    const gross = (r: { formulas: Record<string, { value: unknown } | undefined> }) => (r.formulas["F.SALES.REVENUE_TOTAL"]?.value as { gross: Decimal }).gross.toNumber();
    expect(gross(computeProject(p, changed).result)).toBe(gross(excel));
    expect(gross(computeProject(demo).result)).toBe(gross(excel));
  });

  it("резерв на непредвиденные: в «Расчёте сервиса» 2% СМР, в «Как в исходном Excel» — сумма из Бюджет!F42", () => {
    const reserve = (p: DemoProject) => {
      const f = computeProject(p).result.formulas;
      const items = f["F.CAPEX.ITEM_TOTAL"]?.value as Record<string, Decimal>;
      return { reserve: items.CONTINGENCY!, smr: f["F.CAPEX.SMR_TOTAL"]?.value as Decimal };
    };
    const legacy = reserve({ ...demo, input: { ...demo.input, mode: "legacy" } });
    expect(legacy.reserve.toNumber()).toBeCloseTo(202840, 0);
    const normal = reserve({ ...demo, input: { ...demo.input, mode: "normal" } });
    expect(normal.reserve.div(normal.smr).toNumber()).toBeCloseTo(0.02, 6);
  });
});
