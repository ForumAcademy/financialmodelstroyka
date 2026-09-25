// Демо-данные: tests/cases/derbenevskaya_legacy.yaml → lib/generated/derbenevskaya.json (на этапе сборки,
// чтобы серверу не нужно было читать файлы вне приложения). Запускается из build и dev.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";

const root = resolve(import.meta.dirname, "..");
const src = resolve(root, "../../tests/cases/derbenevskaya_legacy.yaml");
const out = resolve(root, "lib/generated/derbenevskaya.json");
const c = parse(readFileSync(src, "utf8"));
const data = { case_id: c.case_id, description: c.description, project_inputs: c.project_inputs, reconciliation_targets: c.reconciliation_targets };
const text = JSON.stringify(data, null, 2) + "\n";
function read(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}
if (read(out) !== text) writeFileSync(out, text);
