/**
 * ESCROW — счета эскроу по очередям (data/formulas.yaml, модуль ESCROW; 214-ФЗ, ст. 15.4–15.5).
 * Ряды по очередям — в порядке номера очереди в TIME.MILESTONES (как флаги F.TIME.*).
 */
import Decimal from "decimal.js";
import type { FormulaContext } from "../context";
import { milestones } from "./time";
import { products, type CashIn } from "./sales";

const ZERO = new Decimal(0);

export function F_ESC_DEPOSIT(ctx: FormulaContext): Decimal[][] {
  const cash = ctx.formula<CashIn>("F.SALES.CASH_IN");
  const phases = milestones(ctx);
  const list = products(ctx);
  const months = Object.values(cash.ddu)[0]?.length ?? 0;
  return phases.map((_, i) => {
    const out = Array.from({ length: months }, () => ZERO);
    for (const p of list) {
      if (p.phaseIndex !== i) continue;
      (cash.ddu[p.key] ?? []).forEach((x, t) => (out[t] = (out[t] as Decimal).add(x)));
    }
    return out;
  });
}

/** Остаток и раскрытие эскроу по очередям. */
export interface EscrowBalance {
  balance: Decimal[][];
  release: Decimal[][];
}

export function F_ESC_BALANCE(ctx: FormulaContext): EscrowBalance {
  const deposit = ctx.formula<Decimal[][]>("F.ESC.DEPOSIT");
  const flag = ctx.formula<number[][]>("F.TIME.FLAG_ESCROW_RELEASE");
  const balance: Decimal[][] = [];
  const release: Decimal[][] = [];
  deposit.forEach((dep, p) => {
    const f = flag[p] ?? [];
    let bal = ZERO;
    let released = false;
    const b: Decimal[] = [];
    const r: Decimal[] = [];
    dep.forEach((x, t) => {
      // В месяц раскрытия передаётся весь остаток; поступления после раскрытия передаются в том же месяце
      const out = f[t] === 1 ? bal.add(x) : released ? x : ZERO;
      if (f[t] === 1) released = true;
      bal = bal.add(x).sub(out);
      b.push(bal);
      r.push(out);
    });
    balance.push(b);
    release.push(r);
  });
  return { balance, release };
}

export function F_ESC_COVERAGE(ctx: FormulaContext): null {
  // Числитель — остатки эскроу — уже есть; знаменатель — долг и проценты (F.FIN.*) — модуль этапа 5
  ctx.formula<EscrowBalance>("F.ESC.BALANCE");
  ctx.message("info", "Покрытие долга остатками эскроу появится с расчётом проектного финансирования (этап 5)");
  return null;
}

export const ESCROW_FORMULAS = {
  "F.ESC.DEPOSIT": F_ESC_DEPOSIT,
  "F.ESC.BALANCE": F_ESC_BALANCE,
  "F.ESC.COVERAGE": F_ESC_COVERAGE,
} as const;
