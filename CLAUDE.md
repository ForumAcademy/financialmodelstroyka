# CLAUDE.md — правила работы в репозитории финансовой модели девелопера

Проект: веб-сервис оценки потенциала земельного участка под жилую застройку (РФ). Next.js + TypeScript, деплой на Vercel, код на GitHub.

## Главный принцип

**Каждое число в расчёте объяснимо и имеет источник со ссылкой.** Если значение нельзя связать с параметром из `data/parameters.yaml` (у которого есть `source_ids`) или с формулой из `data/formulas.yaml`, его нельзя добавлять в код.

## Источник правды

- `data/sources.yaml` — источники (уровень 1–5, URL, дата проверки).
- `data/parameters.yaml`, `data/capex_items.yaml`, `data/regions.yaml` — исходные параметры.
- `data/formulas.yaml` — формулы: `expr`, `depends_on`, `rationale`, `rejected`, `source_ids`, `example`.
- `docs/03–05` генерируются командой `python scripts/render_docs.py`. **Не редактируй их вручную.**
- `docs/00_principles.md`, `01_architecture.md`, `02_legacy_audit.md` — пишутся руками.

## Обязательные правила

1. **Нет магических чисел.** В `packages/engine/src/modules/**` запрещены числовые литералы, кроме `0`, `1`, `12`, `365` и индексов. Ставки, коэффициенты, пороги берутся только из параметров по ID.
2. **Одна формула = одна функция.** ID функции совпадает с ID формулы (`F.FIN.RATE` → `F_FIN_RATE`). Реализация повторяет `expr` из YAML. Если нужно изменить логику — сначала PR в `data/formulas.yaml` (с `rationale` и `rejected`), затем код.
3. **Новый параметр** добавляется в `parameters.yaml` со всеми полями: `unit`, `kind`, `scope`, `source_ids` (≥1, существующие), `basis`, `status`, `legacy` (ячейка исходника или `new`).
4. **Новый источник** уровня 1–3 — только с URL на первичный документ (КонсультантПлюс, Гарант, pravo.gov.ru, сайты ЦБ, Минстроя, МЭР, ФНС, ЕИСЖС). Новости и обзоры допустимы временно, с `verified: false` и `note`.
5. **Нельзя удалять значения исходного Excel молча.** Карта `legacy/legacy_values_map.csv` и `legacy_formulas_map.csv` должна оставаться полной (`scripts/build_legacy_map.py` завершается с кодом 0).
6. **Даты — только даты.** Деньги — рубли (`decimal.js`), доли — доли.
7. **Уровень 5 (экспертная оценка)** в интерфейсе требует автора, обоснование и диапазон min–max; такие параметры автоматически попадают в чувствительность.
8. **Не выдумывай нормативы.** Если ставка/норматив региона неизвестны — оставь `null`, статус `needs_verification`, в интерфейсе — обязательный ручной ввод с документом.

## Команды

```bash
python scripts/validate_spec.py      # проверка реестров, ссылок, графа формул, карты legacy — должна быть 0 ошибок
python scripts/render_docs.py        # пересборка docs/03–05 из YAML
python scripts/build_legacy_map.py   # пересборка карты исходного Excel (код выхода 0 = всё сопоставлено)
python scripts/build_legacy_case.py  # пересборка tests/cases/derbenevskaya_legacy.yaml
pnpm spec:build                      # data/*.yaml → packages/spec/src/generated (после любого изменения data/)
pnpm test                            # vitest: примеры формул + золотые кейсы + сверка с legacy
pnpm typecheck && pnpm lint
```

## Определение «готово» для любого PR

- [ ] `validate_spec.py` — 0 ошибок; новых предупреждений `needs_verification` нет или они объяснены в описании PR.
- [ ] Для каждой изменённой формулы: обновлены `expr`, `rationale`, `example`; тест на `example` проходит.
- [ ] `render_docs.py` запущен, `docs/03–05` закоммичены.
- [ ] Сверка с `tests/cases/derbenevskaya_legacy.yaml → reconciliation_targets` проходит в режиме совместимости.
- [ ] Паспорт показателя в UI показывает цепочку до источников со ссылками.

## Порядок разработки

См. `docs/06_build_plan.md`: этапы, промпты для Claude Code и критерии приёмки.
