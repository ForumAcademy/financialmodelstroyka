"""
Генерирует docs/03_formulas.md, docs/04_parameters.md, docs/05_sources.md из data/*.yaml.
Документация НЕ редактируется руками — только через YAML.
"""
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]
D = ROOT / "data"
src = {s["id"]: s for s in yaml.safe_load(open(D / "sources.yaml"))["sources"]}
params = yaml.safe_load(open(D / "parameters.yaml"))["parameters"]
forms = yaml.safe_load(open(D / "formulas.yaml"))["formulas"]
capex = yaml.safe_load(open(D / "capex_items.yaml"))["items"]

HEADER = "<!-- Файл сгенерирован scripts/render_docs.py из data/*.yaml. Не редактировать вручную. -->\n\n"

def link(sid):
    s = src.get(sid)
    if not s:
        return f"`{sid}` (НЕТ В РЕЕСТРЕ)"
    if s.get("url"):
        return f"[{sid}]({s['url']})"
    return f"`{sid}`"

def links(ids):
    return ", ".join(link(i) for i in ids or []) or "—"

def esc(x):
    return str(x).replace("|", "\\|").replace("\n", " ")

# ---------------- formulas
out = [HEADER, "# Каталог формул\n",
       "Каждая формула: выражение, зависимости, обоснование, отклонённые варианты, источники и связь с исходным Excel.\n"]
module = None
for f in forms:
    if f["module"] != module:
        module = f["module"]
        out.append(f"\n## {module}\n")
    out.append(f"\n### `{f['id']}` — {f['name']}\n")
    out.append(f"**Единица:** {f['unit']} · **Размерность:** {', '.join(f.get('dims') or []) or 'скаляр'} · **Статус:** {f['status']}\n")
    out.append("```\n" + str(f["expr"]).strip() + "\n```\n")
    if f.get("depends_on"):
        out.append("**Зависит от:** " + ", ".join(f"`{x}`" for x in f["depends_on"]) + "\n")
    if f.get("lag_depends_on"):
        out.append("\n**Значение за прошлый месяц (t−1):** " + ", ".join(f"`{x}`" for x in f["lag_depends_on"]) + "\n")
    out.append(f"\n**Почему так:** {f['rationale']}\n")
    if f.get("rejected"):
        out.append("\n**Отклонённые варианты:**\n")
        for r in f["rejected"]:
            out.append(f"- {r}\n")
    out.append(f"\n**Источники:** {links(f.get('source_ids'))}\n")
    lg = f.get("legacy") or {}
    if lg.get("cells"):
        issue = f" — {lg['issue']}" if lg.get("issue") else ""
        out.append(f"\n**Исходный Excel:** `{lg['cells']}` → {lg['verdict']}{issue}\n")
    if f.get("example"):
        out.append(f"\n**Контрольный пример:** `{f['example']}`\n")
(ROOT / "docs" / "03_formulas.md").write_text("".join(out), encoding="utf-8")

# ---------------- parameters
out = [HEADER, "# Реестр параметров\n",
       "| ID | Параметр | Ед. | Область | По умолчанию | Источники | Статус | Обоснование |\n|---|---|---|---|---|---|---|---|\n"]
for p in params:
    d = p.get("default")
    d = "—" if d is None else (esc(d) if not isinstance(d, (list, dict)) else "таблица")
    out.append(f"| `{p['id']}` | {esc(p['name'])} | {p['unit']} | {p['scope']} | {d} | {links(p['source_ids'])} | {p['status']} | {esc(p['basis'])} |\n")
out.append("\n## Статьи бюджета (capex_items.yaml)\n\n| Статья | Группа | База | График | Источники | Обоснование | Исходник |\n|---|---|---|---|---|---|---|\n")
for c in capex:
    lg = c["legacy"]
    leg = f"Бюджет стр.{lg.get('budget_row')}: {esc(lg.get('amount'))}" + (f" — {esc(lg['issue'])}" if lg.get("issue") else "")
    out.append(f"| `{c['item_id']}` {esc(c['name'])} | {c['group']} | {c['base']} | {c['schedule_rule']} | {links(c['source_ids'])} | {esc(c['basis'])} | {leg} |\n")
out.append("\n## Связь с исходным Excel по параметрам\n")
for p in params:
    for l in p.get("legacy") or []:
        if l.get("cell"):
            note = f" — {esc(l['note'])}" if l.get("note") else ""
            val = f" = `{esc(l['value'])}`" if "value" in l else ""
            out.append(f"- `{p['id']}` ← `{l['cell']}`{val} → **{l['verdict']}**{note}\n")
(ROOT / "docs" / "04_parameters.md").write_text("".join(out), encoding="utf-8")

# ---------------- sources
out = [HEADER, "# Реестр источников\n",
       "| ID | Ур. | Источник | Для чего | Проверено | Сверено |\n|---|---|---|---|---|---|\n"]
for s in sorted(src.values(), key=lambda x: (x["level"], x["id"])):
    title = f"[{esc(s['title'])}]({s['url']})" if s.get("url") else esc(s["title"])
    note = f" *{esc(s['note'])}*" if s.get("note") else ""
    out.append(f"| `{s['id']}` | {s['level']} | {title} | {esc(s['used_for'])}{note} | {s.get('accessed') or '—'} | {'да' if s.get('verified') else ('нет' if s.get('verified') is False else '—')} |\n")
(ROOT / "docs" / "05_sources.md").write_text("".join(out), encoding="utf-8")
print("docs rendered: 03_formulas.md, 04_parameters.md, 05_sources.md")
