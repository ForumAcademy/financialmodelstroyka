import type { CalcRow } from "../Sheet";

/** ID формул из строк расчёта. */
export const formulaIds = (rows: CalcRow[]) => rows.flatMap((r) => ("formula" in r && r.formula ? [r.formula] : []));
