"use client";

import { useState } from "react";
import { fmtRub, type DataQuestion, type QuestionBlock } from "@fm/engine";
import { savedAuthor } from "./Change";
import { useHow } from "./HowPanel";
import { BLOCKS, impactSize, issueItems, type IssueItem } from "@/lib/issues";
import { exportIssues } from "@/lib/issues-export";
import { useStore } from "@/lib/store";
import { ISSUE_STATUS_LABEL, type DemoProject, type IssueStatus } from "@/lib/types";

type Tab = "sales" | "budget" | "escrow" | "cf" | "tep";

const TAB_OF_BLOCK: Record<QuestionBlock, Tab> = { sales: "sales", budget: "budget", cf: "cf", escrow: "escrow", fin: "cf" };
const TAB_LABEL: Record<Tab, string> = { sales: "План продаж", budget: "Бюджет", escrow: "Эскроу", cf: "CF", tep: "ТЭП" };
const AUTHOR_KEY = "fm.author";
const STATUSES: IssueStatus[] = ["open", "work", "done"];

const MODE_HINT = {
  normal: "Расчёт по исправленной методике: продажи не больше построенного, цена по рынку и готовности, налоги по НК РФ.",
  legacy: "Повторяет исходный файл вместе с его ошибками. Нужен для сверки с Excel.",
} as const;

/** Переключатель «Расчёт сервиса | Как в исходном Excel» для проекта из исходного Excel и строка подсказки под ним. */
export function ModeSwitch({ project }: { project: DemoProject }) {
  const { dispatch } = useStore();
  const mode = project.input.mode === "legacy" ? "legacy" : "normal";
  return (
    <div className="mode-switch">
      <div className="seg">
        <button className={mode === "normal" ? "on" : ""} onClick={() => dispatch({ type: "mode", id: project.id, mode: "normal" })}>
          Расчёт сервиса
        </button>
        <button className={mode === "legacy" ? "on" : ""} onClick={() => dispatch({ type: "mode", id: project.id, mode: "legacy" })}>
          Как в исходном Excel
        </button>
      </div>
      <div className="small muted">{MODE_HINT[mode]}</div>
    </div>
  );
}

/** Строка над вкладками в расчёте «как в исходном Excel»: сколько расхождений не решено и где их список. */
export function CompatBanner({ open, total, go }: { open: number; total: number; go: () => void }) {
  if (total === 0) return null;
  return (
    <div className="compat-warnings">
      Расчёт как в исходном Excel повторяет файл один в один. Не решено {open} из {total} расхождений.{" "}
      <button className="linklike" onClick={go}>
        Открыть список
      </button>
    </div>
  );
}

function Impact({ q }: { q: DataQuestion }) {
  const a = q.impact.amount;
  const timing = q.impact.kind === "сроки денег" || q.impact.kind === "зависит";
  return (
    <>
      {a && !a.isZero() ? <div className="impact-amount">{timing ? `~${fmtRub(a)}` : `${a.gt(0) ? "+" : "−"}${fmtRub(a)}`}</div> : null}
      {/* сумма уже над строкой — в пояснении остаётся, что меняется и в какую сторону */}
      <div className="small muted">{timing ? q.impact.text : q.impact.text.replace(/ на ~[^;]*₽/, "")}</div>
    </>
  );
}

