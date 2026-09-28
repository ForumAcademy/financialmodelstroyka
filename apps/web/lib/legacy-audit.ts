/**
 * Пункты вкладки «Расхождения» для проекта из исходного Excel — по аудиту файла (docs/02_legacy_audit.md):
 * раздел 1 → «Искажают результат», раздел 2 → «Методика», раздел 3 → «Уточнить у автора файла» (решение владельца
 * продукта 28.09.2026). Вопросы, которые находит сам расчёт «как в исходном Excel» (dataQuestions, постоянные ключи),
 * показываются строкой внутри своего пункта. Тексты — по аудиту; при изменении аудита список обновляется вместе с ним.
 */
import type { FormulaId } from "@fm/spec";
import type { InputTab } from "./tab-inputs";

export type AuditGroup = "distorts" | "method" | "author";

export interface AuditItem {
  /** Постоянный ключ пункта: по нему хранится статус в проекте. */
  id: string;
  /** Номер на экране: «1», «М1», «В1». */
  label: string;
  group: AuditGroup;
  /** Вкладка, где видно место. */
  tab: InputTab;
  /** Ячейки исходного Excel. */
  where: string;
  title: string;
  /** Что это меняет в результате; пусто — аудит не оценивает. */
  effect: string;
  /** Как это место считается в расчёте сервиса. */
  fix: string;
  /** Вопрос автору файла (для группы «Уточнить у автора файла»). */
  question?: string;
  /** Ключи вопросов расчёта «как в исходном Excel», которые относятся к пункту. */
  keys: string[];
  /**
   * Формулы «Расчёта сервиса», которые заменяют это место файла. Статус «исправлено» берётся из кода: все формулы
   * реализованы в ядре (@fm/engine, FORMULAS). Пустой список — исправлено устройством сервиса (значение вводится
   * один раз, лист не переносится).
   */
  formulas: FormulaId[];
}

