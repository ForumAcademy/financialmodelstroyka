"use client";

import * as fmt from "@/lib/format";
import { isYearSeries } from "@/lib/humanize";

/** Подписи колонок справочных таблиц и полей составных значений (ключи — как в data/parameters.yaml). */
const LABEL: Record<string, string> = {
  product: "Продукт",
  channel: "Канал продаж",
  taxable: "Облагается НДС",
  basis: "Основание",
  band: "Группа высотности",
  floors_min: "Этажей от",
  floors_max: "Этажей до",
  height_max_m: "Высота до, м",
  date: "Дата",
  event: "Событие",
  source_id: "Источник",
  current: "Текущее значение",
  as_of: "На дату",
};

const label = (k: string) => LABEL[k] ?? k;
const cell = (v: unknown) => (typeof v === "string" ? fmt.value(v.replace(/_/g, " ")) : fmt.value(v));

type Row = Record<string, unknown>;

const isRecord = (v: unknown): v is Row => !!v && typeof v === "object" && !Array.isArray(v) && !("toFixed" in (v as object));

/** Составное значение параметра (таблица, ряд, объект) — в читаемом виде, а не «таблица, N строк». */
export function DataView({ value }: { value: unknown }) {
  if (isYearSeries(value)) {
    // Прогноз по годам: год → рост за год; после последнего года — последнее значение
    const years = Object.keys(value.by_year).sort();
    const last = years.at(-1);
    return (
      <>
        <table className="sheet data-view">
          <thead>
            <tr>
              <th>Год</th>
              <th className="num">Рост за год</th>
            </tr>
          </thead>
          <tbody>
            {years.map((y) => (
              <tr key={y}>
                <td>{y}</td>
                <td className="num">{fmt.share(value.by_year[y] as number)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {last && value.after_last === "last" ? (
          <p className="small muted">После {last} года — {fmt.share(value.by_year[last] as number)} в год, как в последнем году прогноза.</p>
        ) : null}
      </>
    );
  }
  if (Array.isArray(value) && value.length && value.every(isRecord)) {
    const rows = value as Row[];
    const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    return (
      <div className="hscroll">
        <table className="sheet data-view">
          <thead>
            <tr>
              {keys.map((k) => (
                <th key={k}>{label(k)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {keys.map((k) => (
                  <td key={k}>{cell(r[k])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (isRecord(value)) {
    return (
      <dl className="data-kv">
        {Object.entries(value as Row).map(([k, v]) => (
          <div key={k}>
            <dt>{label(k)}</dt>
            <dd>{cell(v)}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return <span>{fmt.value(value ?? null)}</span>;
}

/** Короткая подпись составного значения для поля ввода. */
export function compositeSummary(value: unknown): string | null {
  if (isYearSeries(value)) {
    const years = Object.keys(value.by_year).sort();
    return `Прогноз по годам: ${years[0]}–${years.at(-1)}`;
  }
  if (Array.isArray(value) && value.length && value.every(isRecord)) return `Таблица · ${value.length} ${fmt.plural(value.length, ["строка", "строки", "строк"])}`;
  if (isRecord(value)) {
    const n = Object.keys(value).length;
    return `${n} ${fmt.plural(n, ["значение", "значения", "значений"])}`;
  }
  return null;
}
