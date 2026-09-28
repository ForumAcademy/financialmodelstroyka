/**
 * Вид поля в шагах «Вводных показателей» (задание на пересборку интерфейса, раздел 3.3): короткая подпись, единица
 * на экране и пересчёт долей в проценты. В данных доли остаются долями (CLAUDE.md, правило 6): 0,05 хранится как 0,05,
 * а на экране вводится и показывается «5 %».
 */
import Decimal from "decimal.js";
import { getParameter, type ParameterId } from "@fm/spec";
import type { DemoProject } from "./types";

/** Короткие подписи полей: название вкладки уже говорит, откуда значение («ТЭП», «Пределы ГПЗУ»). */
export const FIELD_LABEL: Partial<Record<ParameterId, string>> = {
  "GEN.REGION_CODE": "Регион",
  "GEN.PROJECT_STAGE": "Что есть по проекту",
  "GEN.MODEL_START_DATE": "Дата начала модели",
  "GEN.CADASTRAL_NUMBER": "Кадастровый номер",
  "LAND.AREA": "Площадь участка",
  "LAND.CADASTRAL_VALUE": "Кадастровая стоимость (текущая)",
  "LAND.TENURE": "Форма права",
  "TEP.GFA_ABOVE": "ГНС наземной части",
  "TEP.GFA_BELOW": "ГНС подземной части (паркинг, техпомещения)",
  "TEP.RES_GFA": "в том числе жилая",
  "TEP.NONRES_GFA": "в том числе нежилая (коммерция, соцобъекты)",
  "TEP.APT_AREA": "Квартиры к продаже",
  "TEP.COMM_AREA": "Коммерческие помещения (ПСН)",
  "TEP.APART_AREA": "Апартаменты",
  "TEP.MOP_AREA": "МОП под отделку (лобби, ресепшн)",
  "TEP.STORAGE_COUNT": "Кладовые",
  "TEP.STORAGE_AREA": "Площадь кладовых",
  "TEP.FOOTPRINT_AREA": "Пятно застройки",
  "TEP.MAX_FLOORS": "Этажность",
  "TEP.BUILDING_HEIGHT_M": "Высота здания",
  "GPZU.MAX_GFA_ABOVE": "Максимальная ГНС наземной части",
  "GPZU.MAX_BUILT_SHARE": "Максимальный процент застройки",
  "GPZU.MAX_FLOORS": "Предельное количество этажей",
  "GPZU.MAX_HEIGHT_M": "Предельная высота",
  "GPZU.APART_ALLOWED": "Допускаются апартаменты",
  "TEP.PARKING_NORM": "Норматив по типам квартир",
  "TEP.PARKING_GPZU_COUNT": "По ГПЗУ / ППТ",
  "TEP.PARKING_COUNT_OVERRIDE": "Количество в модели",
  "TEP.PARKING_AREA_PER_SPACE": "Площадь паркинга на одно место",
  "TEP.LANDSCAPE_SHARE": "Доля благоустройства от площади участка",
  "TEP.ROAD_SHARE": "Проезды, доля благоустройства",
  "TEP.GREEN_SHARE": "Озеленение, доля благоустройства",
  "SALES.PRICE_MARKET_GROWTH": "Рыночный рост цены",
  "SALES.PRICE_STAGE_UPLIFT": "Надбавка за стадию готовности",
  "SALES.LEGACY_PRICE_GROWTH": "Рост цены в исходном файле",
  "SALES.LEGACY_CASH_IN_END": "Последний месяц поступлений в исходном файле",
  "SALES.PAYMENT_MIX": "Структура оплат",
  "LAND.LEGAL_COSTS": "Юридические расходы и проверка участка",
  "LAND.AGENT_FEE_RATE": "Агентское вознаграждение",
  "LAND.CITY_CASH_COMPENSATION": "Денежная компенсация городу",
  "LAND.CITY_OBJECTS_COST": "Строительство и передача объектов городу",
  "LAND.RENT_ANNUAL": "Арендная плата за год",
  "LAND.VRI_FEE": "Плата за изменение ВРИ по расчёту ДГИ",
  "OPEX.DEV_FEE_RATE": "Вознаграждение за управление проектом",
  "OPEX.MARKETING_RATE": "Маркетинг",
  "OPEX.BROKERAGE_RATE": "Брокеридж и агенты",
  "CAPEX.CONTINGENCY_RATE": "Резерв на непредвиденные",
  "CAPEX.COST_INDEX": "Рост строительных затрат",
  "CAPEX.OPEX_INDEX": "Рост прочих затрат",
  "FIN.EQUITY_SHARE": "Собственные средства до первой выдачи",
  "FIN.LEGACY_LIMIT": "Лимит кредита",
  "FIN.FEE_ARRANGEMENT": "Комиссия за выдачу",
  "FIN.FEE_COMMITMENT": "Комиссия за неиспользованный лимит",
  "FIN.COLLATERAL_DISCOUNT": "Дисконт залоговой стоимости",
  "FIN.KEY_RATE_PATH": "Ключевая ставка",
  "FIN.LEGACY_KEY_RATE": "Ключевая ставка в исходном файле",
  "FIN.RATE_BASE_SPREAD": "Надбавка к ключевой",
  "FIN.RATE_PREFERENTIAL": "Ставка на долг, покрытый эскроу",
  "FIN.RATE_DISCOUNT_COEF": "Скидка при избыточном покрытии эскроу",
  "FIN.RATE_MIN": "Минимальная ставка",
  "TIME.ESCROW_RELEASE_LAG_M": "Раскрытие после ввода",
  "FIN.ESCROW_RESERVE_RATE": "Уменьшение остатков эскроу для ставки (ФОР)",
  "TIME.LEGACY_ESCROW_DEPOSIT_END": "Последняя дата сделок на эскроу",
  "TIME.LEGACY_ESCROW_RELEASE_DATE": "Дата раскрытия эскроу",
  "TAX.VAT_REGIME": "Режим НДС по продуктам",
  "TAX.INPUT_VAT_RECOVERABLE": "Входящий НДС к вычету",
  "TAX.LOSS_CARRYFORWARD_LIMIT": "Лимит зачёта убытков прошлых лет",
  "TAX.LAND_RATE": "Ставка земельного налога",
  "LAND.CADASTRAL_VALUE_AFTER_VRI": "Кадастровая стоимость после смены ВРИ",
  "GEN.VALUATION_DATE": "Дата оценки (приведения NPV)",
  "VAL.EQUITY_PREMIUM": "Премия за риск проекта",
  "VAL.HURDLE_IRR": "Целевая IRR акционера",
};

