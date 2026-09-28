"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Левое меню проекта и справочника (раздел 1 задания): группы раскрываются по клику на заголовок, меню сворачивается
 * кнопкой «Свернуть меню» (состояние запоминается). В свёрнутом меню — разделы верхнего уровня значком с подписью;
 * у группы по клику открывается всплывающий список её пунктов со статусами.
 */

export type Tone = "done" | "need" | "bad" | "none";

export interface NavItem {
  id: string;
  /** Номер шага или значок в кружке. */
  mark: string;
  title: string;
  /** Статус справа: «✓», «нет 3», «2 проверки», «1 из 8». */
  status?: string | undefined;
  tone?: Tone | undefined;
}

export interface NavGroup {
  id: string;
  title: string;
  /** Значок и подпись в свёрнутом меню. */
  icon: string;
  short: string;
  status?: string | undefined;
  tone?: Tone | undefined;
  items: NavItem[];
}

export type NavEntry = { group: NavGroup } | { item: NavItem & { icon: string; short: string } } | { divider: true };

const COLLAPSED_KEY = "fm.nav.collapsed";

/** Свёрнуто ли меню: запоминается в браузере; без доступа к хранилищу — развёрнуто. */
export function useCollapsed(): [boolean, (v: boolean) => void] {
  const [collapsed, set] = useState(false);
  useEffect(() => {
    try {
      set(localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {
      /* хранилище недоступно */
    }
  }, []);
  const update = (v: boolean) => {
    set(v);
    try {
      localStorage.setItem(COLLAPSED_KEY, v ? "1" : "0");
    } catch {
      /* хранилище недоступно */
    }
  };
  return [collapsed, update];
}

function Step({ item, on, go }: { item: NavItem; on: boolean; go: (id: string) => void }) {
  return (
    <button className={`nav-step tone-${item.tone ?? "none"} ${on ? "on" : ""}`} onClick={() => go(item.id)} aria-current={on ? "page" : undefined}>
      <span className="n">{item.mark}</span>
      <span className="t">{item.title}</span>
      {item.status ? <span className="st">{item.status}</span> : <span />}
    </button>
  );
}

function Group({ group, active, go }: { group: NavGroup; active: string; go: (id: string) => void }) {
  const has = group.items.some((i) => i.id === active);
  const [open, setOpen] = useState(has);
  // Группа с открытым шагом раскрывается сама, но её можно свернуть.
  useEffect(() => {
    if (has) setOpen(true);
  }, [has, active]);
  return (
    <div className={`nav-group ${open ? "" : "closed"}`}>
      <button className={`nav-ghead tone-${group.tone ?? "none"}`} onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="chev">{open ? "▾" : "▸"}</span>
        <span>{group.title}</span>
        {group.status ? <span className="st">{group.status}</span> : <span />}
      </button>
      {open ? group.items.map((i) => <Step key={i.id} item={i} on={i.id === active} go={go} />) : null}
    </div>
  );
}

function RailButton({ icon, short, on, open, tone, onClick }: { icon: string; short: string; on: boolean; open?: boolean; tone?: Tone | undefined; onClick: () => void }) {
  return (
    <button className={`nav-rb ${on ? "on" : ""} ${open ? "open" : ""}`} onClick={onClick} aria-expanded={open}>
      <span className="ri">
        {icon}
        {tone === "need" || tone === "bad" ? <i className={`rdot ${tone}`} /> : null}
      </span>
      <span className="rl">{short}</span>
    </button>
  );
}

function RailGroup({ group, active, go }: { group: NavGroup; active: string; go: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div className="nav-rwrap" ref={ref}>
      <RailButton icon={group.icon} short={group.short} on={group.items.some((i) => i.id === active)} open={open} tone={group.tone} onClick={() => setOpen(!open)} />
      {open ? (
        <div className="nav-fly" role="menu">
          <div className="nav-fly-h">{group.title}</div>
          {group.items.map((i) => (
            <Step key={i.id} item={i} on={i.id === active} go={(id) => (setOpen(false), go(id))} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Каркас «меню слева + рабочая область справа». */
export function NavLayout({ entries, active, go, children }: { entries: NavEntry[]; active: string; go: (id: string) => void; children: ReactNode }) {
  const [collapsed, setCollapsed] = useCollapsed();
  return (
    <div className={`nav-app ${collapsed ? "collapsed" : ""}`}>
      <nav className="nav-steps" aria-label="Разделы">
        {collapsed ? (
          <>
            <RailButton icon="»" short="Меню" on={false} onClick={() => setCollapsed(false)} />
            <hr />
            {entries.map((e) =>
              "divider" in e ? null : "group" in e ? (
                <RailGroup key={e.group.id} group={e.group} active={active} go={go} />
              ) : (
                <RailButton key={e.item.id} icon={e.item.icon} short={e.item.short} on={e.item.id === active} tone={e.item.tone} onClick={() => go(e.item.id)} />
              ),
            )}
          </>
        ) : (
          <>
            <button className="nav-step nav-toggle" onClick={() => setCollapsed(true)}>
              <span className="n">«</span>
              <span className="t">Свернуть меню</span>
              <span />
            </button>
            {entries.map((e, k) =>
              "divider" in e ? <hr key={`d${k}`} /> : "group" in e ? <Group key={e.group.id} group={e.group} active={active} go={go} /> : <Step key={e.item.id} item={e.item} on={e.item.id === active} go={go} />,
            )}
          </>
        )}
      </nav>
      <main className="nav-main">{children}</main>
    </div>
  );
}
