"""
Валидатор спецификации. Запускается в CI перед сборкой. Код выхода 1 — ошибки.
Проверяет:
  1. Уникальность ID источников, параметров, формул, статей.
  2. У каждого параметра/формулы/статьи есть source_ids, и все они существуют в sources.yaml.
  3. У источников уровня 1–3 есть URL; scope: global | project (проектные — уровень 4–5, без URL).
  4. depends_on формул ссылается на существующие параметры/формулы; граф без циклов.
  5. Каждый параметр имеет basis; project-параметры без default или с обоснованием.
  6. Карта исходного Excel полная: нет UNMAPPED в legacy/*.csv; все target_id существуют.
  7. regions.yaml: 89 субъектов, коды уникальны.
  8. Контрольные примеры формул (где заданы) пересчитываются.
Предупреждения (не ошибки): статусы needs_verification, источники verified: false.
"""
import csv, re, sys
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]
D = ROOT / "data"
errors, warns = [], []

src = yaml.safe_load(open(D / "sources.yaml"))["sources"]
params = yaml.safe_load(open(D / "parameters.yaml"))["parameters"]
forms = yaml.safe_load(open(D / "formulas.yaml"))["formulas"]
capex = yaml.safe_load(open(D / "capex_items.yaml"))["items"]
regions = yaml.safe_load(open(D / "regions.yaml"))["regions"]

def uniq(items, key, what):
    seen = set()
    for it in items:
        k = it[key]
        if k in seen:
            errors.append(f"{what}: дубль ID {k}")
        seen.add(k)
    return seen

S = uniq(src, "id", "sources")
P = uniq(params, "id", "parameters")
F = uniq(forms, "id", "formulas")
C = uniq(capex, "item_id", "capex_items")

for s in src:
    if s["level"] in (1, 2, 3) and not s.get("url"):
        errors.append(f"источник {s['id']} уровня {s['level']} без URL")
    if s.get("url") and not re.match(r"^https?://", s["url"]):
        errors.append(f"источник {s['id']}: некорректный URL")
    if s.get("scope") not in ("global", "project"):
        errors.append(f"источник {s['id']}: scope должен быть global или project")
    elif s["scope"] == "project" and (s["level"] < 4 or s.get("url")):
        errors.append(f"источник {s['id']}: проектный источник (scope: project) — только уровень 4–5 и без URL")
    elif s["scope"] == "global" and s["level"] == 5:
        errors.append(f"источник {s['id']}: экспертная оценка (уровень 5) может быть только проектной")
    if s.get("verified") is False:
        warns.append(f"источник {s['id']}: не сверен ({s.get('note', '')})")

def check_sources(owner, ids):
    if not ids:
        errors.append(f"{owner}: нет source_ids")
    for i in ids or []:
        if i not in S:
            errors.append(f"{owner}: источник {i} отсутствует в sources.yaml")

for p in params:
    check_sources(f"параметр {p['id']}", p.get("source_ids"))
    if not p.get("basis"):
        errors.append(f"параметр {p['id']}: нет basis")
    if p.get("status") == "needs_verification":
        warns.append(f"параметр {p['id']}: needs_verification")
    if not p.get("legacy"):
        errors.append(f"параметр {p['id']}: нет поля legacy (связь с исходником или 'new')")

for c in capex:
    check_sources(f"статья {c['item_id']}", c.get("source_ids"))
    if c.get("rate_param") and c["rate_param"] not in P:
        errors.append(f"статья {c['item_id']}: rate_param {c['rate_param']} не найден")
    if c["base"] not in ("фикс", "фикс_в_месяц", "формула") and c["base"] not in P and c["base"] not in F:
        errors.append(f"статья {c['item_id']}: база {c['base']} не является ID параметра/формулы")
    if c["base"] == "формула" and c.get("formula") not in F:
        errors.append(f"статья {c['item_id']}: формула {c.get('formula')} не найдена")

known = P | F
for f in forms:
    check_sources(f"формула {f['id']}", f.get("source_ids"))
    for dep in f.get("depends_on") or []:
        if dep not in known:
            errors.append(f"формула {f['id']}: зависимость {dep} не найдена")
    for fld in ("rationale", "expr"):
        if not f.get(fld):
            errors.append(f"формула {f['id']}: нет {fld}")
    if f.get("status") == "needs_verification":
        warns.append(f"формула {f['id']}: needs_verification")

# циклы: рёбра только между формулами; зависимости за прошлый месяц (lag_depends_on в formulas.yaml, X[t-1])
# разрывают цикл в реализации и в проверке не участвуют
for f in forms:
    for d in f.get("lag_depends_on") or []:
        if d not in (f.get("depends_on") or []):
            errors.append(f"формула {f['id']}: lag_depends_on {d} нет в depends_on")
LAG_OK = {(f["id"], d) for f in forms for d in (f.get("lag_depends_on") or [])}
graph = {f["id"]: [d for d in (f.get("depends_on") or []) if d in F and (f["id"], d) not in LAG_OK] for f in forms}
state = {}
def dfs(n, stack):
    state[n] = 1
    for m in graph.get(n, []):
        if state.get(m) == 1:
            errors.append("цикл без лага: " + " → ".join(stack + [n, m]))
        elif not state.get(m):
            dfs(m, stack + [n])
    state[n] = 2
