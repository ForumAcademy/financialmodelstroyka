"use client";

import * as fmt from "@/lib/format";

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
  if (Array.isArray(value) && value.length && value.every(isRecord)) return `Таблица · ${value.length} ${fmt.plural(value.length, ["строка", "строки", "строк"])}`;
  if (isRecord(value)) {
    const n = Object.keys(value).length;
    return `${n} ${fmt.plural(n, ["значение", "значения", "значений"])}`;
  }
  return null;
}
