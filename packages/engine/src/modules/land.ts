/**
 * LAND — земельные платежи (data/formulas.yaml, модуль LAND).
 * Правила, которых нет в спецификации, не додумываются: расчёт останавливается с понятной ошибкой.
 */
import Decimal from "decimal.js";
import type { FormulaContext } from "../context";
import { CalcError } from "../context";
import { maxDate, minDate, monthDiff, type IsoDate } from "../lib/dates";
import { milestone, milestones } from "./time";

const ONE = new Decimal(1);
const ZERO = new Decimal(0);
const MONTHS_PER_YEAR = 12;

/** Период владения участком для налога: от приобретения до окончания передачи последней очереди. */
function landPeriod(ctx: FormulaContext): { from: IsoDate; to: IsoDate } {
  const rows = milestones(ctx);
  return {
    from: minDate(rows.map((r) => milestone(r, "land_acquired"))),
    to: maxDate(rows.map((r) => milestone(r, "handover_end"))),
  };
}

export function F_LAND_TAX_COEF(ctx: FormulaContext): Decimal[] {
  const date = ctx.formula<IsoDate[]>("F.TIME.DATE");
  if (ctx.param<boolean>("TAX.LAND_COEF_APPLY") === false) return date.map(() => ONE);
  const upTo = ctx.requireNum("TAX.LAND_COEF_UP_TO_3Y");
  const over = ctx.requireNum("TAX.LAND_COEF_OVER_3Y");
  const thresholdMonths = ctx.requireNum("TIME.RNS_TO_RNV_TAX_YEARS").mul(MONTHS_PER_YEAR);
  const { from, to } = landPeriod(ctx);
  // Коэффициент действует с приобретения участка до госрегистрации прав на объект (≈ окончание передачи последней очереди).
  return date.map((d) => {
    if (d < from || d > to) return ONE;
    return thresholdMonths.gte(monthDiff(from, d)) ? upTo : over;
  });
}

export function F_LAND_TAX_OR_RENT(ctx: FormulaContext): Decimal[] {
  const tenure = ctx.require<string>("LAND.TENURE");
  if (tenure === "аренда") {
    ctx.param("LAND.RENT_ANNUAL");
    throw new CalcError("Аренда участка: индекс арендной платы и период аренды в спецификации не заданы (вопрос владельцу продукта)", "LAND.TENURE");
  }
  if (tenure !== "собственность") throw new CalcError(`Неизвестная форма права «${tenure}»`, "LAND.TENURE");
  if (ctx.num("LAND.CADASTRAL_VALUE_AFTER_VRI") !== null) {
    throw new CalcError("Кадастровая стоимость после смены ВРИ задана, но дата смены ВРИ в спецификации не определена (вопрос владельцу продукта)", "LAND.CADASTRAL_VALUE_AFTER_VRI");
  }
  const cad = ctx.requireNum("LAND.CADASTRAL_VALUE");
  const rate = ctx.requireNum("TAX.LAND_RATE");
  const coef = ctx.formula<Decimal[]>("F.LAND.TAX_COEF");
  const date = ctx.formula<IsoDate[]>("F.TIME.DATE");
  const { from, to } = landPeriod(ctx);
  return date.map((d, t) => (d >= from && d <= to ? cad.mul(rate).mul(coef[t] as Decimal).div(MONTHS_PER_YEAR) : ZERO));
}

export function F_LAND_VRI_FEE(ctx: FormulaContext): Decimal {
  const region = ctx.region();
  if (region.vri_fee.exists === false) return ZERO;
  // Формула региона (например, Москва — 593-ПП) в спецификацию не выписана: обязательный ручной ввод с документом (CLAUDE.md, правило 8).
  const fee = ctx.requireNum("LAND.VRI_FEE");
  ctx.message("info", `Плата за изменение ВРИ введена вручную по документу: формула региона «${region.name}» ещё не выписана в справочник`, "LAND.VRI_FEE");
  return fee;
}

export const LAND_FORMULAS = {
  "F.LAND.TAX_COEF": F_LAND_TAX_COEF,
  "F.LAND.TAX_OR_RENT": F_LAND_TAX_OR_RENT,
  "F.LAND.VRI_FEE": F_LAND_VRI_FEE,
} as const;