for n in graph:
    if not state.get(n):
        dfs(n, [])

# legacy
def target_ok(t):
    if t in ("—",):
        return True
    base = t.split("[")[0]
    if base == "CAPEX.ITEMS":
        item = t[t.find("[") + 1:t.find("]")] if "[" in t else None
        return item in C if item else True
    return base in known
for fn, col in (("legacy_values_map.csv", "target_id"), ("legacy_formulas_map.csv", "target_id")):
    path = ROOT / "legacy" / fn
    if not path.exists():
        errors.append(f"нет {fn} — запустите scripts/build_legacy_map.py")
        continue
    rows = list(csv.DictReader(open(path, encoding="utf-8")))
    for r in rows:
        if r[col] == "UNMAPPED":
            errors.append(f"{fn}: не сопоставлено {r.get('sheet')}!{r.get('cell') or r.get('range')}")
        elif not target_ok(r[col]):
            errors.append(f"{fn}: target {r[col]} не существует ({r.get('sheet')}!{r.get('cell') or r.get('range')})")
    if fn == "legacy_values_map.csv":
        clar = [r for r in rows if r["verdict"] == "clarify"]
        for r in clar:
            warns.append(f"исходник {r['sheet']}!{r['cell']} = {r['value']}: требует пояснения автора")

# regions
codes = [r["code"] for r in regions]
if len(codes) != 89:
    errors.append(f"regions.yaml: {len(codes)} субъектов вместо 89")
if len(set(codes)) != len(codes):
    errors.append("regions.yaml: дубли кодов")
for r in regions:
    for key in ("land_tax_source_ids", "ncs_k_per_source_ids"):
        for i in r.get(key) or []:
            if i not in S:
                errors.append(f"регион {r['code']}: источник {i} не найден")

# контрольные примеры
def approx(a, b, tol=1e-6):
    return abs(a - b) <= tol * max(1, abs(b))
ex = {f["id"]: f.get("example") for f in forms if f.get("example")}
checks = {
    "F.TEP.GFA_BELOW_EST": lambda e: e["input"]["parking"] * e["input"]["area_per_space"],
    "F.TEP.APT_TYPE_AREA": lambda e: e["input"]["count"] * e["input"]["avg_area"],
    "F.TEP.PARKING_REQUIRED": lambda e: -(-sum(c * n for c, n in zip(e["input"]["counts"], e["input"]["norms"])) // 1),
    "F.LAND.TAX_OR_RENT": lambda e: e["input"]["cad_value"] * e["input"]["rate"] * e["input"]["coef"] / 12,
    "F.FIN.RATE": lambda e: max(e["input"]["pref"] * min(e["input"]["coverage"], 1)
                                 + (e["input"]["key"] + e["input"]["spread"]) * (1 - min(e["input"]["coverage"], 1))
                                 - e["input"]["skr"], e["input"]["min"]),
    "F.TAX.OUTPUT_VAT": lambda e: e["input"]["value"] * e["input"]["rate"] / (1 + e["input"]["rate"]),
    "F.TEP.APT_COUNT": lambda e: (e["input"]["area_share"] * e["input"]["apt_area_total"] / e["input"]["avg_area"]) // 1,
    "F.TEP.PARKING_SPACE_MIN_AREA": lambda e: e["input"]["length"] * e["input"]["width"],
    "F.BENCH.COMP_PRICE": lambda e: sum(e["input"]["deal_values"]) / sum(e["input"]["deal_areas"]),
    "F.BENCH.MARKET_PRICE": lambda e: (lambda w: sum(p * x for p, x in zip(e["input"]["prices"], w)) / sum(w))(
        [1 / (1 + a) for a in e["input"]["adj_total"]]),
}
for fid, fn in checks.items():
    e = ex.get(fid)
    if not e:
        continue
    got = fn(e)
    exp = e.get("output", e.get("output_per_month"))
    if not approx(got, exp, 1e-4):
        errors.append(f"пример {fid}: расчёт {got} ≠ {exp}")
e = ex.get("F.CAPEX.SCHEDULE_WEIGHT")
if e:
    N = e["input"]["N"]; C_ = lambda x: 3 * x * x - 2 * x ** 3
    w = [C_((i + 1) / N) - C_(i / N) for i in range(N)]
    if any(not approx(a, b) for a, b in zip(w, e["output"])) or not approx(sum(w), 1):
        errors.append(f"пример F.CAPEX.SCHEDULE_WEIGHT: {w} ≠ {e['output']}")

print(f"Источники: {len(S)}, параметры: {len(P)}, статьи бюджета: {len(C)}, формулы: {len(F)}, регионы: {len(codes)}")
print(f"Предупреждения: {len(warns)}")
for w in warns:
    print("  WARN", w)
print(f"Ошибки: {len(errors)}")
for e in errors:
    print("  ERROR", e)
sys.exit(1 if errors else 0)