export const fieldLabel = (id: ParameterId): string => FIELD_LABEL[id] ?? getParameter(id).name;

/** Подписи статей бюджета, которые показываются полями на вкладках «Затрат». */
const ITEM_LABEL: Record<string, string> = {
  LAND_TAX_OR_RENT: "Земельный налог / аренда за период",
  CITY_OBJECTS_CONSTRUCTION: "Строительство и передача объектов городу",
  PREDESIGN: "Предпроектные проработки",
  LAND_LEGAL: "Юридические расходы и проверка участка",
};

/** Подпись статьи бюджета: у статьи со ставкой по справочнику своё поле — сумма статьи. */
export function itemLabel(item: { item_id: string; name: string; rate_param?: string | undefined }): string {
  return ITEM_LABEL[item.item_id] ?? (item.rate_param ? `${item.name}, сумма` : item.name);
}

/** Подписи столбцов таблиц вводных. */
export const COLUMN_LABEL: Record<string, string> = {
  phase: "Очередь",
  land_acquired: "Покупка ЗУ",
  design_start: "Начало ИРД/ПИР",
  expertise_done: "Экспертиза",
  rns_date: "РНС",
  construction_start: "Начало СМР",
  construction_end: "Окончание СМР",
  rnv_date: "РНВ",
  handover_start: "Начало передачи",
  handover_end: "Передача ключей",
  vri_change_date: "Смена ВРИ",
  value: "Норматив",
  unit: "Единица",
  sales_start: "Старт продаж",
  type_name: "Тип",
  count: "Кол-во, шт",
  area_share: "Доля площади",
  avg_area: "Ср. площадь, м²",
  product: "Продукт",
  stock_area: "Построено к продаже, м²",
  stock_units: "Построено к продаже, шт",
  start_price: "Стартовая цена",
  revenue: "Выручка, млрд руб",
  price_date: "Дата цены",
  sale_channel_before_rnv: "Канал до РНВ",
  source_ids: "Источники",
  mortgage_share: "Ипотечные сделки",
  mortgage_down_payment: "из них ПВ по ипотеке",
  full_payment_share: "100% оплата",
  installment_share: "Рассрочка",
  installment_months: "Рассрочка, мес",
  installment_down_payment: "Первый взнос",
  name: "Название",
  method: "Способ",
  manual: "Ручной ряд",
  stage: "Стадия",
  uplift: "Надбавка",
};

/** Варианты «Что есть по проекту» (раздел 3.1): в данных — прежние коды, на экране — что это значит для площадей. */
export const OPTION_LABEL: Record<string, string> = {
  "оценка участка": "есть только участок — площади по плотности",
  концепция: "есть концепция архитектора — площади по его ТЭП",
  ДДУ_эскроу: "ДДУ (эскроу)",
  не_продаётся: "не продаётся",
};

