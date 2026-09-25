import Decimal from "decimal.js";

const PERCENT = 100;
const RU = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });

/** Число для текста сообщения: «143 560,39». */
export function fmt(value: Decimal | number): string {
  return RU.format(new Decimal(value).toNumber());
}

/** Доля как процент для текста сообщения: 0,012 → «1,2%». */
export function fmtShare(value: Decimal): string {
  return `${RU.format(value.mul(PERCENT).toNumber())}%`;
}
