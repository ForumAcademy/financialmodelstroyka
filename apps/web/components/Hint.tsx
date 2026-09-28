"use client";

import { useState, type ReactNode } from "react";

/**
 * Подсказка «?»: на экране — только значок, полный текст — по наведению и по клику (правило владельца продукта
 * 28.09.2026: не больше одной строки пояснения на блок, остальное — в подсказку).
 */
export function Hint({ text, children }: { text: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="hint">
      <button type="button" className="hint-q" title={text} aria-label="Пояснение" aria-expanded={open} onClick={(e) => (e.stopPropagation(), setOpen(!open))}>
        ?
      </button>
      {open ? (
        <span className="hint-pop" role="note">
          {children ?? text}
        </span>
      ) : null}
    </span>
  );
}
