"use client";

import { useState } from "react";
import { fmtRub, type DataQuestion } from "@fm/engine";
import { savedAuthor } from "./Change";
import { useHow } from "./HowPanel";
import { GROUPS, impactSize, issueItems, TAB_TITLE, type IssueItem } from "@/lib/issues";
import type { InputTab } from "@/lib/tab-inputs";
import { exportIssues } from "@/lib/issues-export";
import { plural } from "@/lib/format";
import { useStore } from "@/lib/store";
import { ISSUE_STATUS_LABEL, type DemoProject, type IssueStatus } from "@/lib/types";

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

/** Плашка над вкладками: сколько расхождений не решено (тот же подсчёт, что в заголовке вкладки) и где их список. */
export function CompatBanner({ text, go }: { text: string; go: () => void }) {
  return (
    <div className="compat-warnings">
      {text}{" "}
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
    dispatch({ type: "issue", id: project.id, key: item.key, no: item.no, question: item.title, event });
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

/** Пункт: что не так в файле, где, что это меняет; вопросы автору строками внутри; ручные дополнения (кто, когда). */
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
    dispatch({ type: "issueNote", id: project.id, key: item.key, no: item.no, question: item.title, note: { text: text.trim(), author: author.trim(), at: new Date().toISOString() } });
    setText("");
    setAdding(false);
  };
  return (
    <>
      <div className="issue-question">{item.title}</div>
      {item.stale ? <p className="muted">Не воспроизводится: после обновления исходника пункт пропал. Статус сохранён.</p> : null}
      {item.where ? <div className="small muted">{item.where}</div> : null}
      {item.effect ? <p className="issue-summary">{item.effect}</p> : null}
      {item.question ? (
        <p className="issue-ask">
          <b>Вопрос автору:</b> {item.question}
        </p>
      ) : null}
      {item.questions.map((q) => (
        <div key={q.key} className="issue-ask">
          <b>Вопрос автору:</b> {q.question}
          <details className="issue-detail">
            <summary>Что сверил расчёт</summary>
            {q.compared} {q.threat} {q.explanation}
          </details>
        </div>
      ))}
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

function Rows({ project, items, go }: { project: DemoProject; items: IssueItem[]; go: (t: InputTab) => void }) {
  const { open } = useHow();
  return (
    <table className="grid issues-table">
      <thead>
        <tr>
          <th>№</th>
          <th>Что не так в файле</th>
          <th>Влияние</th>
          <th>В расчёте сервиса</th>
          <th>Статус</th>
          <th>Где видно</th>
        </tr>
      </thead>
      <tbody>
        {items.map((i) => {
          const q = i.questions[0];
          return (
            <tr key={i.key} className={i.stale ? "stale" : ""}>
              <td data-label="№" className="issue-no">
                {i.label}
              </td>
              <td data-label="Что не так в файле" className="issue-main">
                <Explanation project={project} item={i} />
              </td>
              <td data-label="Влияние">{i.questions.some((x) => x.impact.amount) ? i.questions.map((x) => <Impact key={x.key} q={x} />) : "—"}</td>
              <td data-label="В расчёте сервиса">{i.fix || "—"}</td>
              <td data-label="Статус">
                <StatusCell project={project} item={i} />
              </td>
              <td data-label="Где видно" className="nowrap">
                {i.stale ? (
                  "—"
                ) : (
                  <>
                    <button className="linklike" onClick={() => go(i.tab)}>
                      {TAB_TITLE[i.tab]}
                    </button>
                    {q ? (
                      <>
                        <br />
                        <button className="linklike" onClick={() => open({ kind: "formula", id: q.formulaId })}>
                          как посчитано
                        </button>
                      </>
                    ) : null}
                  </>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

type Sub = "active" | "archive";
type Filter = "all" | "open" | "work";

/**
 * Вкладка «Расхождения» — пункты аудита исходного Excel с вопросами расчёта к авторам файла (решения владельца продукта
 * 27.09.2026 и 28.09.2026). Расчёт «как в исходном Excel» повторяет Excel один в один; здесь — что в файле не так,
 * влияние, как считает сервис и статус. Группы: «Искажают результат», «Методика», «Уточнить у автора файла» (открытые
 * вопросы, в число нерешённых не входят). Решённые — в «Архиве».
 */
export function DiscrepanciesTab({ project, questions, go }: { project: DemoProject; questions: DataQuestion[]; go: (tab: InputTab) => void }) {
  const [sub, setSub] = useState<Sub>("active");
  const [sort, setSort] = useState<"impact" | "no">("no");
  const [filter, setFilter] = useState<Filter>("all");
  const [exporting, setExporting] = useState(false);
  const all = issueItems(project, questions);
  const active = all.filter((i) => i.status !== "done");
  const archive = all.filter((i) => i.status === "done");
  const shown = (sub === "active" ? active.filter((i) => filter === "all" || i.status === filter) : archive).sort((a, b) =>
    sort === "impact" ? impactSize(b) - impactSize(a) || a.no - b.no : a.no - b.no,
  );
  // Вопросы автору файла — не ошибки: в скобках отдельно, чтобы число совпадало с заголовком вкладки
  const asked = active.filter((i) => i.group === "author").length;
  const activeLabel = `${active.length - asked}${asked ? ` + ${asked} ${plural(asked, ["вопрос", "вопроса", "вопросов"])} автору` : ""}`;
  const tabs = Object.keys(TAB_TITLE) as InputTab[];
  return (
    <div className="discrepancies">
      <p className="small muted">
        Ошибки и недочёты исходного Excel по аудиту файла: расчёт «как в исходном Excel» повторяет их как есть, в расчёте сервиса они исправлены. Влияние — разница между значением Excel и исправленным: «+» — в Excel больше, «−» — меньше. Вопросы
        автору файла — отдельно: это не ошибки, в число нерешённых они не входят.
      </p>
      <div className="issues-toolbar">
        <div className="seg">
          <button className={sub === "active" ? "on" : ""} onClick={() => setSub("active")}>
            Активные ({activeLabel})
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
            <option value="no">по номеру</option>
            <option value="impact">по влиянию</option>
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
        GROUPS.filter((g) => shown.some((i) => i.group === g.id)).map((g) => {
          const inGroup = shown.filter((i) => i.group === g.id);
          return (
            <section key={g.id} className="issue-group">
              <h2>
                {g.id === "author" ? `${g.title}: открытые вопросы` : g.title} <span className="muted small">{inGroup.length}</span>
              </h2>
              {tabs
                .filter((t) => inGroup.some((i) => i.tab === t))
                .map((t) => (
                  <section key={t}>
                    <h3>
                      {TAB_TITLE[t]} <span className="muted small">{inGroup.filter((i) => i.tab === t).length}</span>
                    </h3>
                    <Rows project={project} items={inGroup.filter((i) => i.tab === t)} go={go} />
                  </section>
                ))}
            </section>
          );
        })
      )}
    </div>
  );
}
