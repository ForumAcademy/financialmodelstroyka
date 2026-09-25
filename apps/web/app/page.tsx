import { ENGINE_MODULES } from "@fm/engine";
import Link from "next/link";
import { SPEC_FILES, spec } from "@fm/spec";

const SPEC_COUNTS = [
  { file: "sources.yaml", label: "источников", count: spec.sources.length },
  { file: "parameters.yaml", label: "параметров", count: spec.parameters.length },
  { file: "capex_items.yaml", label: "статей бюджета", count: spec.capexItems.length },
  { file: "regions.yaml", label: "регионов", count: spec.regions.length },
  { file: "formulas.yaml", label: "формул", count: spec.formulas.length },
] as const satisfies ReadonlyArray<{ file: (typeof SPEC_FILES)[number]; label: string; count: number }>;

const formatDate = (iso: string) => iso.split("-").reverse().join(".");

export default function HomePage() {
  return (
    <main className="page">
      <h1>Финансовая модель девелопера</h1>
      <p className="lead">
        Этап 2: расчётное ядро считает время, ТЭП и участок. Расчётов пока нет: список проектов, ввод данных и дашборд появятся на
        следующих этапах.
      </p>

      <p>
        <Link href="/demo/derbenevskaya">Дербеневская (демо): ТЭП →</Link>
      </p>

      <section>
        <h2>Справочник — единственный источник правды</h2>
        <p className="lead">
          Версия справочника <code>{spec.specVersion}</code>
          {spec.actualizedAt ? <>, актуализирован {formatDate(spec.actualizedAt)}</> : null}.
        </p>
        <ul>
          {SPEC_COUNTS.map((c) => (
            <li key={c.file}>
              <code>data/{c.file}</code> — {c.count} {c.label}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Модули расчётного ядра</h2>
        <table>
          <thead>
            <tr>
              <th>Модуль</th>
              <th>Что считает</th>
              <th>Этап</th>
            </tr>
          </thead>
          <tbody>
            {ENGINE_MODULES.map((m) => (
              <tr key={m.id}>
                <td>
                  <code>{m.id}</code>
                </td>
                <td>{m.title}</td>
                <td>{m.stage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
