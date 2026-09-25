import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Link from "next/link";
import { parse } from "yaml";
import Decimal from "decimal.js";
import { calculate, legacyCaseInput, type LegacyCase } from "@fm/engine";
import { getFormula, getParameter, getSource, type FormulaId, type SourceId } from "@fm/spec";

export const metadata = { title: "Дербеневская (демо) — ТЭП" };

const CASE_FILE = resolve(process.cwd(), "../../tests/cases/derbenevskaya_legacy.yaml");

const ROWS: { id: FormulaId; label: string; pick?: string }[] = [
  { id: "F.TEP.GFA_ABOVE", label: "ГНС наземной части" },
  { id: "F.TEP.GFA_BELOW", label: "Площадь подземной части" },
  { id: "F.TEP.GFA_TOTAL", label: "ГНС общая" },
  { id: "F.TEP.APT_TYPE_AREA", label: "Площадь квартир по типам" },
  { id: "F.TEP.COMM_AREA", label: "Площадь ПСН" },
  { id: "F.TEP.SALEABLE_AREA", label: "Продаваемая площадь" },
  { id: "F.TEP.PARKING_REQUIRED", label: "Машино-мест по нормативу (нормы исходника)" },
  { id: "F.TEP.PARKING_COUNT", label: "Машино-мест в модели" },
  { id: "F.TEP.LANDSCAPE_AREA", label: "Площадь благоустройства", pick: "landscape" },
];

const RU = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 3 });

function show(value: unknown, pick?: string): string {
  if (pick && value && typeof value === "object") return show((value as Record<string, unknown>)[pick]);
  if (Array.isArray(value)) return value.map((v) => show(v)).join(" · ");
  if (value instanceof Decimal) return RU.format(value.toNumber());
  return String(value);
}

function SourceLinks({ ids }: { ids: SourceId[] }) {
  return (
    <>
      {ids.map((id, i) => {
        const s = getSource(id);
        return (
          <span key={id}>
            {i > 0 ? ", " : ""}
            {s.url ? (
              <a href={s.url} target="_blank" rel="noreferrer" title={s.title}>
                {id}
              </a>
            ) : (
              <span title={s.title}>{id}</span>
            )}
          </span>
        );
      })}
    </>
  );
}

export default function DerbenevskayaDemo() {
  const legacyCase = parse(readFileSync(CASE_FILE, "utf8")) as LegacyCase;
  const result = calculate(legacyCaseInput(legacyCase), {}, ROWS.map((r) => r.id).concat("F.TEP.APT_AREA_CHECK"));

  return (
    <main className="page">
      <p>
        <Link href="/">← На главную</Link>
      </p>
      <h1>Дербеневская (демо): ТЭП</h1>
      <p className="lead">
        Этап 2. Площади посчитаны расчётным ядром по формулам справочника в режиме совместимости с исходным Excel.
        Шкала времени и земельный налог появятся, когда вехи проекта будут введены датами (в исходнике они текстом).
      </p>

      <table>
        <thead>
          <tr>
            <th>Показатель</th>
            <th>Значение</th>
            <th>Формула</th>
            <th>Источники</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map(({ id, label, pick }) => {
            const node = result.formulas[id];
            const f = getFormula(id);
            return (
              <tr key={id}>
                <td>{label}</td>
                <td>
                  {node ? show(node.value, pick) : "—"} {f.unit === "м2" ? "м²" : f.unit}
                </td>
                <td title={f.expr}>
                  <code>{id}</code>
                </td>
                <td>
                  <SourceLinks ids={f.source_ids} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h2>Сообщения расчёта</h2>
      {result.messages.length === 0 ? (
        <p>Нет.</p>
      ) : (
        <ul>
          {result.messages.map((m, i) => (
            <li key={i}>
              <strong>{m.severity === "error" ? "Ошибка" : m.severity === "warning" ? "Предупреждение" : "Информация"}:</strong> {m.text}{" "}
              <small>
                (<code>{m.formulaId}</code>)
              </small>
            </li>
          ))}
        </ul>
      )}

      <h2>Исходные данные, использованные в расчёте</h2>
      <table>
        <thead>
          <tr>
            <th>Параметр</th>
            <th>Значение</th>
            <th>Откуда</th>
          </tr>
        </thead>
        <tbody>
          {Object.values(result.parameters).map((p) => (
            <tr key={p!.id}>
              <td>
                {getParameter(p!.id).name} <small><code>{p!.id}</code></small>
              </td>
              <td>{typeof p!.value === "object" ? "таблица" : String(p!.value)}</td>
              <td>{p!.origin === "project" ? "кейс исходника" : p!.origin === "region" ? "справочник регионов" : "справочник"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
