import Decimal from "decimal.js";
import { getRegion, isRegionCode } from "@fm/spec";
import type { DemoProject } from "./types";

const RU = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
const PERCENT = 100;

export function num(value: unknown, digits = 2): string {
  if (value instanceof Decimal) return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: digits }).format(value.toNumber());
  if (typeof value === "number") return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: digits }).format(value);
  return String(value);
}

export function share(value: number): string {
  return `${RU.format(value * PERCENT)}%`;
}

/** «2025-12-31» → «31.12.2025». */
export function date(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export function unit(u: string): string {
  return u === "м2" ? "м²" : u === "руб/м2" ? "руб/м²" : u;
}

/** Значение параметра или формулы для таблицы. */
export function value(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (v instanceof Decimal || typeof v === "number") return num(v, 3);
  if (typeof v === "boolean") return v ? "да" : "нет";
  if (typeof v === "string") return /^\d{4}-\d{2}-\d{2}$/.test(v) ? date(v) : v;
  if (Array.isArray(v)) {
    if (v.every((x) => x instanceof Decimal || typeof x === "number")) return v.map((x) => num(x, 3)).join(" · ");
    return `таблица, ${v.length} строк`;
  }
  if (typeof v === "object") {
    const entries = Object.entries(v as Record<string, unknown>);
    if (entries.every(([, x]) => x instanceof Decimal)) return entries.map(([k, x]) => `${k}: ${num(x, 3)}`).join(" · ");
    return "таблица";
  }
  return String(v);
}

export function ago(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "сегодня";
  if (days === 1) return "вчера";
  return `${days} дн. назад`;
}

/** Склонение: plural(1, ["параметр", "параметра", "параметров"]). */
export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b === 1) return forms[0];
  if (b > 1 && b < 5) return forms[1];
  return forms[2];
}

export function regionName(p: DemoProject): string {
  const code = p.input.values["GEN.REGION_CODE"];
  return typeof code === "string" && isRegionCode(code) ? getRegion(code).name : "—";
}
