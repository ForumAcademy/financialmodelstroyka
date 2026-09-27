import type { FormulaId } from "@fm/spec";
import type { FormulaFn } from "./context";
import { CAPEX_FORMULAS } from "./modules/capex";
import { ESCROW_FORMULAS } from "./modules/escrow";
import { LAND_FORMULAS } from "./modules/land";
import { SALES_FORMULAS } from "./modules/sales";
import { TEP_FORMULAS } from "./modules/tep";
import { TIME_FORMULAS } from "./modules/time";

/** Все реализованные формулы: ID из data/formulas.yaml → функция с тем же именем. */
export const FORMULAS: Partial<Record<FormulaId, FormulaFn>> = {
  ...TIME_FORMULAS,
  ...TEP_FORMULAS,
  ...LAND_FORMULAS,
  ...CAPEX_FORMULAS,
  ...SALES_FORMULAS,
  ...ESCROW_FORMULAS,
};

/** Модули, реализованные полностью: для них тест требует функцию на каждую формулу YAML. */
export const IMPLEMENTED_MODULES = ["TIME", "TEP", "LAND", "CAPEX", "SALES", "ESCROW"] as const;
