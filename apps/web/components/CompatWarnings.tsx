"use client";

import type { CalcMessage } from "@fm/engine";
import { useHow } from "./HowPanel";

/** Вкладка, на которой видно расхождение: по модулю формулы. */
export function tabOf(m: CalcMessage): "sales" | "budget" | "escrow" | "tep" {
  if (m.formulaId.startsWith("F.SALES.")) return "sales";
  if (m.formulaId.startsWith("F.CAPEX.")) return "budget";
  if (m.formulaId.startsWith("F.ESC.") || m.formulaId === "F.TIME.FLAG_ESCROW_RELEASE") return "escrow";
  return "tep";
}

const TAB_LABEL = { sales: "План продаж", budget: "Бюджет", escrow: "Эскроу", tep: "ТЭП" } as const;

/**
 * Режим совместимости повторяет исходный Excel один в один, вместе с его ошибками (решение владельца продукта
 * 27.09.2026). Здесь — список этих мест: что в исходнике не сходится и на какой вкладке это видно.
 */
export function CompatWarnings({ warnings, go }: { warnings: CalcMessage[]; go: (tab: "sales" | "budget" | "escrow" | "tep") => void }) {
  const { open } = useHow();
  if (warnings.length === 0) return null;
  return (
    <details className="compat-warnings">
      <summary>
        Режим совместимости с исходным Excel: расчёт повторяет файл один в один, включая {warnings.length} мест, где в файле что-то не сходится
      </summary>
      <p className="small muted">В обычном режиме эти места исправлены. Каждое расхождение станет вопросом к авторам файла.</p>
      <ol>
        {warnings.map((w) => (
          <li key={w.key}>
            {w.text}{" "}
            <button className="linklike" onClick={() => go(tabOf(w))}>
              {TAB_LABEL[tabOf(w)]}
            </button>{" "}
            <button className="linklike" onClick={() => open({ kind: "formula", id: w.formulaId })}>
              как посчитано
            </button>
          </li>
        ))}
      </ol>
    </details>
  );
}
