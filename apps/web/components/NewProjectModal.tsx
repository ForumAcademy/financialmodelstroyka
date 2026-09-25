"use client";

import { useState } from "react";
import { getParameter, spec } from "@fm/spec";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";

/** Мастер «Создать проект», шаг 1 (docs/01): название, регион, кадастровый номер, класс, стадия. */
export function NewProjectModal({ onClose }: { onClose: () => void }) {
  const { dispatch } = useStore();
  const router = useRouter();
  const [f, setF] = useState({ name: "", region: "", cadastral: "", cls: "", stage: "" });
  const [error, setError] = useState("");
  const classes = getParameter("GEN.HOUSING_CLASS").options ?? [];
  const stages = getParameter("GEN.PROJECT_STAGE").options ?? [];

  const submit = () => {
    if (!f.name.trim() || !f.region || !f.cls || !f.stage) return setError("Заполните название, регион, класс и стадию");
    const id = `p-${Date.now()}`;
    dispatch({
      type: "create",
      project: {
        id,
        name: f.name.trim(),
        status: "draft",
        archived: false,
        sources: {},
        specVersion: spec.specVersion,
        updatedAt: new Date().toISOString(),
        input: {
          values: {
            "GEN.PROJECT_NAME": f.name.trim(),
            "GEN.REGION_CODE": f.region,
            "GEN.CADASTRAL_NUMBER": f.cadastral.trim() || null,
            "GEN.HOUSING_CLASS": f.cls,
            "GEN.PROJECT_STAGE": f.stage,
          },
        },
      },
    });
    onClose();
    router.push(`/projects/${id}?tab=inputs`);
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Новый проект">
        <h2>Новый проект</h2>
        <label>
          Название ЖК
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />
        </label>
        <label>
          Регион
          <select value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })}>
            <option value="">— выберите —</option>
            {spec.regions.map((r) => (
              <option key={r.code} value={r.code}>
                {r.code} — {r.name}
                {r.status === "structure_only" ? " (нормативы — ручной ввод)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Кадастровый номер
          <input value={f.cadastral} onChange={(e) => setF({ ...f, cadastral: e.target.value })} placeholder="77:05:0001005:1234" />
        </label>
        <div className="row">
          <label>
            Класс
            <select value={f.cls} onChange={(e) => setF({ ...f, cls: e.target.value })}>
              <option value="">—</option>
              {classes.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Стадия
            <select value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value })}>
              <option value="">—</option>
              {stages.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="small muted">Региональные параметры подставятся из справочника регионов; незаполненные — обязательный ручной ввод с документом.</p>
        {error ? <p className="error small">{error}</p> : null}
        <div className="row end">
          <button className="btn" onClick={onClose}>
            Отмена
          </button>
          <button className="btn primary" onClick={submit}>
            Создать
          </button>
        </div>
      </div>
    </div>
  );
}
