"use client";

import Link from "next/link";
import { useState } from "react";
import { getParameter } from "@fm/spec";
import { assumptionValueText, diffVersions, latest, versionOf } from "@/lib/assumptions";
import { useStore } from "@/lib/store";
import type { DemoProject } from "@/lib/types";

/**
 * «Справочник допущений обновлён»: что изменилось в значениях, которые проект берёт из справочника, и кнопка
 * «Обновить». Без нажатия проект считается по своей версии справочника.
 */
export function AssumptionsUpdate({ project }: { project: DemoProject }) {
  const { assumptions, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const last = latest(assumptions);
  const mine = versionOf(assumptions, project.assumptionsVersion);
  if (!mine || mine.version >= last.version) return null;
  const own = (id: string) => project.input.values[id as keyof typeof project.input.values] != null;
  const diff = diffVersions(mine, last).filter((d) => d.valueChanged && !own(d.param));
  const statusOnly = diffVersions(mine, last).filter((d) => !d.valueChanged).length;
  return (
    <div className="assumptions-update">
      <b>Справочник допущений обновлён до версии {last.version}</b> (проект посчитан по версии {mine.version}).{" "}
      {diff.length
        ? `Изменились значения, которые использует проект: ${diff.length}.`
        : `Значения, которые использует проект, не изменились${statusOnly ? "; поменялись статусы проверки или «Откуда»" : ""}.`}{" "}
      <button className="linklike" onClick={() => setOpen(!open)}>
        {open ? "Скрыть" : "Что изменится"}
      </button>
      {open ? (
        <ul className="small">
          {diff.map((d) => (
            <li key={d.param}>
              {getParameter(d.param).name}: {assumptionValueText(d.param, d.before?.value)} → {assumptionValueText(d.param, d.after?.value)}
            </li>
          ))}
          {diff.length === 0 ? <li>Числа расчёта не изменятся.</li> : null}
          <li>
            <Link href="/assumptions">История справочника</Link>
          </li>
        </ul>
      ) : null}
      <div>
        <button className="btn small primary" onClick={() => dispatch({ type: "assumptionsVersion", id: project.id, version: last.version })}>
          Обновить до версии {last.version}
        </button>
      </div>
    </div>
  );
}
