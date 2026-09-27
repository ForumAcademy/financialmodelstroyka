"use client";

import type { CalcMessage } from "@fm/engine";
import { useHow } from "./HowPanel";

type Tab = "sales" | "budget" | "escrow" | "cf" | "tep";

/** Вкладка, на которой видно расхождение: по модулю формулы. */
export function tabOf(m: CalcMessage): Tab {
  if (m.formulaId.startsWith("F.SALES.")) return "sales";
  if (m.formulaId.startsWith("F.CAPEX.")) return "budget";
  if (m.formulaId.startsWith("F.ESC.") || m.formulaId === "F.TIME.FLAG_ESCROW_RELEASE") return "escrow";
  return "tep";
}

const TAB_LABEL: Record<Tab, string> = { sales: "План продаж", budget: "Бюджет", escrow: "Эскроу", cf: "CF", tep: "ТЭП" };

/** Направления списка расхождений: где в исходнике не сходится. */
export const DIRECTIONS = [
  { id: "sales", title: "Продажи", tab: "sales" },
  { id: "budget", title: "Бюджет", tab: "budget" },
  { id: "cf", title: "Денежный поток", tab: "cf" },
  { id: "escrow", title: "Эскроу", tab: "escrow" },
  { id: "fin", title: "Финансирование", tab: "cf" },
] as const;
export type Direction = (typeof DIRECTIONS)[number]["id"];

/**
 * Направление по ключу предупреждения. В денежный поток — всё, что меняет только CF, а не бюджет:
 * графики статей, сдвиг маркетинга и брокериджа, обрезка поступлений.
 */
export function directionOf(m: CalcMessage): Direction {
  const key = m.key ?? "";
  if (key.startsWith("CAPEX.SCHEDULE_SUM:") || key === "LEGACY.CF1_LAG" || key === "SALES.CASH_IN_CUT") return "cf";
  if (key === "LEGACY.ESCROW_DATE" || m.formulaId.startsWith("F.ESC.")) return "escrow";
  if (m.formulaId.startsWith("F.FIN.")) return "fin";
  if (m.formulaId.startsWith("F.SALES.")) return "sales";
  return "budget";
}

/** Строка над вкладками в режиме совместимости: сколько расхождений и где их список. */
export function CompatBanner({ count, open }: { count: number; open: () => void }) {
  if (count === 0) return null;
  return (
    <div className="compat-warnings">
      Режим совместимости с исходным Excel: расчёт повторяет файл один в один, включая {count} мест, где в файле что-то не сходится.{" "}
      <button className="linklike" onClick={open}>
        Открыть список
      </button>
    </div>
  );
}

/**
 * Вкладка «Расхождения с Excel». Режим совместимости повторяет исходный Excel один в один, вместе с его ошибками
 * (решение владельца продукта 27.09.2026); здесь — эти места по направлениям. В обычном режиме они исправлены.
 */
export function DiscrepanciesTab({ warnings, legacy, go }: { warnings: CalcMessage[]; legacy: boolean; go: (tab: Tab) => void }) {
  const { open } = useHow();
  if (!legacy) return <p className="muted">Расхождения с исходным Excel показываются для проектов в режиме совместимости.</p>;
  let n = 0;
  return (
    <div className="discrepancies">
      <p className="small muted">
        Места, где исходный Excel не сходится сам с собой. Режим совместимости повторяет их как есть, в обычном режиме они исправлены. Каждое станет вопросом к авторам файла.
      </p>
      {DIRECTIONS.map((d) => {
        const list = warnings.filter((w) => directionOf(w) === d.id);
        return (
          <section key={d.id}>
            <h2>
              {d.title} <span className="muted small">{list.length ? list.length : "расхождений нет"}</span>
            </h2>
            {list.length ? (
              <table className="grid discrepancy-table">
                <thead>
                  <tr>
                    <th>№</th>
                    <th>Что не сходится</th>
                    <th>Где видно</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((w) => (
                    <tr key={w.key}>
                      <td>{++n}</td>
                      <td>{w.text}</td>
                      <td className="nowrap">
                        <button className="linklike" onClick={() => go(tabOf(w))}>
                          {TAB_LABEL[tabOf(w)]}
                        </button>
                        <br />
                        <button className="linklike" onClick={() => open({ kind: "formula", id: w.formulaId })}>
                          как посчитано
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