function StatusCell({ project, item }: { project: DemoProject; item: IssueItem }) {
  const { dispatch } = useStore();
  const [pending, setPending] = useState<IssueStatus | null>(null);
  const [comment, setComment] = useState("");
  const [author, setAuthor] = useState(savedAuthor);
  const history = item.state?.history ?? [];
  const save = () => {
    if (!pending || !author.trim()) return;
    try {
      localStorage.setItem(AUTHOR_KEY, author.trim());
    } catch {
      /* имя автора — только удобство */
    }
    const event = { status: pending, author: author.trim(), at: new Date().toISOString(), ...(comment.trim() ? { comment: comment.trim() } : {}) };
    dispatch({ type: "issue", id: project.id, key: item.key, no: item.no, question: item.question, event });
    setPending(null);
    setComment("");
  };
  return (
    <div className="issue-status">
      <select className={`status-${pending ?? item.status}`} value={pending ?? item.status} onChange={(e) => setPending(e.target.value as IssueStatus)} aria-label="Статус">
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {ISSUE_STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      {pending && pending !== item.status ? (
        <div className="issue-status-form">
          <textarea placeholder="Комментарий (необязательно)" value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
          {savedAuthor() ? null : <input placeholder="Ваше имя" value={author} onChange={(e) => setAuthor(e.target.value)} />}
          <div className="row-actions">
            <button className="btn small primary" disabled={!author.trim()} onClick={save}>
              Сохранить
            </button>
            <button className="btn small" onClick={() => setPending(null)}>
              Отмена
            </button>
          </div>
        </div>
      ) : null}
      {history.length ? (
        <details className="issue-history">
          <summary>История ({history.length})</summary>
          <ul>
            {[...history].reverse().map((e, k) => (
              <li key={k}>
                <b>{ISSUE_STATUS_LABEL[e.status]}</b> · {e.author} · {new Date(e.at).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}
                {e.comment ? <div>{e.comment}</div> : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

/** Автоматическое пояснение пункта + ручные дополнения к нему (кто, когда) и подробности «почему так в файле». */
function Explanation({ project, item }: { project: DemoProject; item: IssueItem }) {
  const { dispatch } = useStore();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [author, setAuthor] = useState(savedAuthor);
  const notes = item.state?.notes ?? [];
  const save = () => {
    if (!text.trim() || !author.trim()) return;
    try {
      localStorage.setItem(AUTHOR_KEY, author.trim());
    } catch {
      /* имя автора — только удобство */
    }
    dispatch({ type: "issueNote", id: project.id, key: item.key, no: item.no, question: item.question, note: { text: text.trim(), author: author.trim(), at: new Date().toISOString() } });
    setText("");
    setAdding(false);
  };
  return (
    <>
      <div className="issue-question">{item.question}</div>
      {item.q ? (
        <p className="issue-summary">
          {item.q.compared} {item.q.threat}
        </p>
      ) : (
        <p className="muted">Не воспроизводится: после обновления исходника расхождение пропало. Статус сохранён.</p>
      )}
      {notes.length ? (
        <ul className="issue-notes">
          {notes.map((n, k) => (
            <li key={k}>
              <span className="small muted">
                Дополнение · {n.author} · {new Date(n.at).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}
              </span>
              <div>{n.text}</div>
            </li>
          ))}
        </ul>
      ) : null}
      {item.q ? (
        <details className="issue-detail">
          <summary>{item.q.parameterId ? "Откуда значение" : "Почему так в файле"}</summary>
          {item.q.explanation}
        </details>
      ) : null}
      {adding ? (
        <div className="issue-status-form">
          <textarea placeholder="Что добавить к пояснению" value={text} onChange={(e) => setText(e.target.value)} rows={2} autoFocus />
          {savedAuthor() ? null : <input placeholder="Ваше имя" value={author} onChange={(e) => setAuthor(e.target.value)} />}
          <div className="row-actions">
            <button className="btn small primary" disabled={!text.trim() || !author.trim()} onClick={save}>
              Сохранить
            </button>
            <button className="btn small" onClick={() => setAdding(false)}>
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <button className="linklike small" onClick={() => setAdding(true)}>
          Дополнить пояснение
        </button>
      )}
    </>
  );
}

function Rows({ project, items, go }: { project: DemoProject; items: IssueItem[]; go: (t: Tab) => void }) {
  const { open } = useHow();
  return (
    <table className="grid issues-table">
      <thead>
        <tr>
          <th>№</th>
          <th>Вопрос и пояснение</th>
          <th>Влияние</th>
          <th>Рекомендация</th>
          <th>Статус</th>
          <th>Где видно</th>
        </tr>
      </thead>
      <tbody>
        {items.map((i) => (
          <tr key={i.key} className={i.stale ? "stale" : ""}>
            <td data-label="№" className="issue-no">
              {i.no}
            </td>
            <td data-label="Вопрос и пояснение" className="issue-main">
              <Explanation project={project} item={i} />
            </td>
            <td data-label="Влияние">{i.q ? <Impact q={i.q} /> : "—"}</td>
            <td data-label="Рекомендация">{i.q?.recommendation ?? "—"}</td>
            <td data-label="Статус">
              <StatusCell project={project} item={i} />
            </td>
            <td data-label="Где видно" className="nowrap">
              {i.q ? (
                <>
                  <button className="linklike" onClick={() => go(TAB_OF_BLOCK[i.q?.block ?? "budget"])}>
                    {TAB_LABEL[TAB_OF_BLOCK[i.q.block]]}
                  </button>
                  <br />
                  <button className="linklike" onClick={() => i.q && open(i.q.parameterId ? { kind: "param", id: i.q.parameterId } : { kind: "formula", id: i.q.formulaId })}>
                    {i.q.parameterId ? "значение" : "как посчитано"}
                  </button>
                </>
              ) : (
                "—"
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type Sub = "active" | "archive";
type Filter = "all" | "open" | "work";

/**
 * Вкладка «Расхождения с Excel» — рабочий список вопросов к авторам исходного файла (решение владельца продукта
 * 27.09.2026). Расчёт «как в исходном Excel» повторяет Excel один в один; здесь — места, где файл не сходится сам с собой,
 * с влиянием, рекомендацией и статусом. Решённые — в «Архиве».
 */
export function DiscrepanciesTab({ project, questions, go }: { project: DemoProject; questions: DataQuestion[]; go: (tab: Tab) => void }) {
  const [sub, setSub] = useState<Sub>("active");
  const [sort, setSort] = useState<"impact" | "no">("impact");
  const [filter, setFilter] = useState<Filter>("all");
  const [exporting, setExporting] = useState(false);
  if (!project.legacyCase && questions.length === 0 && !Object.keys(project.issues ?? {}).length) {
    return <p className="muted discrepancies">Вопросов нет: проект не загружен из Excel и не использует неподтверждённых стандартных значений компании.</p>;
  }
  const all = issueItems(project, questions);
  const active = all.filter((i) => i.status !== "done");
  const archive = all.filter((i) => i.status === "done");
  const shown = (sub === "active" ? active.filter((i) => filter === "all" || i.status === filter) : archive).sort((a, b) =>
    sort === "impact" ? impactSize(b) - impactSize(a) || a.no - b.no : a.no - b.no,
  );
  const blockOf = (i: IssueItem) => i.q?.block ?? "budget";
  return (
    <div className="discrepancies">
      <p className="small muted">
        {project.legacyCase
          ? "Ошибки и нестыковки, найденные в исходном Excel: расчёт «как в исходном Excel» повторяет их как есть, в расчёте сервиса они исправлены. Влияние — разница между значением Excel и исправленным: «+» — в Excel больше, «−» — меньше. "
          : ""}
        Стандартные значения компании, которые проект использует без подтверждения, тоже здесь: статус «Решено» отмечает значение как подтверждённое финансистами.
      </p>
      <div className="issues-toolbar">
        <div className="seg">
          <button className={sub === "active" ? "on" : ""} onClick={() => setSub("active")}>
            Активные ({active.length})
          </button>
          <button className={sub === "archive" ? "on" : ""} onClick={() => setSub("archive")}>
            Архив ({archive.length})
          </button>
        </div>
        {sub === "active" ? (
          <label className="small">
            Статус{" "}
            <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
              <option value="all">все активные</option>
              <option value="open">{ISSUE_STATUS_LABEL.open}</option>
              <option value="work">{ISSUE_STATUS_LABEL.work}</option>
            </select>
          </label>
        ) : null}
        <label className="small">
          Порядок{" "}
          <select value={sort} onChange={(e) => setSort(e.target.value as "impact" | "no")}>
            <option value="impact">по влиянию</option>
            <option value="no">по номеру</option>
          </select>
        </label>
        <button
          className="btn small"
          disabled={exporting}
          onClick={async () => {
            setExporting(true);
            try {
              await exportIssues(project, all);
            } finally {
              setExporting(false);
            }
          }}
        >
          Выгрузить в Excel
        </button>
      </div>
      {shown.length === 0 ? (
        <p className="muted">{sub === "archive" ? "Решённых пунктов пока нет." : "Активных пунктов нет."}</p>
      ) : (
        BLOCKS.filter((b) => shown.some((i) => blockOf(i) === b.id)).map((b) => (
          <section key={b.id}>
            <h2>
              {b.title} <span className="muted small">{shown.filter((i) => blockOf(i) === b.id).length}</span>
            </h2>
            <Rows project={project} items={shown.filter((i) => blockOf(i) === b.id)} go={go} />
          </section>
        ))
      )}
    </div>
  );
}
