"use client";

import { useState, type ReactNode } from "react";
import { getParameter, type ParameterId } from "@fm/spec";
import { compositeSummary } from "./DataView";
import { useStore } from "@/lib/store";
import type { DemoProject, ValueChange } from "@/lib/types";
import { whence } from "@/lib/whence";
import * as fmt from "@/lib/format";

const AUTHOR_KEY = "fm.author";

function savedAuthor(): string {
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

/** Значок «нет ссылки»: у значения нет ссылки на документ, есть только текст «Откуда». */
export function NoLink({ project, id }: { project: DemoProject | null; id: ParameterId }) {
  const w = whence(id, project);
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
  const [proposed, setProposed] = useState<{ value: unknown } | null>(null);
  const commit = (value: unknown) => {
    if (JSON.stringify(value ?? null) === JSON.stringify(current ?? null)) return;
    if (isEmpty(current) && !project.changes?.[id]) dispatch({ type: "value", id: project.id, param: id, value });
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
