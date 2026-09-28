"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import Decimal from "decimal.js";
import { assumptionValueProblem, getParameter, type ParameterId } from "@fm/spec";
import { savedAuthor } from "@/components/Change";
import { useHow } from "@/components/HowPanel";
import { ReferenceShell } from "@/components/ReferenceShell";
import {
  assumptionValueText,
  GROUP_LABEL,
  isConfirmed,
  latest,
  releaseChecks,
  STATUS_LABEL,
  statusText,
  versionOf,
  type AssumptionItem,
  type AssumptionVersion,
} from "@/lib/assumptions";
import * as fmt from "@/lib/format";
import { useStore } from "@/lib/store";

const AUTHOR_KEY = "fm.author";
const PERCENT = 100;

/** Единица ввода: доли и ставки вводятся в процентах. */
const isShare = (param: ParameterId) => ["доля", "%годовых"].includes(getParameter(param).unit);

/** Число из поля ввода: «3,5» → 3.5; пусто → null; не число → NaN. */
const parseNum = (t: string): number | null => (t.trim() === "" ? null : Number(t.replace(/\s/g, "").replace(",", ".")));

const toInput = (param: ParameterId, v: unknown) =>
  typeof v === "number" ? fmt.inputNumber(isShare(param) ? new Decimal(v).mul(PERCENT).toNumber() : v) : "";
const fromInput = (param: ParameterId, n: number) => (isShare(param) ? new Decimal(n).div(PERCENT).toNumber() : n);

/** Структура оплат одной строкой полей: одна структура для всех продуктов справочника. */
const MIX_FIELDS = [
  ["mortgage_share", "Ипотечные сделки, %"],
  ["mortgage_down_payment", "из них первоначальный взнос, %"],
  ["full_payment_share", "Оплата 100%, %"],
  ["installment_share", "Рассрочка, %"],
  ["installment_months", "Срок рассрочки, мес"],
] as const;

function saveAuthor(author: string) {
  try {
    localStorage.setItem(AUTHOR_KEY, author);
  } catch {
    /* имя автора — только удобство */
  }
}

