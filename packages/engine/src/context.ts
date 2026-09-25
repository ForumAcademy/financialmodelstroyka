import Decimal from "decimal.js";
import {
  FORMULA_IDS,
  getFormula,
  getParameter,
  getRegion,
  isRegionCode,
  type FormulaId,
  type ParameterId,
  type RegionCode,
  type SpecRegion,
} from "@fm/spec";
import type {
  CalcMessage,
  CalcMode,
  CalcOptions,
  ParameterTrace,
  ProjectInput,
  ResultSet,
  Severity,
  TraceNode,
  ValueOrigin,
} from "./types";

/** Функция формулы: имя совпадает с ID (F.FIN.RATE → F_FIN_RATE), CLAUDE.md, правило 2. */
export type FormulaFn = (ctx: FormulaContext) => unknown;

/** Не заполнен обязательный параметр — формула не считается, пользователь видит, что ввести. */
export class MissingInputError extends Error {
  constructor(readonly parameterId: ParameterId) {
    super(`Не заполнен параметр ${parameterId}`);
  }
}

/** Формула не посчитана из-за ошибки в формуле, от которой она зависит (сообщение уже выдано там). */
export class DependencyError extends Error {
  constructor(readonly formulaId: FormulaId) {
    super(`Не посчитана формула ${formulaId}`);
  }
}

/** Блокирующая ошибка расчёта с текстом для пользователя. */
export class CalcError extends Error {
  constructor(
    message: string,
    readonly parameterId?: ParameterId,
  ) {
    super(message);
  }
}

/**
 * Значения region-параметров из data/regions.yaml. Параметр без поля в regions.yaml
 * (например, TAX.LAND_RATE — ставка по ОКТМО) вводится по проекту.
 */
const REGION_VALUES: Partial<Record<ParameterId, (r: SpecRegion) => unknown>> = {
  "TEP.PARKING_NORM": (r) => (r.parking_norm.values ? r.parking_norm : null),
  "TEP.PARKING_NORM_APART": (r) => (r.parking_norm_apart.values ? r.parking_norm_apart : null),
};

/** Что видит формула: только чтение параметров и других формул с записью в след. */
export interface FormulaContext {
  readonly mode: CalcMode;
  readonly horizonMonths: number | null;
  /** Значение параметра или null, если не задано. */
  param<T = unknown>(id: ParameterId): T | null;
  /** Значение параметра; если не задано — блокирующая ошибка «заполните параметр». */
  require<T = unknown>(id: ParameterId): T;
  /** Числовой параметр как Decimal или null. */
  num(id: ParameterId): Decimal | null;
  requireNum(id: ParameterId): Decimal;
  /** Результат другой формулы. */
  formula<T = unknown>(id: FormulaId): T;
  /** Регион проекта (GEN.REGION_CODE) из data/regions.yaml. */
  region(): SpecRegion;
  message(severity: Severity, text: string, parameterId?: ParameterId): void;
}

interface Frame {
  id: FormulaId;
  inputs: Set<ParameterId | FormulaId>;
}

export class Engine {
  readonly mode: CalcMode;
  readonly horizonMonths: number | null;
  private readonly values: ProjectInput["values"];
  private readonly nodes = new Map<FormulaId, TraceNode>();
  private readonly failed = new Set<FormulaId>();
  private readonly params = new Map<ParameterId, ParameterTrace>();
  private readonly messages: CalcMessage[] = [];
  private readonly stack: Frame[] = [];

  constructor(
    input: ProjectInput,
    private readonly registry: Partial<Record<FormulaId, FormulaFn>>,
    options: CalcOptions = {},
  ) {
    this.values = input.values;
    this.mode = input.mode ?? "normal";
    this.horizonMonths = options.horizonMonths ?? null;
  }

  /** Посчитать формулу (с мемоизацией). Ошибки превращаются в сообщения, значение — null. */
  evaluate(id: FormulaId): unknown {
    const done = this.nodes.get(id);
    if (done) return done.value;
    if (this.failed.has(id)) throw new DependencyError(id);
    if (this.stack.some((f) => f.id === id)) {
      throw new Error(`Цикл в графе формул: ${[...this.stack.map((f) => f.id), id].join(" → ")}`);
    }
    const fn = this.registry[id];
    if (!fn) throw new Error(`Формула ${id} ещё не реализована`);

    const frame: Frame = { id, inputs: new Set() };
    this.stack.push(frame);
    try {
      const value = fn(this.context(frame));
      this.nodes.set(id, { id, value, inputs: [...frame.inputs] });
      return value;
    } catch (e) {
      this.failed.add(id);
      if (e instanceof MissingInputError) {
        const p = getParameter(e.parameterId);
        this.push({ severity: "error", formulaId: id, parameterId: e.parameterId, text: `Заполните «${p.name}» (${p.id})` });
      } else if (e instanceof CalcError) {
        this.push({ severity: "error", formulaId: id, text: e.message, ...(e.parameterId ? { parameterId: e.parameterId } : {}) });
      } else if (!(e instanceof DependencyError)) {
        throw e;
      }
      throw new DependencyError(id);
    } finally {
      this.stack.pop();
    }
  }

