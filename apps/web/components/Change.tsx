"use client";

import { useState, type ReactNode } from "react";
import { getParameter, type ParameterId } from "@fm/spec";
import { compositeSummary } from "./DataView";
import { useStore } from "@/lib/store";
import type { DemoProject, ValueChange } from "@/lib/types";
import { whence } from "@/lib/whence";
import Link from "next/link";
import { confirmation, SOURCE_LABEL, standardKey, valueSource } from "@/lib/assumptions";
import * as fmt from "@/lib/format";
import { standardInUse } from "@/lib/standard";
import { useInDraft } from "./Draft";

const AUTHOR_KEY = "fm.author";

export function savedAuthor(): string {
  try {
    return localStorage.getItem(AUTHOR_KEY) ?? "";
  } catch {
    return "";
  }
}

const isEmpty = (v: unknown) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);

/** Значение для подсказки «было / стало»: число с единицей, дата, да/нет, таблица. */
export function valueText(id: ParameterId, v: unknown): string {
  if (isEmpty(v)) return "—";
  const p = getParameter(id);
  if (typeof v === "number") return `${fmt.inputNumber(v)} ${fmt.unit(p.unit)}`.trim();
  return compositeSummary(v) ?? fmt.value(v);
}

export function changeTitle(id: ParameterId, c: ValueChange): string {
  return [`Было: ${valueText(id, c.before)}`, `Стало: ${valueText(id, c.after)}`, `Кто: ${c.author}`, `Когда: ${fmt.date(c.at.slice(0, 10))}, ${c.at.slice(11, 16)}`, `Почему: ${c.why}`, c.url ? `Документ: ${c.url}` : ""]
    .filter(Boolean)
    .join("\n");
}

/** Пометка «изменено» с подсказкой и кнопкой «вернуть исходное». */
export function ChangedMark({ project, id }: { project: DemoProject; id: ParameterId }) {
  const { dispatch } = useStore();
  const c = project.changes?.[id];
  if (!c) return null;
  return (
    <span className="changed">
      <span className="changed-badge" title={changeTitle(id, c)}>
        изменено
      </span>
      <button className="link small" onClick={() => dispatch({ type: "revert", id: project.id, param: id })} title={`Вернуть ${valueText(id, c.before)}`}>
        вернуть исходное
      </button>
    </span>
  );
}

/**
 * Источник значения справочника допущений в проекте: «Стандарт компании» с кнопкой «Подтвердить» / «введено для
 * проекта» / «подтверждено финансистами». Подтверждение (кто, когда, комментарий) хранится в проекте.
 */
export function SourceMark({ project, id, inline = false }: { project: DemoProject; id: ParameterId; inline?: boolean }) {
  const { assumptions, dispatch } = useStore();
  const [confirming, setConfirming] = useState(false);
  const [comment, setComment] = useState("");
  const [author, setAuthor] = useState(savedAuthor);
  const source = valueSource(project, id, assumptions);
  // «Как в исходном Excel» берёт значения справочника из самого Excel — метка стандарта там не показывается
  if (!source || (project.input.mode === "legacy" && project.legacyCase)) return null;
  // стандарт, который в расчёте проекта не участвует (статьи бюджета заданы суммой), не требует подтверждения
  if (source === "standard" && !standardInUse(project, assumptions).includes(id)) return null;
  const c = source === "confirmed" ? confirmation(project, id) : null;
  if (source === "standard") {
    const w = whence(id, project, assumptions);
    const save = () => {
      if (!author.trim()) return;
      try {
        localStorage.setItem(AUTHOR_KEY, author.trim());
      } catch {
        /* имя автора — только удобство */
      }
      const event = { status: "done" as const, author: author.trim(), at: new Date().toISOString(), ...(comment.trim() ? { comment: comment.trim() } : {}) };
      dispatch({ type: "issue", id: project.id, key: standardKey(id), no: 0, question: `Стандарт компании: ${getParameter(id).name}`, event });
      setConfirming(false);
    };
    return (
      <span className="standard-mark">
        {inline ? null : (
          <span className={`source-badge source-${source}`} title={`${w.text}. Для проекта не подтверждено.`}>
            Стандарт компании
          </span>
        )}
        <button className="link small" onClick={() => setConfirming(true)} title="Подтвердить, что значение подходит этому проекту">
          {inline ? "Подтвердить для проекта" : "Подтвердить"}
        </button>
        {inline ? null : (
          <Link className="small" href="/assumptions" title="Открыть справочник допущений компании">
            справочник
          </Link>
        )}
        {confirming ? (
          <span className="issue-status-form">
            <textarea placeholder="Комментарий (необязательно)" value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
            {savedAuthor() ? null : <input placeholder="Ваше имя" value={author} onChange={(e) => setAuthor(e.target.value)} />}
            <span className="row-actions">
              <button className="btn small primary" disabled={!author.trim()} onClick={save}>
                Подтвердить
              </button>
              <button className="btn small" onClick={() => setConfirming(false)}>
                Отмена
              </button>
            </span>
          </span>
        ) : null}
      </span>
    );
  }
  if (inline) return source === "confirmed" && c ? <span className="small">Подтверждено для проекта: {c.author}, {fmt.date(c.at.slice(0, 10))}</span> : null;
  const title =
    source === "confirmed"
      ? `Стандарт компании, подтверждён для проекта${c ? `: ${c.author}, ${fmt.date(c.at.slice(0, 10))}${c.comment ? `. ${c.comment}` : ""}` : ""}`
      : "Значение введено для этого проекта";
  return (
    <span className={`source-badge source-${source}`} title={title}>
      {SOURCE_LABEL[source]}
    </span>
  );
}

