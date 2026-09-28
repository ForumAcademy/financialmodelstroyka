"use client";

import { History } from "@/components/AssumptionsHistory";
import { ReferenceShell } from "@/components/ReferenceShell";
import { useStore } from "@/lib/store";

export default function HistoryPage() {
  const { assumptions } = useStore();
  return (
    <ReferenceShell active="history">
      <div className="work-head">
        <h2>История версий</h2>
      </div>
      <History versions={assumptions} />
    </ReferenceShell>
  );
}