  /** Посчитать набор формул; ошибки остаются в сообщениях. */
  run(targets: readonly FormulaId[]): ResultSet {
    for (const id of targets) {
      try {
        this.evaluate(id);
      } catch (e) {
        if (!(e instanceof DependencyError)) throw e;
      }
    }
    return this.result();
  }

  result(): ResultSet {
    const code = this.rawParam("GEN.REGION_CODE");
    return {
      regionCode: typeof code === "string" && isRegionCode(code) ? code : null,
      formulas: Object.fromEntries(FORMULA_IDS.filter((id) => this.nodes.has(id)).map((id) => [id, this.nodes.get(id)])),
      parameters: Object.fromEntries(this.params),
      messages: [...this.messages],
    };
  }

  private push(m: CalcMessage) {
    this.messages.push(m);
  }

  private rawParam(id: ParameterId): unknown {
    return this.values[id];
  }

  /** Значение параметра: проект → регион (regions.yaml) → значение по умолчанию из parameters.yaml. */
  private resolve(id: ParameterId): { value: unknown; origin: ValueOrigin } | null {
    const own = this.values[id];
    if (own !== undefined && own !== null) return { value: own, origin: "project" };
    const fromRegion = REGION_VALUES[id];
    const region = this.projectRegion();
    if (fromRegion && region) {
      const v = fromRegion(region);
      if (v !== null && v !== undefined) return { value: v, origin: "region" };
    }
    const def = getParameter(id).default;
    if (def !== null && def !== undefined) return { value: def, origin: "template" };
    return null;
  }

  private projectRegion(): SpecRegion | null {
    const code = this.values["GEN.REGION_CODE"];
    return typeof code === "string" && isRegionCode(code) ? getRegion(code as RegionCode) : null;
  }

  private context(frame: Frame): FormulaContext {
    const read = (id: ParameterId) => {
      frame.inputs.add(id);
      const r = this.resolve(id);
      if (r && !this.params.has(id)) this.params.set(id, { id, value: r.value, origin: r.origin });
      return r ? r.value : null;
    };
    const toNum = (id: ParameterId, v: unknown): Decimal | null => {
      if (v === null) return null;
      if (typeof v === "number" || typeof v === "string") return new Decimal(v);
      throw new CalcError(`Параметр ${id} должен быть числом`, id);
    };
    const ctx: FormulaContext = {
      mode: this.mode,
      horizonMonths: this.horizonMonths,
      param: <T>(id: ParameterId) => read(id) as T | null,
      require: <T>(id: ParameterId) => {
        const v = read(id);
        if (v === null) throw new MissingInputError(id);
        return v as T;
      },
      num: (id) => toNum(id, read(id)),
      requireNum: (id) => {
        const v = toNum(id, read(id));
        if (v === null) throw new MissingInputError(id);
        return v;
      },
      formula: <T>(id: FormulaId) => {
        frame.inputs.add(id);
        return this.evaluate(id) as T;
      },
      region: () => {
        const code = read("GEN.REGION_CODE");
        if (typeof code !== "string" || !isRegionCode(code)) throw new MissingInputError("GEN.REGION_CODE");
        return getRegion(code);
      },
      message: (severity, text, parameterId) => {
        this.push({ severity, formulaId: frame.id, text, ...(parameterId ? { parameterId } : {}) });
      },
    };
    return ctx;
  }
}

/** Формулы, от которых не зависит ни одна другая реализованная формула, — корни расчёта. */
export function sinkFormulas(implemented: readonly FormulaId[]): FormulaId[] {
  const set = new Set(implemented);
  const used = new Set<string>();
  for (const id of implemented) for (const d of getFormula(id).depends_on) if (set.has(d as FormulaId)) used.add(d);
  return implemented.filter((id) => !used.has(id));
}
