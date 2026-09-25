"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { StoreProvider } from "@/lib/store";
import type { Seed } from "@/lib/types";
import { HowPanelProvider } from "./HowPanel";

function Header() {
  const path = usePathname();
  const on = (href: string) => (href === "/" ? path === "/" || path.startsWith("/projects") : path.startsWith(href));
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="brand">
          Финмодель ЖК
        </Link>
        <nav>
          <Link href="/" className={on("/") ? "on" : ""}>
            Проекты
          </Link>
          <Link href="/sources" className={on("/sources") ? "on" : ""}>
            Источники
          </Link>
          <Link href="/formulas" className={on("/formulas") ? "on" : ""}>
            Формулы
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function AppShell({ seed, children }: { seed: Seed; children: ReactNode }) {
  return (
    <StoreProvider seed={seed}>
      <HowPanelProvider>
        <Header />
        {children}
      </HowPanelProvider>
    </StoreProvider>
  );
}