export const optionLabel = (o: string): string => OPTION_LABEL[o] ?? o;

/** Надбавки и поправки к ставке — в процентных пунктах. */
const POINTS: ParameterId[] = ["FIN.RATE_BASE_SPREAD", "FIN.RATE_DISCOUNT_COEF", "VAL.EQUITY_PREMIUM"];

/** «% чего» — у долей, для которых база не очевидна из подписи. */
const SHARE_OF: Partial<Record<ParameterId, string>> = {
  "LAND.AGENT_FEE_RATE": "% цены участка",
  "FIN.EQUITY_SHARE": "% бюджета",
  "FIN.FEE_ARRANGEMENT": "% лимита",
  "OPEX.MARKETING_RATE": "% выручки",
  "OPEX.BROKERAGE_RATE": "% выручки",
  "OPEX.DEV_FEE_RATE": "% выручки",
  "CAPEX.CONTINGENCY_RATE": "% СМР",
  "TAX.LOSS_CARRYFORWARD_LIMIT": "% базы",
  "TAX.INPUT_VAT_RECOVERABLE": "% входящего НДС",
  "TAX.LAND_RATE": "% кадастровой стоимости",
};

const UNIT: Record<string, string> = { м2: "м²", "руб/м2": "руб/м²", коэф: "", текст: "", дата: "", enum: "", bool: "" };

export interface FieldUnit {
  /** Подпись единицы в поле. */
  label: string;
  /** Во сколько раз число на экране больше хранимого: 100 — доля показана в процентах. */
  scale: number;
  /** Сколько знаков после запятой показывать: площади — целые м². */
  digits: number | null;
}

/** Единица на экране для хранимой единицы (параметр или столбец таблицы). */
export function unitOf(unit: string, id?: ParameterId): FieldUnit {
  if (id && POINTS.includes(id)) return { label: "п.п.", scale: 100, digits: null };
  if (unit === "доля") return { label: (id && SHARE_OF[id]) ?? "%", scale: 100, digits: null };
  if (unit === "%годовых") return { label: "% годовых", scale: 100, digits: null };
  if (unit === "доля/год") return { label: "% в год", scale: 100, digits: null };
  if (unit === "м2") return { label: "м²", scale: 1, digits: 0 };
  return { label: UNIT[unit] ?? unit, scale: 1, digits: null };
}

/** Хранимое число → текст поля: «0,0575» → «5,75»; площадь — целые м². */
export function toField(v: number, u: FieldUnit): string {
  let d = new Decimal(v).mul(u.scale);
  if (u.digits !== null) d = d.toDecimalPlaces(u.digits);
  const [int = "", frac] = d.toFixed().split(".");
  const sign = int.startsWith("-") ? "−" : "";
  const grouped = int.replace("-", "").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return frac === undefined ? `${sign}${grouped}` : `${sign}${grouped},${frac}`;
}

/** Текст поля → хранимое число; не число — null. «5,75» при scale 100 → 0,0575. */
export function fromField(text: string, u: FieldUnit): number | null {
  const t = text.trim().replace(/\s/g, "").replace(",", ".").replace("−", "-").replace(/%$/, "");
  if (t === "" || Number.isNaN(Number(t))) return null;
  return new Decimal(t).div(u.scale).toNumber();
}

/**
 * Ячейка исходного Excel, откуда взято значение: только у проектов, загруженных из Excel, и только пока значение
 * не меняли в проекте. «Лист «ТЭПы», ячейка C15».
 */
export function excelCell(project: DemoProject, id: ParameterId): string | null {
  if (project.changes?.[id]) return null;
  const file = project.fromFile?.[id];
  if (file) return `Лист «${file.sheet}», ${file.cell.includes(":") ? "ячейки" : "ячейка"} ${file.cell}`;
  if (!project.legacyCase) return null;
  const cells = (getParameter(id).legacy ?? []).map((l) => l.cell).filter((c): c is string => typeof c === "string" && c.includes("!"));
  if (!cells.length) return null;
  const bySheet = new Map<string, string[]>();
  for (const c of cells) {
    const [sheet = "", ref = ""] = c.split("!");
    bySheet.set(sheet, [...(bySheet.get(sheet) ?? []), ref]);
  }
  return [...bySheet.entries()]
    .map(([sheet, refs]) => {
      const many = refs.length > 1 || refs.some((r) => r.includes(":") || r.includes(","));
      return `Лист «${sheet}», ${many ? "ячейки" : "ячейка"} ${refs.join(", ")}`;
    })
    .join("; ");
}
