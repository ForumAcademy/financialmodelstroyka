"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { StoreProvider, useStore } from "@/lib/store";
import { attentionItems } from "@/lib/attention";
import type { Seed } from "@/lib/types";
import { PassportProvider } from "./Passport";

function Header() {
  const path = usePathname();
  const { projects, model } = useStore();
  const count = attentionItems(projects, model).length;
  const active = (href: string) => (href === "/" ? path === "/" || path.startsWith("/projects") : path.startsWith(href));
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="brand">
          Финмодель ЖК
          <span>оценка потенциала участков</span>
        </Link>
        <nav>
          <Link href="/" className={active("/") ? "on" : ""}>
            Проекты
          </Link>
          <Link href="/reference" className={active("/reference") ? "on" : ""}>
            Справочник
          </Link>
          <Link href="/attention" className={active("/attention") ? "on" : ""}>
            Требует внимания
          </Link>
        </nav>
        <div className="topbar-right">
          <Link href="/attention" className="bell" title="Требует внимания" aria-label={`Требует внимания: ${count}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            {count > 0 ? <span className="badge">{count}</span> : null}
          </Link>
          <button className="logout" disabled title="Вход и выход — этап 7 (демо-режим)">
            Выйти
          </button>
        </div>
      </div>
    </header>
  );
}

export function AppShell({ seed, children }: { seed: Seed; children: ReactNode }) {
  return (
    <StoreProvider seed={seed}>
      <PassportProvider>
        <Header />
        <div className="demo-banner">Демо-режим: изменения хранятся до перезагрузки страницы. Хранение проектов — этап 7.</div>
        {children}
      </PassportProvider>
    </StoreProvider>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <div className="crumbs">
      <div className="crumbs-inner">
        {items.map((it, i) => (
          <span key={i}>
            {i > 0 ? <span className="sep">›</span> : null}
            {it.href ? <Link href={it.href}>{it.label}</Link> : <span className="current">{it.label}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
