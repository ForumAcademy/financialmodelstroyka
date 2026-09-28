"use client";

import { useRef, useState } from "react";
import { getParameter, type ParameterId } from "@fm/spec";
import { savedAuthor } from "../Change";
import { useHow } from "../HowPanel";
import { DownloadSource, ImportReport, Modal } from "../NewProject";
import { useStore } from "@/lib/store";
import type { DemoProject, ProjectSource } from "@/lib/types";
import * as fmt from "@/lib/format";

const AUTHOR_KEY = "fm.author";
const KB = 1024;

function size(bytes: number): string {
  if (bytes < KB) return `${bytes} Б`;
  if (bytes < KB * KB) return `${fmt.num(bytes / KB, 0)} КБ`;
  return `${fmt.num(bytes / KB / KB, 1)} МБ`;
}

/**
 * Раздел «Документы» проекта (решение владельца продукта 27.09.2026): загруженные файлы становятся документами проекта
 * и появляются в списке «выбрать источник проекта» у каждого значения. До этапов 7–8 файлы хранятся в памяти браузера.
 */
export function DocumentsTab({ project }: { project: DemoProject }) {
  const { dispatch } = useStore();
  const { open } = useHow();
  const input = useRef<HTMLInputElement>(null);
  const [author, setAuthor] = useState(savedAuthor);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [report, setReport] = useState(false);

  const upload = (files: FileList | null) => {
    if (!files?.length) return;
    if (!author.trim()) {
      setError("Укажите, кто загружает документы");
      return;
    }
    setError("");
    try {
      localStorage.setItem(AUTHOR_KEY, author.trim());
    } catch {
      // без памяти браузера автор просто не запомнится
    }
    const date = new Date().toISOString().slice(0, 10);
    [...files].forEach((f, i) => {
      const source: ProjectSource = {
        id: `doc-${Date.now()}-${i}`,
        level: 4,
        title: f.name.replace(/\.[^.]+$/, ""),
        url: "",
        author: author.trim(),
        date,
        file: { name: f.name, size: f.size, type: f.type, url: URL.createObjectURL(f) },
      };
      dispatch({ type: "addSource", id: project.id, source });
    });
    if (input.current) input.current.value = "";
  };

  const usedBy = (sourceId: string) => (Object.entries(project.paramSources) as [ParameterId, string][]).filter(([, s]) => s === sourceId).map(([id]) => id);

  return (
    <section className="documents">
      <h2 className="part-title">Документы проекта</h2>
      <p className="small muted">
        Договор, ГПЗУ, ППТ, ТЭП архитектора, расчёты, term sheet банка. Загруженный документ появляется в списке «выбрать источник проекта» у любого значения
        (нажмите на название поля). Пока в демо файлы хранятся только до перезагрузки страницы; постоянное хранение появится вместе с базой проектов.
      </p>
      <div className="doc-upload">
        <input className="doc-author" placeholder="Кто загружает" value={author} onChange={(e) => setAuthor(e.target.value)} />
        <input ref={input} type="file" multiple hidden onChange={(e) => upload(e.target.files)} />
        <button className="btn primary" onClick={() => (author.trim() ? input.current?.click() : setError("Укажите, кто загружает документы"))}>
          + Загрузить файлы
        </button>
        {error ? <span className="warn small">{error}</span> : null}
      </div>
      {project.sources.length === 0 ? (
        <p className="muted">Документов пока нет.</p>
      ) : (
        <table className="sheet docs-table">
          <thead>
            <tr>
              <th>Документ</th>
              <th>Файл</th>
              <th>Кто, когда</th>
              <th>Подтверждает значения</th>
              <th className="col-del" />
            </tr>
          </thead>
          <tbody>
            {project.sources.map((s) => {
              const used = usedBy(s.id);
              return (
                <tr key={s.id}>
                  <td>
                    {editing === s.id ? (
                      <input
                        autoFocus
                        defaultValue={s.title}
                        onBlur={(e) => {
                          const t = e.target.value.trim();
                          if (t && t !== s.title) dispatch({ type: "renameSource", id: project.id, sourceId: s.id, title: t });
                          setEditing(null);
                        }}
                        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                      />
                    ) : (
                      <button className="link" title="Переименовать" onClick={() => setEditing(s.id)}>
                        {s.title}
                      </button>
                    )}
                    {s.level === 5 ? <span className="tag">экспертная оценка</span> : null}
                  </td>
                  <td>
                    {s.file ? (
                      <a href={s.file.url} download={s.file.name} target="_blank" rel="noreferrer">
                        {s.file.name}
                      </a>
                    ) : s.url ? (
                      <a href={s.url} target="_blank" rel="noreferrer">
                        ссылка
                      </a>
                    ) : (
                      <span className="muted">—</span>
                    )}
                    {s.file ? <span className="muted small"> · {size(s.file.size)}</span> : null}
                    {s.id === project.fileImport?.sourceId ? (
                      <div>
                        <button className="link small" onClick={() => setReport(true)}>
                          Что загружено из файла
                        </button>
                      </div>
                    ) : null}
                  </td>
                  <td className="small">
                    {s.author}, {fmt.date(s.date)}
                  </td>
                  <td className="small">
                    {used.length === 0 ? (
                      <span className="muted">пока ни одного</span>
                    ) : (
                      used.map((id, i) => (
                        <span key={id}>
                          {i ? ", " : ""}
                          <button className="link" onClick={() => open({ kind: "param", id })}>
                            {getParameter(id).name}
                          </button>
                        </span>
                      ))
                    )}
                  </td>
                  <td>
                    <button
                      className="icon"
                      aria-label="Удалить документ"
                      title={used.length ? "Удалить документ: значения, которые он подтверждал, станут непроверенными" : "Удалить документ"}
                      onClick={() => {
                        if (used.length && !window.confirm(`Документ подтверждает значений: ${used.length}. Удалить? Эти значения станут непроверенными.`)) return;
                        if (s.file) URL.revokeObjectURL(s.file.url);
                        dispatch({ type: "removeSource", id: project.id, sourceId: s.id });
                      }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {report && project.fileImport ? (
        <Modal
          title="Что загружено из файла"
          wide
          onClose={() => setReport(false)}
          foot={
            <>
              <DownloadSource project={project} />
              <button className="btn primary" onClick={() => setReport(false)}>
                Закрыть
              </button>
            </>
          }
        >
          <ImportReport report={project.fileImport} />
        </Modal>
      ) : null}
    </section>
  );
}
