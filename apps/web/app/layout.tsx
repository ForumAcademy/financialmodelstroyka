import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { loadSeed } from "@/lib/seed";
import "./globals.css";

export const metadata: Metadata = {
  title: "Финмодель ЖК",
  description: "Финансовая модель девелопера: оценка потенциала земельных участков под жилую застройку",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <AppShell seed={loadSeed()}>{children}</AppShell>
      </body>
    </html>
  );
}