function EditForm({ item, onDone }: { item: AssumptionItem; onDone: () => void }) {
  const { dispatchAssumptions } = useStore();
  const p = getParameter(item.param);
  const mix = item.param === "SALES.PAYMENT_MIX" && Array.isArray(item.value) ? (item.value as Record<string, unknown>[]) : null;
  const editable = p.kind === "scalar" || !!mix;
  const [text, setText] = useState(toInput(item.param, item.value));
  const [mixText, setMixText] = useState<Record<string, string>>(() =>
    Object.fromEntries(MIX_FIELDS.map(([k]) => [k, mix?.[0] ? fmt.inputNumber(k === "installment_months" ? Number(mix[0][k] ?? 0) : new Decimal(Number(mix[0][k] ?? 0)).mul(PERCENT).toNumber()) : ""])),
  );
  const [status, setStatus] = useState(item.status);
  const [fromText, setFromText] = useState(item.from.text);
  const [url, setUrl] = useState(item.from.url ?? "");
  const [why, setWhy] = useState("");
  const [author, setAuthor] = useState(savedAuthor);
  const [error, setError] = useState("");

  const newValue = (): { value: unknown } | string => {
    if (mix) {
      const nums = Object.fromEntries(MIX_FIELDS.map(([k]) => [k, parseNum(mixText[k] ?? "")]));
      if (Object.values(nums).some((n) => n === null || Number.isNaN(n))) return "Заполните все поля структуры оплат числами";
      const share = (k: string) => new Decimal(nums[k] as number).div(PERCENT);
      const total = share("mortgage_share").add(share("full_payment_share")).add(share("installment_share"));
      if (!total.eq(1)) return `Ипотека, оплата 100% и рассрочка в сумме ${fmt.inputNumber(total.mul(PERCENT).toNumber())}% — должно быть 100%`;
      if (share("mortgage_down_payment").gt(share("mortgage_share"))) return "Первоначальный взнос не может быть больше доли ипотечных сделок";
      return {
        value: mix.map((r) => ({
          ...r,
          mortgage_share: share("mortgage_share").toNumber(),
          mortgage_down_payment: share("mortgage_down_payment").toNumber(),
          full_payment_share: share("full_payment_share").toNumber(),
          installment_share: share("installment_share").toNumber(),
          installment_months: nums.installment_months,
        })),
      };
    }
    if (!editable) return { value: item.value };
    const n = parseNum(text);
    if (n !== null && Number.isNaN(n)) return "Введите число";
    const value = n === null ? null : fromInput(item.param, n);
    const problem = assumptionValueProblem(p, value);
    return problem ? `Значение не подходит: ${problem}` : { value };
  };

  const save = () => {
    const v = newValue();
    if (typeof v === "string") return setError(v);
    const valueChanged = JSON.stringify(v.value ?? null) !== JSON.stringify(item.value ?? null);
    if (!valueChanged && status === item.status && fromText.trim() === item.from.text && (url.trim() || null) === item.from.url) return setError("Ничего не изменилось");
    if (!fromText.trim()) return setError("Напишите, откуда значение");
    if (valueChanged && fromText.trim() === item.from.text) return setError("Значение меняется — обновите «Откуда»: на чём основано новое значение");
    if (url.trim() && !/^https?:\/\//.test(url.trim())) return setError("Ссылка должна начинаться с http:// или https://");
    if (!why.trim()) return setError("Напишите, почему меняете справочник");
    if (!author.trim()) return setError("Укажите, кто меняет");
    saveAuthor(author.trim());
    dispatchAssumptions({ type: "edit", param: item.param, patch: { value: (v.value ?? null) as AssumptionItem["value"], status, from: { text: fromText.trim(), url: url.trim() || null } }, why: why.trim(), author: author.trim() });
    onDone();
  };

  return (
    <div className="assumption-form">
      {mix ? (
        MIX_FIELDS.map(([k, label]) => (
          <label key={k} className="small">
            {label}{" "}
            <input value={mixText[k] ?? ""} onChange={(e) => setMixText({ ...mixText, [k]: e.target.value })} />
          </label>
        ))
      ) : editable ? (
        <label className="small">
          Значение{isShare(item.param) ? ", %" : `, ${fmt.unit(p.unit)}`} <input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="пусто — стандарта нет" />
        </label>
      ) : (
        <p className="small muted">Таблица задаётся в проекте; здесь можно поменять статус и «Откуда».</p>
      )}
      <label className="small">
        Статус{" "}
        <select value={status} onChange={(e) => setStatus(e.target.value as AssumptionItem["status"])}>
          <option value="unverified">{STATUS_LABEL.unverified}</option>
          {item.check ? <option value="check">{statusText({ status: "check", check: item.check })}</option> : null}
          <option value="approved">{STATUS_LABEL.approved}</option>
        </select>
      </label>
      <input placeholder="Откуда значение (обязательно)" value={fromText} onChange={(e) => setFromText(e.target.value)} />
      <input placeholder="Ссылка на документ (необязательно)" value={url} onChange={(e) => setUrl(e.target.value)} />
      <textarea placeholder="Почему меняете (обязательно)" rows={2} value={why} onChange={(e) => setWhy(e.target.value)} />
      <input placeholder="Кто меняет" value={author} onChange={(e) => setAuthor(e.target.value)} />
      <div className="row-actions">
        <button className="btn small primary" onClick={save}>
          Сохранить новой версией
        </button>
        <button className="btn small" onClick={onDone}>
          Отмена
        </button>
        {error ? <span className="error small">{error}</span> : null}
      </div>
    </div>
  );
}

function ItemRow({ item, hl }: { item: AssumptionItem; hl: boolean }) {
  const { open } = useHow();
  const [editing, setEditing] = useState(false);
  const p = getParameter(item.param);
  const long = item.param === "SALES.PAYMENT_MIX";
  return (
    <tr id={`ref-${item.param}`} className={hl ? "hl" : ""}>
      <td>
        <button className="linklike" onClick={() => open({ kind: "param", id: item.param })}>
          {p.name}
        </button>
      </td>
      <td className={`a-value ${long ? "wrap" : ""}`}>{assumptionValueText(item.param, item.value)}</td>
      <td>
        <span className={`status-badge status-${item.status}`}>{statusText(item)}</span>
      </td>
      <td className="small">
        {item.from.text}
        {item.from.url ? (
          <>
            {" · "}
            <a href={item.from.url} target="_blank" rel="noreferrer">
              открыть документ
            </a>
          </>
        ) : (
          <span className="nolink-badge">нет ссылки</span>
        )}
        {item.note ? <div className="muted">{item.note}</div> : null}
        {editing ? <EditForm item={item} onDone={() => setEditing(false)} /> : null}
      </td>
      <td>
        {editing ? null : (
          <button className="btn small" onClick={() => setEditing(true)}>
            Изменить
          </button>
        )}
      </td>
    </tr>
  );
}

/** Утвердить значения, которые финансисты подтвердили в проекте (статус «Решено» у вопроса к данным). */
function ApproveFromProjects({ current }: { current: AssumptionVersion }) {
  const { projects, dispatchAssumptions, assumptions } = useStore();
  const [author, setAuthor] = useState(savedAuthor);
  const offers = projects
    .filter((p) => !p.archived)
    .map((p) => {
      const pv = versionOf(assumptions, p.assumptionsVersion);
      const params = current.items
        .filter((i) => i.status === "unverified" && isConfirmed(p, i.param))
        // подтверждено то же значение, что сейчас в справочнике
        .filter((i) => JSON.stringify(pv?.items.find((x) => x.param === i.param)?.value ?? null) === JSON.stringify(i.value ?? null))
        .map((i) => i.param);
      return { p, params };
    })
    .filter((o) => o.params.length);
  if (!offers.length) return null;
  return (
    <section className="assumptions-update">
      <b>Финансисты подтвердили значения в проектах</b>
      {offers.map(({ p, params }) => (
        <div key={p.id}>
          <p className="small">
            «{p.name}»: {params.map((id) => getParameter(id).name).join("; ")}.
          </p>
          {savedAuthor() ? null : <input placeholder="Ваше имя" value={author} onChange={(e) => setAuthor(e.target.value)} />}
          <button
            className="btn small primary"
            disabled={!author.trim()}
            onClick={() => {
              saveAuthor(author.trim());
              dispatchAssumptions({ type: "approve", params, why: `Утверждены значения, подтверждённые финансистами в проекте «${p.name}»`, author: author.trim() });
            }}
          >
            Утвердить {params.length} {fmt.plural(params.length, ["значение", "значения", "значений"])}
          </button>
        </div>
      ))}
    </section>
  );
}

/** «Проверить перед релизом»: пустые значения и значения со статусом «проверить …». */
function ReleaseChecks({ current }: { current: AssumptionVersion }) {
  const list = releaseChecks(current);
  if (!list.length) return null;
  return (
    <section className="assumptions-update">
      <b>Проверить перед релизом: {list.length}</b>
      <ul className="small">
        {list.map(({ item, what }) => (
          <li key={item.param}>
            {getParameter(item.param).name} — {what}
          </li>
        ))}
      </ul>
      <div className="small muted">Пустые значения нулём не считаются: в проекте они отмечены на дашборде как не учтённые, пока их не введут.</div>
    </section>
  );
}

/** Переход из поля проекта по метке «по справочнику»: строка подсвечена, сверху — «← Проект». */
function useFromProject(): { param: string | null; back: { href: string; name: string } | null } {
  const search = useSearchParams();
  const { projects } = useStore();
  const param = search.get("param");
  const from = projects.find((p) => p.id === search.get("from"));
  useEffect(() => {
    if (!param) return;
    const t = setTimeout(() => document.getElementById(`ref-${param}`)?.scrollIntoView({ block: "center" }), 100);
    return () => clearTimeout(t);
  }, [param]);
  return { param, back: from ? { href: `/projects/${from.id}?field=${encodeURIComponent(param ?? "")}`, name: from.name } : null };
}

export default function Page() {
  return (
    <Suspense fallback={<main className="page">Загрузка…</main>}>
      <AssumptionsPage />
    </Suspense>
  );
}

function AssumptionsPage() {
  const { assumptions, projects } = useStore();
  const { param, back } = useFromProject();
  const current = latest(assumptions);
  const groups = (Object.keys(GROUP_LABEL) as AssumptionItem["group"][]).filter((g) => current.items.some((i) => i.group === g));
  const behind = projects.filter((p) => !p.archived && (p.assumptionsVersion ?? 0) < current.version);
  const unverified = current.items.filter((i) => i.status !== "approved" && i.value !== null).length;
  return (
    <ReferenceShell active="values">
      {back ? (
        <Link href={back.href} className="back">
          ← Проект «{back.name}»
        </Link>
      ) : null}
      <div className="work-head">
        <h2>Стандартные значения</h2>
      </div>
      <p className="muted">
        Стандартные значения компании для нового проекта. Финансист вводит только специфику объекта: ТЭП, цены, план продаж, смету, график СМР. Любое значение можно заменить в проекте, указав, почему. Новая версия справочника не пересчитывает существующие проекты: проект переходит на неё по кнопке «Обновить» в самом проекте.
      </p>
      <p>
        <b>Версия {current.version}</b> от {fmt.date(current.date)} · {current.author}. Не проверено: {unverified}.
        {behind.length ? (
          <>
            {" "}
            На более ранней версии:{" "}
            {behind.map((p, i) => (
              <span key={p.id}>
                {i ? ", " : ""}
                <Link href={`/projects/${p.id}`}>{p.name}</Link> (версия {p.assumptionsVersion ?? "—"})
              </span>
            ))}
            .
          </>
        ) : null}
      </p>
      <ReleaseChecks current={current} />
      <ApproveFromProjects current={current} />
      {groups.map((g) => (
        <section key={g}>
          <h2>{GROUP_LABEL[g]}</h2>
          <div className="hscroll">
            <table className="sheet assumptions-table">
              <thead>
                <tr>
                  <th>Показатель</th>
                  <th>Значение</th>
                  <th>Статус</th>
                  <th>Откуда</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {current.items
                  .filter((i) => i.group === g)
                  .map((i) => (
                    <ItemRow key={i.param} item={i} hl={i.param === param} />
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </ReferenceShell>
  );
}
