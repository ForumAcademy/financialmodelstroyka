"use client";

import { useState } from "react";
import { getParameter, type ParameterId } from "@fm/spec";
import { useStore } from "@/lib/store";
import type { DemoProject, ProjectSource } from "@/lib/types";
import * as fmt from "@/lib/format";

/** Ввод значения параметра и проектного источника (уровень 4 — документ, 5 — экспертная оценка). */
export function SourceEditor({ project, param }: { project: DemoProject; param: ParameterId }) {
  const { projects, dispatch } = useStore();
  const current = projects.find((p) => p.id === project.id) ?? project;
  const p = getParameter(param);
  const src = current.sources[param] ?? null;
  const editableValue = ["scalar", "date", "enum", "bool", "text"].includes(p.kind);
  const raw = current.input.values[param];
  const [value, setValue] = useState(raw === undefined || raw === null ? "" : String(raw));
  const [form, setForm] = useState<ProjectSource>(src ?? { level: 4, title: "", url: "", author: "", date: new Date().toISOString().slice(0, 10) });
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");

  const saveValue = () => {
    const v = value.trim() === "" ? null : p.kind === "scalar" ? Number(value.replace(",", ".")) : p.kind === "bool" ? value === "true" : value;
    if (p.kind === "scalar" && v !== null && Number.isNaN(v)) return setError("Введите число");
    setError("");
    dispatch({ type: "value", id: current.id, param, value: v });
  };
  const saveSource = () => {
    if (!form.title.trim() || !form.author.trim()) return setError("Укажите документ и автора");
    if (form.level === 5 && (!form.rationale?.trim() || !form.min?.trim() || !form.max?.trim())) {
      return setError("Для экспертной оценки обязательны обоснование и диапазон min–max");
    }
    setError("");
    dispatch({ type: "source", id: current.id, param, source: form });
    setEditing(false);
  };

  return (
    <div className="editor">
      {editableValue ? (
        <div className="row">
          <label className="small muted">Значение</label>
          {p.kind === "enum" && p.options ? (
            <select value={value} onChange={(e) => setValue(e.target.value)}>
              <option value="">—</option>
              {p.options.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          ) : p.kind === "bool" ? (
            <select value={value} onChange={(e) => setValue(e.target.value)}>
              <option value="">—</option>
              <option value="true">да</option>
              <option value="false">нет</option>
            </select>
          ) : (
            <input type={p.kind === "date" ? "date" : "text"} value={value} onChange={(e) => setValue(e.target.value)} />
          )}
          <button className="btn" onClick={saveValue}>
            Сохранить
          </button>
        </div>
      ) : (
        <p className="small muted">Таблица редактируется в мастере ввода (этап 8).</p>
      )}
      <div className="src-box">
        <div className="small muted">Проектный источник</div>
        {src && !editing ? (
          <div>
            <span className={`lvl lvl${src.level}`}>{src.level}</span> {src.url ? <a href={src.url} target="_blank" rel="noreferrer">{src.title}</a> : src.title}
            <div className="small muted">
              {src.author} · {fmt.date(src.date)}
              {src.level === 5 ? ` · диапазон ${src.min}–${src.max}` : ""}
            </div>
            <button className="link small" onClick={() => setEditing(true)}>
              изменить
            </button>{" "}
            <button className="link small" onClick={() => dispatch({ type: "source", id: current.id, param, source: null })}>
              убрать
            </button>
          </div>
        ) : editing ? (
          <div className="form">
            <select value={form.level} onChange={(e) => setForm({ ...form, level: Number(e.target.value) as 4 | 5 })}>
              <option value={4}>4 — документ проекта / компании</option>
              <option value={5}>5 — экспертная оценка</option>
            </select>
            <input placeholder="Документ (ГПЗУ, ТЭП, договор…)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <input placeholder="Ссылка на документ (СЭД, облако)" value={form.url ?? ""} onChange={(e) => setForm({ ...form, url: e.target.value })} />
            <input placeholder="Автор" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            {form.level === 5 ? (
              <>
                <input placeholder="Обоснование" value={form.rationale ?? ""} onChange={(e) => setForm({ ...form, rationale: e.target.value })} />
                <div className="row">
                  <input placeholder="min" value={form.min ?? ""} onChange={(e) => setForm({ ...form, min: e.target.value })} />
                  <input placeholder="max" value={form.max ?? ""} onChange={(e) => setForm({ ...form, max: e.target.value })} />
                </div>
              </>
            ) : null}
            <div className="row">
              <button className="btn primary" onClick={saveSource}>
                Сохранить источник
              </button>
              <button className="btn" onClick={() => setEditing(false)}>
                Отмена
              </button>
            </div>
            <p className="small muted">Вложение файла (Vercel Blob) — этап 8.</p>
          </div>
        ) : (
          <button className="btn" onClick={() => setEditing(true)}>
            + Указать источник
          </button>
        )}
      </div>
      {error ? <p className="error small">{error}</p> : null}
    </div>
  );
}