/** Значок «нет ссылки»: у значения нет ссылки на документ, есть только текст «Откуда». */
export function NoLink({ project, id }: { project: DemoProject | null; id: ParameterId }) {
  const { assumptions } = useStore();
  const w = whence(id, project, assumptions);
  if (w.url) return null;
  return (
    <span className="nolink-badge" title={`Откуда: ${w.text}. Ссылки на документ нет.`}>
      нет ссылки
    </span>
  );
}

/**
 * Изменение значения, у которого уже есть значение: сначала комментарий «почему» (обязателен),
 * ссылка на документ (необязательна) и кто меняет. Пустое поле заполняется сразу, без комментария.
 */
export function useChange(project: DemoProject, id: ParameterId, current: unknown): { commit: (value: unknown) => void; form: ReactNode; pending: boolean } {
  const { dispatch } = useStore();
  const inDraft = useInDraft();
  const [proposed, setProposed] = useState<{ value: unknown } | null>(null);
  const commit = (value: unknown) => {
    if (JSON.stringify(value ?? null) === JSON.stringify(current ?? null)) return;
    if (isEmpty(current) && !project.changes?.[id]) dispatch({ type: "value", id: project.id, param: id, value });
    // в черновике вводных «почему» спрашивается один раз — в панели «Несохранённые изменения»
    else if (inDraft) dispatch({ type: "change", id: project.id, param: id, before: current, value, why: "", author: "" });
    else setProposed({ value });
  };
  const form = proposed ? (
    <ChangeForm
      id={id}
      before={current}
      after={proposed.value}
      onCancel={() => setProposed(null)}
      onSave={(why, url, author) => {
        dispatch({ type: "change", id: project.id, param: id, before: current, value: proposed.value, why, url, author });
        setProposed(null);
      }}
    />
  ) : null;
  return { commit, form, pending: proposed !== null };
}

function ChangeForm({ id, before, after, onSave, onCancel }: { id: ParameterId; before: unknown; after: unknown; onSave: (why: string, url: string, author: string) => void; onCancel: () => void }) {
  const [why, setWhy] = useState("");
  const [url, setUrl] = useState("");
  const [author, setAuthor] = useState(savedAuthor);
  const [error, setError] = useState("");
  const save = () => {
    if (!why.trim()) return setError("Напишите, почему меняете значение");
    if (!author.trim()) return setError("Укажите, кто меняет");
    if (url.trim() && !/^https?:\/\//.test(url.trim())) return setError("Ссылка должна начинаться с http:// или https://");
    try {
      localStorage.setItem(AUTHOR_KEY, author.trim());
    } catch {
      /* без сохранения имени */
    }
    onSave(why.trim(), url.trim(), author.trim());
  };
  return (
    <div className="change-form">
      <div className="small">
        Было: <strong>{valueText(id, before)}</strong> → станет: <strong>{valueText(id, after)}</strong>. Справочник не меняется — только этот проект.
      </div>
      <textarea autoFocus placeholder="Почему меняете (обязательно)" value={why} onChange={(e) => setWhy(e.target.value)} rows={2} />
      <input placeholder="Ссылка на документ (необязательно)" value={url} onChange={(e) => setUrl(e.target.value)} />
      <input placeholder="Кто меняет" value={author} onChange={(e) => setAuthor(e.target.value)} />
      <div className="change-actions">
        <button className="btn primary" onClick={save}>
          Сохранить
        </button>
        <button className="btn" onClick={onCancel}>
          Отмена
        </button>
        {error ? <span className="error small">{error}</span> : null}
      </div>
    </div>
  );
}