const DERBENEVSKAYA: AuditItem[] = [
  // ---------- Раздел 1. Критические ошибки (искажают результат) ----------
  { id: "AUDIT.1", label: "1", group: "distorts", tab: "escrow", where: "ТЭПы!C6:C12, CF1!D4:D6", title: "Вехи проекта введены текстом, и CF1 не может сравнить их с датами", effect: "Флаги стройки и раскрытия эскроу равны 0. Раскрытие проставлено руками (CF1!AB6 = 1), флаги продаж по эскроу перебиты нулями (AB8:AS8). На дашборде срок кредита и LTV равны 0.", fix: "Вехи — только даты, по каждой очереди.", keys: ["LEGACY.ESCROW_DATE"], formulas: ["F.TIME.FLAG_CONSTRUCTION", "F.TIME.FLAG_ESCROW_RELEASE"] },
  { id: "AUDIT.2", label: "2", group: "distorts", tab: "budget", where: "Бюджет!F42", title: "Резерв на непредвиденные расходы посчитан как площадь плюс ставка", effect: "202 840 ₽ вместо ~7,5 млрд ₽ по замыслу автора (48 958 ₽/м² × 153 882 м²).", fix: "Резерв — 2% стоимости СМР по методике Минстроя.", keys: ["LEGACY.CONTINGENCY_F42"], formulas: ["F.CAPEX.ITEM_TOTAL", "F.CAPEX.SMR_TOTAL"] },
  { id: "AUDIT.3", label: "3", group: "distorts", tab: "dashboard", where: "Бюджет!F69:F71", title: "Себестоимость делится на площадь только квартир типа 1", effect: "Себестоимость 2,96 млн ₽/м², наценка −80,6%.", fix: "Себестоимость делится на всю продаваемую площадь.", keys: [], formulas: ["F.KPI.COST_PER_M2"] },
  { id: "AUDIT.4", label: "4", group: "distorts", tab: "cf", where: "Бюджет!F38", title: "Статья «Устройство УДС» есть в бюджете, но не перенесена в CF1", effect: "−535,6 млн ₽ в денежном потоке.", fix: "Все статьи бюджета попадают в денежный поток.", keys: ["CAPEX.SCHEDULE_SUM:ROADS_UDS"], formulas: ["F.CAPEX.ITEM_CASH"] },
  { id: "AUDIT.5", label: "5", group: "distorts", tab: "cf", where: "CF1!F15:AH15", title: "Выручка в CF1 берётся только до столбца AH, а продажи идут до AJ", effect: "План продаж 118 130 млн ₽, в CF1 117 514 млн ₽: −616 млн ₽.", fix: "В денежный поток попадают все поступления от покупателей.", keys: ["SALES.CASH_IN_CUT"], formulas: ["F.SALES.CASH_IN"] },
  { id: "AUDIT.6", label: "6", group: "distorts", tab: "cf", where: "CF1!M78:AS78", title: "Брокеридж в CF1 ссылается на продажи разных кварталов", effect: "M78:AA78 берут продажи 7 кварталов назад, с AB78 — того же квартала, продажи T:Z пропущены. Бюджет 4 134,6 млн ₽, в CF1 2 733,2 млн ₽: −1 401 млн ₽.", fix: "Маркетинг и брокеридж платятся по графику продаж, без сдвига.", keys: ["CAPEX.SCHEDULE_SUM:BROKERAGE", "CAPEX.SCHEDULE_SUM:MARKETING", "LEGACY.CF1_LAG"], formulas: ["F.CAPEX.SCHEDULE_WEIGHT", "F.CAPEX.ITEM_CASH"] },
  { id: "AUDIT.7", label: "7", group: "distorts", tab: "cf", where: "CF1!55:56", title: "Ряд распределения «Прочие СМР» равен нулю", effect: "16,9 млн ₽ выпадают из денежного потока.", fix: "График каждой статьи в сумме даёт 100%.", keys: ["CAPEX.SCHEDULE_SUM:OTHER_SMR"], formulas: ["F.CAPEX.SCHEDULE_WEIGHT"] },
  { id: "AUDIT.8", label: "8", group: "distorts", tab: "cf", where: "CF1!62", title: "Ряд распределения непредвиденных в сумме даёт 124,6%", effect: "Часть резерва посчитана дважды.", fix: "График каждой статьи в сумме даёт 100%.", keys: ["CAPEX.SCHEDULE_SUM:CONTINGENCY"], formulas: ["F.CAPEX.SCHEDULE_WEIGHT"] },
  { id: "AUDIT.9", label: "9", group: "distorts", tab: "cf", where: "Бюджет!E54:F54, CF1!M85:AA85", title: "НДС не рассчитан: база — затраты минус выручка, сумма пустая, в CF1 вбито по 5 млн ₽ в квартал", effect: "НДС в модели не посчитан.", fix: "НДС по режиму налогообложения каждого продукта (этап 6).", keys: [], formulas: ["F.TAX.VAT_PAYABLE"] },
  { id: "AUDIT.10", label: "10", group: "distorts", tab: "sales", where: "План продаж!E61", title: "НДС 22% начислен сверху на всю выручку ПСН и машино-мест", effect: "Неверная база и ставка выделения (должно быть 22/122) и неверный режим: продажи по ДДУ освобождены от НДС (пп.23.1 п.3 ст.149 НК РФ).", fix: "Режим НДС по каждому продукту (этап 6).", keys: [], formulas: ["F.TAX.OUTPUT_VAT"] },
  { id: "AUDIT.11", label: "11", group: "distorts", tab: "budget", where: "Бюджет!M55", title: "Налог на прибыль равен 5,7% выручки", effect: "Налог не связан с Налоговым кодексом.", fix: "Налог на прибыль от налоговой базы с учётом экономии по ДДУ (этап 6).", keys: [], formulas: ["F.TAX.PROFIT_TAX"] },
  { id: "AUDIT.12", label: "12", group: "distorts", tab: "budget", where: "CF1!84", title: "Земельный налог 0,2% кадастровой стоимости, равномерно на 7,25 года", effect: "Для участка дороже 300 млн ₽ ставка до 1,5% с повышающим коэффициентом (ст.394, п.15 ст.396 НК РФ): 11,7 млн ₽ в модели против порядка 175 млн ₽ в год.", fix: "Земельный налог или аренда по ставке региона.", keys: [], formulas: ["F.LAND.TAX_COEF", "F.LAND.TAX_OR_RENT"] },
  { id: "AUDIT.13", label: "13", group: "distorts", tab: "tep", where: "ТЭПы!J44, C27", title: "862 машино-места вбиты поверх норматива", effect: "Норматив 0,8/1,2/1,6 из той же таблицы (ПП Москвы 2118-ПП) даёт 2 785 машино-мест.", fix: "Машино-мест не меньше норматива, иначе нужен документ.", keys: [], formulas: ["F.TEP.PARKING_REQUIRED", "F.TEP.PARKING_COUNT"] },
  { id: "AUDIT.14", label: "14", group: "distorts", tab: "budget", where: "Бюджет!E33, E34", title: "СМР подземной части и отделка МОП: объём 0", effect: "Паркинг и МОП ничего не стоят.", fix: "Базы — площадь подземной части и МОП из ТЭП.", keys: [], formulas: ["F.TEP.GFA_BELOW", "F.CAPEX.ITEM_TOTAL"] },
  { id: "AUDIT.15", label: "15", group: "distorts", tab: "sales", where: "План продаж!43, ТЭПы!C23", title: "ПСН: продано 10 888 м² при построенных 10 322 м², лоты дробные", effect: "Продано на 566 м² больше, чем построено.", fix: "Продажи не больше построенного.", keys: ["SALES.OVER_STOCK:ПСН", "LEGACY.PSN_STOCK"], formulas: ["F.SALES.SOLD_AREA"] },
  { id: "AUDIT.16", label: "16", group: "distorts", tab: "cf", where: "CF1!G132", title: "Собственные средства равны 10% расходов каждого квартала", effect: "Банк требует внести собственные средства до первой выдачи кредита.", fix: "Собственное участие вносится вперёд, до открытия кредита.", keys: ["LEGACY.FIN_EQUITY"], formulas: ["F.FIN.EQUITY_REQUIRED", "F.FIN.EQUITY_IN"] },
  { id: "AUDIT.17", label: "17", group: "distorts", tab: "dashboard", where: "Бюджет!F63:F66, Dashboard!C43:C45", title: "«NPV» — это финансовый результат, «IRR» — прибыль к затратам, «IRR продаж» — маржа", effect: "Названия показателей не соответствуют расчёту.", fix: "NPV и IRR по денежному потоку (этап 6).", keys: [], formulas: ["F.KPI.NPV", "F.KPI.IRR"] },
  { id: "AUDIT.18", label: "18", group: "distorts", tab: "dashboard", where: "CF1!D150, D155, Dashboard!C51:C52", title: "Три разных LLCR, ни один не соответствует определению", effect: "Показателем покрытия долга пользоваться нельзя.", fix: "LLCR по определению (этап 6).", keys: [], formulas: ["F.KPI.LLCR"] },
  // Найдено при сверке кредита CF1 (этап 5), добавлено в раздел 1 аудита
  { id: "AUDIT.19", label: "19", group: "distorts", tab: "cf", where: "CF1 строки 98, 100, 106", title: "Выдачи кредита гасятся в том же квартале, долг всегда 0", effect: "Кредит в денежном потоке не виден.", fix: "Выдачи накапливаются в долг и гасятся из эскроу и ДКП.", keys: ["LEGACY.FIN_DRAW_REPAID"], formulas: ["F.FIN.DRAW", "F.FIN.DEBT"] },
  { id: "AUDIT.20", label: "20", group: "distorts", tab: "cf", where: "CF1 строка 107", title: "Проценты начислены на половину выдачи и проценты прошлого квартала", effect: "14,39 млрд ₽ процентов при нулевом долге.", fix: "Проценты на остаток долга.", keys: ["LEGACY.FIN_INTEREST"], formulas: ["F.FIN.INTEREST"] },
  { id: "AUDIT.21", label: "21", group: "distorts", tab: "cf", where: "CF1 строки 122, 125", title: "Ставка кредита доходит до 465% годовых", effect: "Покрытие долга эскроу отрицательное, потому что проценты записаны со знаком минус.", fix: "Ставка между льготной и базовой.", keys: ["LEGACY.FIN_RATE"], formulas: ["F.ESC.COVERAGE", "F.FIN.RATE"] },
  { id: "AUDIT.22", label: "22", group: "distorts", tab: "cf", where: "CF1 строки 108, 113", title: "При раскрытии эскроу проценты попадают в поток как поступление", effect: "+14,38 млрд ₽ денег проекта вместо расхода.", fix: "Уплаченные проценты уменьшают деньги проекта.", keys: ["LEGACY.FIN_PIK_SIGN"], formulas: ["F.FIN.REPAYMENT"] },
  { id: "AUDIT.23", label: "23", group: "distorts", tab: "cf", where: "CF1 строка 111, Бюджет!F67", title: "Комиссия за выдачу считается от суммы, куда входят участок и налоги", effect: "Лимит кредита и комиссия завышены.", fix: "Лимит — бюджет без собственного участия.", keys: ["LEGACY.FIN_FEE_BASE"], formulas: ["F.FIN.LIMIT", "F.FIN.FEES"] },

  // ---------- Раздел 2. Методические недочёты ----------
  { id: "AUDIT.M1", label: "М1", group: "method", tab: "budget", where: "Бюджет!D17:D49", title: "Суммы бюджета вбиты числами, расценка получается обратным делением", effect: "Нельзя проверить ни ставку, ни объём. Техзаказчик считается от выручки (E43), СМР — от продаваемой площади (E32).", fix: "Статья бюджета — объём × ставка с источником.", keys: ["LEGACY.MARKETING_F51"], formulas: ["F.CAPEX.ITEM_TOTAL"] },
  { id: "AUDIT.M2", label: "М2", group: "method", tab: "budget", where: "Бюджет", title: "Нет индексации затрат, хотя стройка идёт около 6 лет", effect: "", fix: "Затраты индексируются по годам.", keys: [], formulas: ["F.CAPEX.INDEX"] },
  { id: "AUDIT.M3", label: "М3", group: "method", tab: "sales", where: "План продаж", title: "Цена растёт на 2% в квартал всё время, средние цены — простое среднее", effect: "Рост цены не связан с готовностью и рынком.", fix: "Рост цен по рынку и стадии готовности, средние цены — средневзвешенные.", keys: [], formulas: ["F.SALES.PRICE", "F.SALES.WAVG_PRICE"] },
  { id: "AUDIT.M4", label: "М4", group: "method", tab: "cf", where: "CF1!D115", title: "Базовая ставка кредита 20% зафиксирована при ключевой 14,25%", effect: "Сценарий ставки ЦБ не влияет на проект. На 11.09.2026 ключевая ставка — 14,00%.", fix: "Ставка = ключевая по годам + надбавка банка.", keys: [], formulas: ["F.FIN.RATE"] },
  { id: "AUDIT.M5", label: "М5", group: "method", tab: "dashboard", where: "Dashboard", title: "Ставка дисконтирования 25% задана одной цифрой", effect: "Нет безрисковой ставки и премии за риск.", fix: "Ставка из безрисковой ставки и премии (этап 6).", keys: [], formulas: ["F.KPI.DISCOUNT_RATE"] },
  { id: "AUDIT.M6", label: "М6", group: "method", tab: "escrow", where: "CF1", title: "Три очереди считаются как одна: один счёт эскроу, одна дата раскрытия", effect: "", fix: "Эскроу и раскрытие по каждой очереди.", keys: [], formulas: ["F.ESC.BALANCE", "F.TIME.FLAG_ESCROW_RELEASE"] },
  { id: "AUDIT.M7", label: "М7", group: "method", tab: "escrow", where: "Эскроу!I1", title: "Лист «Эскроу» не связан с CF1: 1 008 строк, #REF! в I1, структура оплат 0,7 + 0,1 + 0 ≠ 1", effect: "", fix: "Структура оплат в сумме даёт 100%.", keys: [], formulas: ["F.SALES.CASH_IN"] },
  { id: "AUDIT.M8", label: "М8", group: "method", tab: "tep", where: "ТЭПы, Бюджет, План продаж", title: "Одни и те же значения введены в нескольких местах", effect: "Ставки НДС введены 3 раза, налог на прибыль, площади и темпы продаж — по 2 раза.", fix: "Каждое значение вводится один раз.", keys: [], formulas: [] },
  { id: "AUDIT.M9", label: "М9", group: "method", tab: "cf", where: "CF1", title: "CF1 отформатирован до столбца XFD (16 373 столбца)", effect: "Файл тяжёлый.", fix: "В сервис не переносится.", keys: [], formulas: [] },
  { id: "AUDIT.M10", label: "М10", group: "method", tab: "budget", where: "Именованные диапазоны", title: "Development_fee, Непредвиденные, Технический_заказчик и Управление_базовое ссылаются на внешний файл [1]Инвестиции", effect: "Связь с файлом потеряна, ставки не проверить.", fix: "Ставки заданы в проекте или в справочнике компании.", keys: [], formulas: ["F.CAPEX.ITEM_TOTAL"] },
  { id: "AUDIT.M11", label: "М11", group: "method", tab: "cf", where: "CF1!D128", title: "Полная стоимость кредита не считается (#NUM!)", effect: "Цена кредита в отчёте не видна.", fix: "Полная стоимость кредита — годовая ставка с учётом комиссий.", keys: ["LEGACY.FIN_EFF_RATE"], formulas: ["F.FIN.EFFECTIVE_RATE"] },

  // ---------- Раздел 3. Уточнить у автора файла ----------
  { id: "AUDIT.Q1", label: "В1", group: "author", tab: "tep", where: "ТЭПы!C35", title: "Продаваемая площадь 149 281 м² без расшифровки", effect: "Квартиры и коммерция дают 153 882 м². В расчёте «как в исходном Excel» число нужно только для перевода сумм бюджета в ставки на м².", fix: "Продаваемая площадь — сумма по продуктам.", question: "Что входит в 149 281 м²?", keys: [], formulas: ["F.TEP.SALEABLE_AREA"] },
  { id: "AUDIT.Q2", label: "В2", group: "author", tab: "tep", where: "ТЭПы!C48", title: "Площадь 10 332 м² не совпадает с ТЭП", effect: "На 10 м² больше площади ПСН (10 322 м², ТЭПы!C23). Вероятно, значение из модели Финляндского ЖК.", fix: "В расчёте сервиса не используется.", question: "Откуда 10 332 м² и нужно ли это значение?", keys: [], formulas: [] },
  { id: "AUDIT.Q3", label: "В3", group: "author", tab: "tep", where: "ТЭПы!C49", title: "Площадь 5 200 м² не совпадает с ТЭП", effect: "Ровно 127 машино-мест × 40,945 м², а в файле 862 машино-места (ТЭПы!C27). Участвует только в План продаж!D16. Вероятно, значение из модели Финляндского ЖК.", fix: "В расчёте сервиса не используется.", question: "Откуда 5 200 м² и нужно ли это значение?", keys: [], formulas: [] },
  { id: "AUDIT.Q4", label: "В4", group: "author", tab: "sales", where: "План продаж", title: "Цена машино-места 11,06 млн ₽ за место", effect: "270 000 ₽/м² × 40,945 м². Выручка по машино-местам 13,6 млрд ₽ — 11,5% выручки проекта.", fix: "Цена машино-места задаётся в рублях за место по аналогам.", question: "Подтверждаете цену машино-места 11,06 млн ₽?", keys: [], formulas: ["F.SALES.PRICE"] },
];

const AUDITS: Record<string, AuditItem[]> = { derbenevskaya_legacy: DERBENEVSKAYA };

/** Пункты аудита исходного Excel проекта; пусто — аудита для этого файла нет. */
export const auditItems = (caseId: string | undefined): AuditItem[] => (caseId ? (AUDITS[caseId] ?? []) : []);
