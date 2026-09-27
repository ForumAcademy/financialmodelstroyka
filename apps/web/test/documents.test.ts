import { describe, expect, it } from "vitest";
import { reducer } from "../lib/store";
import { loadSeed } from "../lib/seed";
import type { ProjectSource } from "../lib/types";

const doc: ProjectSource = {
  id: "doc-1",
  level: 4,
  title: "ГПЗУ",
  url: "",
  author: "Аналитик",
  date: "2026-09-27",
  file: { name: "ГПЗУ.pdf", size: 2048, type: "application/pdf", url: "blob:demo" },
};

describe("раздел «Документы»", () => {
  it("загруженный документ — источник проекта: его можно выбрать у значения, переименовать и удалить", () => {
    const p = loadSeed().projects[0]!;
    let [s] = reducer([p], { type: "addSource", id: p.id, source: doc });
    [s] = reducer([s!], { type: "linkSource", id: p.id, param: "LAND.AREA", sourceId: "doc-1" });
    expect(s!.sources.map((x) => x.title)).toContain("ГПЗУ");
    expect(s!.paramSources["LAND.AREA"]).toBe("doc-1");
    [s] = reducer([s!], { type: "renameSource", id: p.id, sourceId: "doc-1", title: "ГПЗУ № 77-123" });
    expect(s!.sources.find((x) => x.id === "doc-1")?.title).toBe("ГПЗУ № 77-123");
    [s] = reducer([s!], { type: "removeSource", id: p.id, sourceId: "doc-1" });
    expect(s!.sources).toHaveLength(0);
    expect(s!.paramSources["LAND.AREA"]).toBeUndefined();
  });
});
