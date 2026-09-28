// Демо-данные: tests/cases/derbenevskaya_legacy.yaml → lib/generated/derbenevskaya.json (на этапе сборки,
// чтобы серверу не нужно было читать файлы вне приложения). Запускается из build и dev.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";

const root = resolve(import.meta.dirname, "..");
const src = resolve(root, "../../tests/cases/derbenevskaya_legacy.yaml");
const out = resolve(root, "lib/generated/derbenevskaya.json");
const c = parse(readFileSync(src, "utf8"));
const data = {
  case_id: c.case_id,
  description: c.description,
  project_inputs: c.project_inputs,
  reconciliation_targets: c.reconciliation_targets,
  // бюджет исходника для расчёта «как в исходном Excel» (legacyCaseInput → CAPEX.ITEMS)
  capex_legacy: c.capex_legacy,
  // план продаж исходника (legacyCaseInput → SALES.*)
  sales_legacy: c.sales_legacy,
  // ячейки исходника для проверок расчёта «как в исходном Excel» (legacyChecks → предупреждения)
  legacy_checks: c.legacy_checks,
  timeline_quarters_F_to_AS: c.timeline_quarters_F_to_AS,
};
const text = JSON.stringify(data, null, 2) + "\n";
function read(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}
if (read(out) !== text) writeFileSync(out, text);

// Карта исходного Excel для загрузки файла в новый проект: legacy/legacy_values_map.csv → lib/generated/legacy-map.json.
// Ячейки с вердиктом remove (дубли, вычисляемые значения) не читаются.
const csv = readFileSync(resolve(root, "../../legacy/legacy_values_map.csv"), "utf8").trim().split("\n");
const cols = (line) => {
  const out = [];
  let cur = "";
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) {
      out.push(cur);
      cur = "";
    }
    else cur += ch;
  }
  return [...out, cur];
};
const head = cols(csv[0]);
const map = csv
  .slice(1)
  .map((line) => Object.fromEntries(cols(line).map((v, i) => [head[i], v])))
  .filter((r) => r.verdict !== "remove")
  .map((r) => ({ sheet: r.sheet.trim(), cell: r.cell, target: r.target_id, verdict: r.verdict, label: r.row_label.trim() }));
const mapOut = resolve(root, "lib/generated/legacy-map.json");
const mapText = JSON.stringify(map, null, 1) + "\n";
if (read(mapOut) !== mapText) writeFileSync(mapOut, mapText);
