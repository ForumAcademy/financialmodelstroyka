"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { spec } from "@fm/spec";
import { latest } from "@/lib/assumptions";
import * as fmt from "@/lib/format";
import { sourceStatus } from "@/lib/sources";
import { useStore } from "@/lib/store";
import { NavLayout, type NavEntry } from "./ProjectNav";

export type RefSection = "values" | "formulas" | "sources" | "history";

const HREF: Record<RefSection, string> = { values: "/assumptions", formulas: "/formulas", sources: "/sources", history: "/assumptions/history" };

/** Справочник в том же каркасе, что и проект: шапка-карточка, меню слева, рабочая область справа. */
export function ReferenceShell({ active, children }: { active: RefSection; children: ReactNode }) {
  const { assumptions, sourceChecks } = useStore();
  const router = useRouter();
  const current = latest(assumptions);
  const noValue = current.items.filter((i) => i.value === null || i.value === undefined).length;
  const recheck = spec.sources.filter((s) => s.scope === "global" && sourceStatus(s, sourceChecks[s.id]).issue).length;
  const entries: NavEntry[] = [
    { item: { id: "values", mark: "≡", title: "Стандартные значения", status: noValue ? `нет ${noValue}` : "✓", tone: noValue ? "need" : "done", icon: "≡", short: "Значения" } },
    { item: { id: "formulas", mark: "ƒ", title: "Формулы", icon: "ƒ", short: "Формулы" } },
    { item: { id: "sources", mark: "§", title: "Источники", status: recheck ? String(recheck) : undefined, tone: recheck ? "bad" : undefined, icon: "§", short: "Источники" } },
    { item: { id: "history", mark: "↺", title: "История версий", status: `v${current.version}`, icon: "↺", short: "История" } },
  ];
  return (
    <div className="shell">
      <header className="card-head">
        <h1>Справочник</h1>
        <span className="meta">
          общий для всех проектов · версия {current.version} от {fmt.date(current.date)}
        </span>
        <span className="sp" />
        {noValue ? (
          <button className="chip warn" onClick={() => router.push(HREF.values)}>
            Нужно значение: {noValue}
          </button>
        ) : null}
        {recheck ? (
          <button className="chip bad" onClick={() => router.push(HREF.sources)}>
            Перепроверить источники: {recheck}
          </button>
        ) : null}
      </header>
      <NavLayout entries={entries} active={active} go={(id) => router.push(HREF[id as RefSection])}>
        {children}
      </NavLayout>
    </div>
  );
}
