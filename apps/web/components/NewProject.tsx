"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getParameter, spec, type ParameterId } from "@fm/spec";
import { savedAuthor, valueText } from "./Change";
import { readModelFile, type FileImport } from "@/lib/excel-import";
import { buildProject, checkFile, EMPTY_FORM, FILE_EXTENSIONS, FILE_MAX_MB, formValues, validateForm, type FormErrors, type NewProjectForm } from "@/lib/new-project";
import { latest } from "@/lib/assumptions";
import { useStore } from "@/lib/store";
import type { DemoProject } from "@/lib/types";
import * as fmt from "@/lib/format";

/** Окно сервиса: заголовок, крестик, содержимое, кнопки внизу. Esc и клик по фону закрывают. */
export function Modal({ title, onClose, children, foot, wide }: { title: string; onClose: () => void; children: ReactNode; foot: ReactNode; wide?: boolean }) {
  const titleId = useId();
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? " wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button className="icon" aria-label="Закрыть" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-foot">{foot}</div>
      </div>
    </div>
  );
}

const CLASS_LABEL: Record<string, string> = { эконом: "Эконом", комфорт: "Комфорт", бизнес: "Бизнес", премиум: "Премиум" };

/** Выпадающий список регионов с поиском по названию и коду. */
function RegionSelect({ value, onChange, invalid, id }: { value: string; onChange: (code: string) => void; invalid: boolean; id: string }) {
  const regions = spec.regions;
  const name = regions.find((r) => r.code === value)?.name ?? "";
  const [text, setText] = useState(name);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const list = useMemo(() => {
    const q = text.trim().toLowerCase();
    return !q || q === name.toLowerCase() ? regions : regions.filter((r) => r.name.toLowerCase().includes(q) || r.code === q);
  }, [text, name, regions]);
  const pick = (code: string) => {
    onChange(code);
    setText(regions.find((r) => r.code === code)?.name ?? "");
    setOpen(false);
  };
  return (
    <div className="combo">
      <input
        id={id}
        className={invalid ? "invalid" : ""}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        autoComplete="off"
        placeholder="Начните вводить название"
        value={text}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          setText(name);
        }}
        onChange={(e) => {
          setText(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive(Math.min(active + 1, list.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive(Math.max(active - 1, 0));
          } else if (e.key === "Enter" && open && list[active]) {
            e.preventDefault();
            pick(list[active].code);
          } else if (e.key === "Escape" && open) {
            // закрыть список, а не окно
            e.nativeEvent.stopImmediatePropagation();
            setOpen(false);
          }
        }}
      />
      {open ? (
        <ul className="combo-list" id={`${id}-list`} role="listbox">
          {list.length === 0 ? <li className="muted">Ничего не найдено</li> : null}
          {list.map((r, i) => (
            <li
              key={r.code}
              role="option"
              aria-selected={r.code === value}
              className={i === active ? "on" : ""}
              onMouseDown={(e) => (e.preventDefault(), pick(r.code))}
              onMouseEnter={() => setActive(i)}
            >
              {r.name}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** «31122026» / «31.12.2026» → «31.12.2026» по мере ввода (только цифры, точки ставятся сами). */
function maskDate(text: string): string {
  const d = text.replace(/\D/g, "").slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join(".");
}

/** «31.12.2026» → «2026-12-31»; несуществующая дата → null. */
function parseDate(text: string): string | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(text);
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : null;
}

/**
 * Дата в формате ДД.ММ.ГГГГ (в любом языке браузера) и кнопка календаря. Наружу — «ГГГГ-ММ-ДД», пусто или
 * введённый текст, если дата неполная или несуществующая (validateForm покажет ошибку).
 */
function DateInput({ id, value, onChange, invalid }: { id: string; value: string; onChange: (v: string) => void; invalid: boolean }) {
  const [text, setText] = useState(ISO.test(value) ? fmt.date(value) : value);
  const picker = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ISO.test(value) && parseDate(text) !== value) setText(fmt.date(value));
  }, [value, text]);
  return (
    <div className="date-input">
      <input
        id={id}
        className={invalid ? "invalid" : ""}
        inputMode="numeric"
        placeholder="ДД.ММ.ГГГГ"
        value={text}
        onChange={(e) => {
          const t = maskDate(e.target.value);
          setText(t);
          onChange(t ? (parseDate(t) ?? t) : "");
        }}
      />
      <button type="button" className="icon" aria-label="Открыть календарь" title="Календарь" onClick={() => picker.current?.showPicker?.()}>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <rect x="2" y="3" width="12" height="11" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M2 6.5h12M5 1.5v3M11 1.5v3" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      </button>
      <input ref={picker} className="date-picker" type="date" tabIndex={-1} aria-hidden="true" value={ISO.test(value) ? value : ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Field({ label, id, error, hint, children, required }: { label: string; id: string; error?: string | undefined; hint?: string; children: ReactNode; required?: boolean }) {
  return (
    <div className="mfield">
      <label htmlFor={id}>
        {label}
        {required ? <span className="req"> *</span> : null}
      </label>
      {children}
      {error ? <div className="field-error">{error}</div> : hint ? <div className="field-hint">{hint}</div> : null}
    </div>
  );
}

const KB = 1024;
const fileSize = (bytes: number) => (bytes < KB * KB ? `${fmt.num(bytes / KB, 0)} КБ` : `${fmt.num(bytes / KB / KB, 1)} МБ`);

/** Значение для списка «что загружено»: доли — в процентах, остальное — с единицей. */
function shownValue(id: ParameterId, v: unknown): string {
  const unit = getParameter(id).unit;
  if (typeof v === "number" && (unit === "доля" || unit === "%годовых")) return fmt.share(v);
  return valueText(id, v);
}

/** Экран «Что загружено из файла»: подставленные значения и то, что осталось в файле. */
export function ImportReport({ report }: { report: FileImport }) {
  if (!report.ok) {
    return <p className="import-fail">Не удалось прочитать значения из файла. Файл сохранён в проекте, параметры взяты из Справочника.</p>;
  }
  const n = report.applied.length;
  return (
    <>
      <p className="import-count">
        Подставлено {n} {fmt.plural(n, ["значение", "значения", "значений"])} из файла «{report.fileName}». У каждого в поле «Откуда» указаны лист и ячейка.
      </p>
      <table className="sheet import-table">
        <thead>
          <tr>
            <th>Параметр</th>
            <th>Значение</th>
            <th>Лист, ячейка</th>
          </tr>
        </thead>
        <tbody>
          {report.applied.map((a) => (
            <tr key={a.param}>
              <td>{getParameter(a.param).name}</td>
              <td className="num">{shownValue(a.param, a.value)}</td>
              <td className="small">
                {a.sheet}, {a.cell}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {report.skipped.length ? (
        <>
          <h3>Не подставлено ({report.skipped.length})</h3>
          <p className="small muted">Эти данные остаются в прикреплённом файле, их можно перенести в проект вручную.</p>
          <table className="sheet import-table">
            <thead>
              <tr>
                <th>Что</th>
                <th>Лист, ячейки</th>
                <th>Почему</th>
              </tr>
            </thead>
            <tbody>
              {report.skipped.map((s, i) => (
                <tr key={i}>
                  <td>{s.label}</td>
                  <td className="small">
                    {s.sheet}, {s.cells}
                  </td>
                  <td className="small muted">{s.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </>
  );
}

/** Кнопка «Скачать исходный файл» для загруженной финмодели. */
export function DownloadSource({ project }: { project: DemoProject }) {
  const file = project.sources.find((s) => s.id === project.fileImport?.sourceId)?.file;
  if (!file) return null;
  return (
    <a className="btn" href={file.url} download={file.name}>
      Скачать исходный файл
    </a>
  );
}

/**
 * Окно «Новый проект» (задача владельца продукта 28.09.2026): проект создаётся только по кнопке «Создать проект».
 * Если загружена финмодель в Excel, после создания показывается, что из неё подставлено.
 */
export function NewProjectDialog({ onClose }: { onClose: () => void }) {
  const { dispatch, assumptions } = useStore();
  const router = useRouter();
  const [form, setForm] = useState<NewProjectForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<DemoProject | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const uid = useId();
  const fid = (k: string) => `${uid}-${k}`;

  const set = (k: keyof NewProjectForm, v: string) => {
    const next = { ...form, [k]: v };
    setForm(next);
    // до первой попытки создать при вводе видны только ошибки в датах и площади, после — все
    const e = validateForm(next);
    setErrors({ ...(touched ? e : { areaHa: e.areaHa, salesStart: e.salesStart, commissioning: e.commissioning }), file: errors.file });
  };

  const choose = (f: File | undefined) => {
    if (!f) return;
    const problem = checkFile(f);
    setErrors({ ...errors, file: problem ?? undefined });
    setFile(problem ? null : f);
    if (input.current) input.current.value = "";
  };

  const submit = async () => {
    setTouched(true);
    const e = validateForm(form);
    setErrors({ ...e, file: errors.file });
    if (Object.keys(e).length) return;
    setBusy(true);
    const id = `p-${Date.now()}`;
    const version = latest(assumptions).version;
    let project: DemoProject;
    if (file) {
      const filled = new Set(Object.keys(formValues(form)) as ParameterId[]);
      const result = await readModelFile(await file.arrayBuffer(), filled);
      const stored = { name: file.name, size: file.size, type: file.type, url: URL.createObjectURL(file) };
      project = buildProject(id, form, version, { sourceId: `doc-${Date.now()}`, author: savedAuthor() || "автор не указан", file: stored, result });
    } else project = buildProject(id, form, version);
    dispatch({ type: "create", project });
    setBusy(false);
    if (project.fileImport) setCreated(project);
    else router.push(`/projects/${id}`);
  };

  if (created?.fileImport) {
    const go = () => router.push(`/projects/${created.id}`);
    return (
      <Modal
        title="Что загружено из файла"
        wide
        onClose={go}
        foot={
          <>
            <DownloadSource project={created} />
            <button className="btn primary" onClick={go}>
              Перейти к проекту
            </button>
          </>
        }
      >
        <ImportReport report={created.fileImport} />
      </Modal>
    );
  }

  const invalid = (k: keyof FormErrors) => (errors[k] ? "invalid" : "");

  return (
    <Modal
      title="Новый проект"
      onClose={onClose}
      foot={
        <>
          <button className="btn" onClick={onClose}>
            Отмена
          </button>
          <button className="btn primary" onClick={submit} disabled={busy}>
            {busy ? "Создаём…" : "Создать проект"}
          </button>
        </>
      }
    >
      <form
        className="form-grid"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label="Название проекта" id={fid("name")} error={errors.name} required>
          <input id={fid("name")} className={invalid("name")} autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Регион" id={fid("region")} error={errors.region} required>
          <RegionSelect id={fid("region")} value={form.region} invalid={!!errors.region} onChange={(code) => set("region", code)} />
        </Field>
        <Field label="Адрес или кадастровый номер участка" id={fid("site")}>
          <input id={fid("site")} value={form.site} onChange={(e) => set("site", e.target.value)} />
        </Field>
        <Field label="Площадь участка, га" id={fid("area")} error={errors.areaHa}>
          <input id={fid("area")} className={invalid("areaHa")} inputMode="decimal" value={form.areaHa} onChange={(e) => set("areaHa", e.target.value)} />
        </Field>
        <Field label="Класс жилья" id={fid("class")}>
          <select id={fid("class")} value={form.housingClass} onChange={(e) => set("housingClass", e.target.value)}>
            <option value="">Не выбран</option>
            {(getParameter("GEN.HOUSING_CLASS").options ?? []).map((o) => (
              <option key={String(o)} value={String(o)}>
                {CLASS_LABEL[String(o)] ?? String(o)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Дата начала проекта" id={fid("start")} error={errors.start} required>
          <DateInput id={fid("start")} invalid={!!errors.start} value={form.start} onChange={(v) => set("start", v)} />
        </Field>
        <Field label="Старт продаж" id={fid("sales")} error={errors.salesStart} hint="Можно указать позже">
          <DateInput id={fid("sales")} invalid={!!errors.salesStart} value={form.salesStart} onChange={(v) => set("salesStart", v)} />
        </Field>
        <Field label="Ввод в эксплуатацию" id={fid("rnv")} error={errors.commissioning}>
          <DateInput id={fid("rnv")} invalid={!!errors.commissioning} value={form.commissioning} onChange={(v) => set("commissioning", v)} />
        </Field>
        <button type="submit" hidden />
      </form>

      <div className="upload-block">
        <div className="upload-title">Финмодель в Excel (если есть)</div>
        <input ref={input} type="file" hidden accept={FILE_EXTENSIONS.join(",")} onChange={(e) => choose(e.target.files?.[0])} />
        {file ? (
          <div className="upload-file">
            <span>{file.name}</span>
            <span className="muted small">{fileSize(file.size)}</span>
            <button className="link" onClick={() => setFile(null)}>
              Убрать
            </button>
          </div>
        ) : (
          <div
            className={`dropzone${drag ? " over" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => input.current?.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), input.current?.click())}
            onDragOver={(e) => (e.preventDefault(), setDrag(true))}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              choose(e.dataTransfer.files[0]);
            }}
          >
            <div>
              Перетащите файл или <span className="link">выберите</span>
            </div>
            <div className="small muted">
              Необязательно. Если финмодель уже считали в Excel — загрузите её, сервис подставит найденные значения. Файлы .xlsx, .xlsm, .xls до {FILE_MAX_MB} МБ.
            </div>
          </div>
        )}
        {errors.file ? <div className="field-error">{errors.file}</div> : null}
      </div>
    </Modal>
  );
}
