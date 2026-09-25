"use client";

import { useMemo, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import type { ProjectModel } from "@/lib/model";
import type { DemoProject } from "@/lib/types";
import * as fmt from "@/lib/format";
import { addDays, addMonths, diffDays, MONTHS, MONTHS_SHORT, today, toMs } from "@/lib/dates";

type Key = "land_acquired" | "design_start" | "expertise_done" | "rns_date" | "construction_start" | "construction_end" | "rnv_date" | "handover_end" | "sales_start";
type Row = Partial<Record<Key, string | null>> & { phase: number };
type Scale = "days" | "weeks" | "months" | "quarters";

const KEY_LABEL: Record<Key, string> = {
  land_acquired: "Покупка участка",
  design_start: "Начало ИРД / ПИР",
  expertise_done: "Заключение экспертизы",
  rns_date: "РНС",
  construction_start: "Начало СМР",
  construction_end: "Окончание СМР",
  sales_start: "Старт продаж (ДДУ)",
  rnv_date: "РНВ",
  handover_end: "Окончание передачи ключей",
};

type Line =
  | { label: string; kind: "point"; key: Key; cls: string }
  | { label: string; kind: "bar"; from: Key; to: Key; cls: string }
  | { label: string; kind: "open"; from: Key; cls: string }
  | { label: string; kind: "escrow"; cls: string };

const LINES: Line[] = [
  { label: "Покупка участка", kind: "point", key: "land_acquired", cls: "m-land" },
  { label: "ИРД / ПИР", kind: "bar", from: "design_start", to: "expertise_done", cls: "b-design" },
  { label: "Экспертиза", kind: "point", key: "expertise_done", cls: "m-design" },
  { label: "РНС", kind: "point", key: "rns_date", cls: "m-permit" },
  { label: "СМР", kind: "bar", from: "construction_start", to: "construction_end", cls: "b-smr" },
  { label: "Продажи ДДУ (эскроу)", kind: "bar", from: "sales_start", to: "rnv_date", cls: "b-ddu" },
  { label: "РНВ", kind: "point", key: "rnv_date", cls: "m-rnv" },
  { label: "Раскрытие эскроу", kind: "escrow", cls: "m-escrow" },
  { label: "Продажи ДКП", kind: "open", from: "rnv_date", cls: "b-dkp" },
  { label: "Передача ключей", kind: "bar", from: "rnv_date", to: "handover_end", cls: "b-handover" },
];

const PX_PER_DAY: Record<Scale, number> = { days: 24, weeks: 5, months: 1.3, quarters: 0.5 };
const SCALE_LABEL: Record<Scale, string> = { days: "Дни", weeks: "Недели", months: "Месяцы", quarters: "Кварталы" };
const ROW_H = 28;

interface Drag {
  phase: number;
  key: Key;
  x0: number;
  date0: string;
  date: string;
}

export function Gantt({ project, model }: { project: DemoProject; model: ProjectModel }) {
  const { dispatch } = useStore();
  const [scale, setScale] = useState<Scale>("months");
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [drag, setDrag] = useState<Drag | null>(null);
  const [editPhase, setEditPhase] = useState<number | null>(null);
  const [flash, setFlash] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => {
    const raw = ((project.input.values["TIME.MILESTONES"] as Row[] | undefined) ?? []).slice().sort((a, b) => a.phase - b.phase);
    const phases = Math.max(Number(project.input.values["GEN.PHASES_COUNT"] ?? 1), raw.length, 1);
    return Array.from({ length: phases }, (_, i) => raw.find((r) => r.phase === i + 1) ?? { phase: i + 1 });
  }, [project]);

  const dateOf = (r: Row, key: Key): string | null => (drag && drag.phase === r.phase && drag.key === key ? drag.date : (r[key] ?? null));

  // Раскрытие эскроу — из ядра (F.TIME.FLAG_ESCROW_RELEASE), чтобы график показывал ровно то, что считает модель.
  const monthDates = model.result.formulas["F.TIME.DATE"]?.value as string[] | undefined;
  const release = model.result.formulas["F.TIME.FLAG_ESCROW_RELEASE"]?.value as number[][] | undefined;
  const releaseOf = (i: number) => {
    const t = release?.[i]?.indexOf(1) ?? -1;
    return t >= 0 && monthDates ? (monthDates[t] ?? null) : null;
  };
  const horizonEnd = monthDates?.at(-1) ?? null;

  const all = rows.flatMap((r) => Object.entries(r).filter(([k, v]) => k !== "phase" && typeof v === "string").map(([, v]) => v as string));
  const start = String(project.input.values["GEN.MODEL_START_DATE"] ?? all[0] ?? today());
  const lo = [start, ...all].reduce((a, b) => (b < a ? b : a));
  const hi = [start, today(), ...all, ...(horizonEnd ? [horizonEnd] : [])].reduce((a, b) => (b > a ? b : a));
  const from = addMonths(lo, -2);
  const to = addMonths(hi, 3, "last");
  const ppd = PX_PER_DAY[scale];
  const width = diffDays(from, to) * ppd;
  const x = (d: string) => diffDays(from, d) * ppd;

  const ticks = useMemo(() => {
    const top: { x: number; w: number; label: string }[] = [];
    const bottom: { x: number; label: string }[] = [];
    const yearly = scale === "months" || scale === "quarters";
    let d = addMonths(from, 0);
    while (d <= to) {
      const next = yearly ? `${Number(d.slice(0, 4)) + 1}-01-01` : addMonths(d, 1);
      const m = Number(d.slice(5, 7)) - 1;
      top.push({ x: x(d), w: x(next < to ? next : to) - x(d), label: yearly ? d.slice(0, 4) : `${MONTHS[m]} ${d.slice(0, 4)}` });
      d = next;
    }
    if (scale === "days") for (let t = from; t <= to; t = addDays(t, 1)) bottom.push({ x: x(t), label: t.slice(8, 10) });
    if (scale === "weeks") {
      let t = from;
      while (new Date(toMs(t)).getUTCDay() !== 1) t = addDays(t, 1);
      for (; t <= to; t = addDays(t, 7)) bottom.push({ x: x(t), label: `${t.slice(8, 10)}.${t.slice(5, 7)}` });
    }
    if (scale === "months") for (let t = from; t <= to; t = addMonths(t, 1)) bottom.push({ x: x(t), label: MONTHS_SHORT[Number(t.slice(5, 7)) - 1] ?? "" });
    if (scale === "quarters") for (let t = from; t <= to; t = addMonths(t, 1)) if ((Number(t.slice(5, 7)) - 1) % 3 === 0) bottom.push({ x: x(t), label: `${Math.floor((Number(t.slice(5, 7)) - 1) / 3) + 1} кв` });
    return { top, bottom };
  }, [scale, from, to, ppd]);

  const scrollTo = (d: string | null) => {
    if (d && scroller.current) scroller.current.scrollLeft = Math.max(x(d) - scroller.current.clientWidth / 3, 0);
  };
  const firstRnv = rows.map((r) => r.rnv_date).filter((v): v is string => !!v).sort()[0] ?? null;

  const onDown = (e: RPointerEvent, phase: number, key: Key, date: string) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ phase, key, x0: e.clientX, date0: date, date });
  };
  const onMove = (e: RPointerEvent) => {
    if (!drag) return;
    setDrag({ ...drag, date: addDays(drag.date0, Math.round((e.clientX - drag.x0) / ppd)) });
  };
  const onUp = () => {
    if (!drag) return;
    if (drag.date !== drag.date0) {
      dispatch({ type: "milestone", id: project.id, phase: drag.phase, key: drag.key, date: drag.date });
      setFlash(`Очередь ${drag.phase}: ${KEY_LABEL[drag.key]} → ${fmt.date(drag.date)}. Модель пересчитана.`);
    } else {
      setEditPhase(drag.phase);
    }
    setDrag(null);
  };

  const handle = (r: Row, key: Key, cls: string) => {
    const d = dateOf(r, key);
    if (!d) return null;
    return (
      <div
        key={key}
        className={`gantt-handle ${cls}`}
        style={{ left: x(d) - 6 }}
        title={`${KEY_LABEL[key]}: ${fmt.date(d)} — перетащите или нажмите, чтобы изменить`}
        onPointerDown={(e) => onDown(e, r.phase, key, d)}
        onPointerMove={onMove}
        onPointerUp={onUp}
      />
    );
  };

  const lines = rows.flatMap((r) => [
    ...(r.sales_start ? [{ d: dateOf(r, "sales_start")!, cls: "vl-sales", label: `старт продаж · оч. ${r.phase}` }] : []),
    ...(r.rnv_date ? [{ d: dateOf(r, "rnv_date")!, cls: "vl-rnv", label: `РНВ · оч. ${r.phase}` }] : []),
  ]);

  return (
    <div className="gantt-wrap">
      <div className="toolbar">
        <div className="seg">
          {(Object.keys(SCALE_LABEL) as Scale[]).map((s) => (
            <button key={s} className={scale === s ? "on" : ""} onClick={() => setScale(s)}>
              {SCALE_LABEL[s]}
            </button>
          ))}
        </div>
        <button className="btn" onClick={() => scrollTo(today())}>
          ◎ К сегодняшнему дню
        </button>
        <button className="btn" onClick={() => scrollTo(firstRnv)} disabled={!firstRnv}>
          К РНВ
        </button>
        <button className="btn" onClick={() => setCollapsed(new Set(rows.map((r) => r.phase)))}>
          − Свернуть
        </button>
        <button className="btn" onClick={() => setCollapsed(new Set())}>
          + Развернуть
        </button>
        {model.horizon ? <span className="small muted">Горизонт модели: {model.horizon} мес. (предварительно)</span> : null}
      </div>
      <div className="legend small">
        <span><i className="lg b-design" />ИРД/ПИР</span>
        <span><i className="lg b-smr" />СМР</span>
        <span><i className="lg b-ddu" />Продажи ДДУ</span>
        <span><i className="lg b-dkp" />Продажи ДКП</span>
        <span><i className="lg b-handover" />Передача ключей</span>
        <span><i className="lg-dot m-rnv" />веха</span>
        <span><i className="lg-line vl-today" />сегодня</span>
        <span><i className="lg-line vl-sales" />старт продаж</span>
        <span><i className="lg-line vl-rnv" />РНВ</span>
      </div>
      {flash ? <div className="flash small">{flash} Сейчас от дат зависят флаги периодов, раскрытие эскроу и земельный налог; CF и показатели — после этапов 4–6.</div> : null}
      {project.note ? <div className="note small">Данные исходника: {project.note}</div> : null}

      <div className="gantt">
        <div className="gantt-left">
          <div className="gantt-head-left">Очередь / веха</div>
          {rows.map((r) => (
            <div key={r.phase}>
              <div className="gantt-label group" style={{ height: ROW_H }}>
                <button className="icon" onClick={() => setCollapsed((c) => { const n = new Set(c); if (n.has(r.phase)) n.delete(r.phase); else n.add(r.phase); return n; })}>
                  {collapsed.has(r.phase) ? "›" : "⌄"}
                </button>
                <strong>Очередь {r.phase}</strong>
                <button className="link small" onClick={() => setEditPhase(r.phase)}>
                  ✎ даты
                </button>
              </div>
              {!collapsed.has(r.phase) &&
                LINES.map((l) => (
                  <div key={l.label} className="gantt-label" style={{ height: ROW_H }}>
                    {l.label}
                  </div>
                ))}
            </div>
          ))}
        </div>
        <div className="gantt-right" ref={scroller}>
          <div style={{ width, position: "relative" }}>
            <div className="gantt-head">
              <div className="gantt-top">
                {ticks.top.map((t) => (
                  <div key={t.x} style={{ left: t.x, width: t.w }}>
                    {t.label}
                  </div>
                ))}
              </div>
              <div className="gantt-bottom">
                {ticks.bottom.map((t) => (
                  <div key={t.x} style={{ left: t.x }}>
                    {t.label}
                  </div>
                ))}
              </div>
            </div>
            <div className="gantt-body">
              {ticks.bottom.map((t) => (
                <div key={t.x} className="gridline" style={{ left: t.x }} />
              ))}
              <div className="vline vl-today" style={{ left: x(today()) }} title={`Сегодня ${fmt.date(today())}`}>
                <span>Сегодня</span>
              </div>
              {lines.map((l) => (
                <div key={l.label} className={`vline ${l.cls}`} style={{ left: x(l.d) }} title={`${l.label}: ${fmt.date(l.d)}`}>
                  <span>{l.label}</span>
                </div>
              ))}
              {rows.map((r, i) => {
                const own = Object.entries(r).filter(([k, v]) => k !== "phase" && typeof v === "string").map(([k]) => dateOf(r, k as Key)!);
                const span = own.length ? { a: own.reduce((p, q) => (q < p ? q : p)), b: own.reduce((p, q) => (q > p ? q : p)) } : null;
                return (
                  <div key={r.phase}>
                    <div className="gantt-row group" style={{ height: ROW_H }}>
                      {span ? <div className="bar b-group" style={{ left: x(span.a), width: Math.max(x(span.b) - x(span.a), 4) }} /> : <span className="empty-hint">вехи не заданы — нажмите «✎ даты»</span>}
                    </div>
                    {!collapsed.has(r.phase) &&
                      LINES.map((l) => {
                        let content: ReactNode = null;
                        if (l.kind === "point") content = handle(r, l.key, l.cls);
                        if (l.kind === "bar") {
                          const a = dateOf(r, l.from);
                          const b = dateOf(r, l.to);
                          content = (
                            <>
                              {a && b ? <div className={`bar ${l.cls}`} style={{ left: x(a), width: Math.max(x(b) - x(a), 2) }} /> : null}
                              {handle(r, l.from, "h-end")}
                              {handle(r, l.to, "h-end")}
                              {!a || !b ? <span className="empty-hint">{!a ? KEY_LABEL[l.from] : KEY_LABEL[l.to]}: не задано</span> : null}
                            </>
                          );
                        }
                        if (l.kind === "open") {
                          const a = dateOf(r, l.from);
                          content = a && horizonEnd ? <div className={`bar ${l.cls}`} style={{ left: x(a), width: Math.max(x(horizonEnd) - x(a), 2) }} title="До распродажи остатка — определится планом продаж (этап 4)" /> : null;
                        }
                        if (l.kind === "escrow") {
                          const d = releaseOf(i);
                          content = d ? <div className={`gantt-dot ${l.cls}`} style={{ left: x(d) - 6 }} title={`Раскрытие эскроу: ${fmt.date(d)} (F.TIME.FLAG_ESCROW_RELEASE)`} /> : null;
                        }
                        return (
                          <div key={l.label} className="gantt-row" style={{ height: ROW_H }}>
                            {content}
                          </div>
                        );
                      })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      {editPhase !== null ? <PhaseEditor project={project} phase={editPhase} row={rows.find((r) => r.phase === editPhase)!} onClose={() => setEditPhase(null)} onSaved={setFlash} /> : null}
    </div>
  );
}

function PhaseEditor({ project, phase, row, onClose, onSaved }: { project: DemoProject; phase: number; row: Row; onClose: () => void; onSaved: (s: string) => void }) {
  const { dispatch } = useStore();
  const [dates, setDates] = useState<Partial<Record<Key, string>>>(() => Object.fromEntries((Object.keys(KEY_LABEL) as Key[]).map((k) => [k, row[k] ?? ""])));
  const save = () => {
    for (const k of Object.keys(KEY_LABEL) as Key[]) {
      const v = dates[k] || null;
      if ((row[k] ?? null) !== v) dispatch({ type: "milestone", id: project.id, phase, key: k, date: v });
    }
    onSaved(`Очередь ${phase}: даты вех сохранены. Модель пересчитана.`);
    onClose();
  };
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Вехи очереди ${phase}`}>
        <h2>Вехи очереди {phase}</h2>
        {(Object.keys(KEY_LABEL) as Key[]).map((k) => (
          <label key={k} className="row-label">
            <span>{KEY_LABEL[k]}</span>
            <input type="date" value={dates[k] ?? ""} onChange={(e) => setDates({ ...dates, [k]: e.target.value })} />
          </label>
        ))}
        <p className="small muted">Вехи — параметр TIME.MILESTONES; по ним ядро строит флаги периодов (F.TIME.*).</p>
        <div className="row end">
          <button className="btn" onClick={onClose}>
            Отмена
          </button>
          <button className="btn primary" onClick={save}>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
