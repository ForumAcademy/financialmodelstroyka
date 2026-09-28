"use client";

import { getParameter } from "@fm/spec";
import { assumptionValueText, diffVersions, STATUS_LABEL, statusText, versionOf, type AssumptionVersion } from "@/lib/assumptions";
import * as fmt from "@/lib/format";

/** История версий справочника: версия, дата, кто, что изменилось. */
export function History({ versions }: { versions: AssumptionVersion[] }) {
  return (
    <ul className="version-list">
      {[...versions].reverse().map((v) => {
        const prev = versionOf(versions, v.version - 1);
        const diff = prev ? diffVersions(prev, v) : [];
        return (
          <li key={v.version}>
            <b>Версия {v.version}</b> · {fmt.date(v.date)} · {v.author}
            <div>{v.note}</div>
            {diff.length ? (
              <ul className="small">
                {diff.map((d) => (
                  <li key={d.param}>
                    {getParameter(d.param).name}:{" "}
                    {d.valueChanged ? `${assumptionValueText(d.param, d.before?.value)} → ${assumptionValueText(d.param, d.after?.value)}` : null}
                    {d.before?.status !== d.after?.status && d.after ? `${d.valueChanged ? "; " : ""}${d.before ? statusText(d.before) : STATUS_LABEL.unverified} → ${statusText(d.after)}` : null}
                    {!d.valueChanged && d.before?.status === d.after?.status ? "изменено «Откуда»" : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
