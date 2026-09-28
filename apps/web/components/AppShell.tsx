"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { StoreProvider } from "@/lib/store";
import type { Seed } from "@/lib/types";
import { HowPanelProvider } from "./HowPanel";

/** Разделы справочника: стандартные значения, формулы, источники, история версий. */
const REFERENCE = ["/assumptions", "/formulas", "/sources"];

function Header() {
  const path = usePathname();
  const reference = REFERENCE.some((r) => path.startsWith(r));
  return (
    <header className="topbar">
      <Link href="/" className="brand">
        Финмодель ЖК
      </Link>
      <nav>
        <Link href="/" className={reference ? "" : "on"}>
          Проекты
        </Link>
        <Link href="/assumptions" className={reference ? "on" : ""}>
          Справочник
        </Link>
      </nav>
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
