"use client";

import Link from "next/link";
import { useState } from "react";
import { Breadcrumbs } from "@/components/AppShell";
import { attentionItems, KIND_LABEL, type AttentionKind } from "@/lib/attention";
import { useStore } from "@/lib/store";

export default function AttentionPage() {
  const { projects, model } = useStore();
  const [kind, setKind] = useState<AttentionKind | "">("");
  const items = attentionItems(projects, model);
  const list = items.filter((i) => !kind || i.kind === kind);
  return (
    <>
      <Breadcrumbs items={[{ label: "Требует внимания" }]} />
      <main className="page wide">
        <div className="page-head">
          <h1>Требует внимания</h1>
        </div>
        <div className="filters">
          <div className="filters-row">
            <select value={kind} onChange={(e) => setKind(e.target.value as AttentionKind | "")}>
              <option value="">Все типы</option>
              {(Object.keys(KIND_LABEL) as AttentionKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
            <span className="spacer" />
            <span className="small muted">
              Показано {list.length} из {items.length}
            </span>
          </div>
        </div>
        {list.length === 0 ? (
          <p className="muted">Всё в порядке.</p>
        ) : (
          <ul className="feed">
            {list.map((i, n) => (
              <li key={n} className={`feed-item k-${i.kind}`}>
                <span className="feed-kind">{KIND_LABEL[i.kind]}</span>
                <div>
                  <Link href={i.href}>{i.title}</Link>
                  <div className="small muted">
                    {i.projectName}
                    {i.detail ? ` · ${i.detail}` : ""}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="small muted">«Устаревшие аналоги» появятся вместе с бенчмарками (этап 11).</p>
      </main>
    </>
  );
}
