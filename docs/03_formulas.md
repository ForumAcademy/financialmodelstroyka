<!-- Файл сгенерирован scripts/render_docs.py из data/*.yaml. Не редактировать вручную. -->

# Каталог формул
Каждая формула: выражение, зависимости, обоснование, отклонённые варианты, источники и связь с исходным Excel.

## TIME

### `F.TIME.DATE` — Дата конца месяца t
**Единица:** дата · **Размерность:** t · **Статус:** verified
```
date[t] = EOMONTH(GEN.MODEL_START_DATE, t)
```
**Зависит от:** `GEN.MODEL_START_DATE`

**Почему так:** Единая месячная шкала для всех модулей; отчёты агрегируют месяцы в кварталы/годы

**Отклонённые варианты:**
- Квартальный шаг исходника: проценты и покрытие эскроу считаются грубо, раскрытие эскроу сдвигается до 3 месяцев

**Источники:** `S_EXPERT`

**Исходный Excel:** `CF1!E2:AS2` → fix — F2 = EDATE, далее EOMONTH — разные функции в одном ряду

### `F.TIME.DAYS` — Дней в месяце t
**Единица:** дни · **Размерность:** t · **Статус:** verified
```
days[t] = date[t] - date[t-1]  (для t=0: DAY(date[0]))
```
**Зависит от:** `F.TIME.DATE`

**Почему так:** Проценты по кредиту начисляются по фактическим дням (факт/365), как в кредитных договорах

**Источники:** `S_BANK_TERMSHEET`

**Исходный Excel:** `CF1!F3:AS3` → keep

### `F.TIME.FLAG_CONSTRUCTION` — Флаг периода строительства очереди
**Единица:** 0/1 · **Размерность:** p, t · **Статус:** verified
```
flag_constr[p,t] = 1{ construction_start[p] <= date[t] < construction_end[p] }
```
**Зависит от:** `TIME.MILESTONES`, `F.TIME.DATE`

**Почему так:** Сравнение настоящих дат; определяет выборку ПФ и распределение СМР

**Отклонённые варианты:**
- Текстовые вехи исходника («4 кв 2025») — сравнение даты с текстом всегда ложно, флаги строки CF1!4–5 были нулевыми

**Источники:** [S_GRK_51](https://www.consultant.ru/document/cons_doc_LAW_51040/570afc6feff03328459242886307d6aebe1ccb6b/)

**Исходный Excel:** `CF1!F4:AS5` → fix — D4, D5 ссылаются на текст ТЭПы!C7, C9

### `F.TIME.FLAG_PRESALE` — Флаг продаж по ДДУ (эскроу)
**Единица:** 0/1 · **Размерность:** p, t · **Статус:** verified
```
flag_ddu[p,t] = 1{ sales_start[p] <= date[t] < rnv_date[p] }
```
**Зависит от:** `TIME.MILESTONES`, `F.TIME.DATE`

**Почему так:** До РНВ продажи возможны только по ДДУ с эскроу (ст.15.4 214-ФЗ); старт — не раньше РНС (ст.51 ГрК) и публикации проектной декларации

**Отклонённые варианты:**
- Исходник: граница продаж по эскроу = «окончание ПФ» (CF1!D6), а не РНВ очереди; флаги AB8:AS8 перебиты нулями вручную

**Источники:** [S_214_ART15_4](https://www.consultant.ru/document/cons_doc_LAW_51038/57da6efc7ca337d428cf526d01e70925ce5bdcb0/), [S_GRK_51](https://www.consultant.ru/document/cons_doc_LAW_51040/570afc6feff03328459242886307d6aebe1ccb6b/), [S_GRK_55](https://www.consultant.ru/document/cons_doc_LAW_51040/935a657a2b5f7c7a6436cb756694bb2d649c7a00/)

**Исходный Excel:** `CF1!F8:AS9` → fix

### `F.TIME.FLAG_POST_RNV` — Флаг продаж по ДКП (после РНВ)
**Единица:** 0/1 · **Размерность:** p, t · **Статус:** verified
```
flag_dkp[p,t] = 1{ date[t] >= rnv_date[p] }
```
**Зависит от:** `TIME.MILESTONES`, `F.TIME.DATE`

**Почему так:** После РНВ нераспроданные помещения продаются по ДКП, деньги поступают застройщику напрямую

**Источники:** [S_GRK_55](https://www.consultant.ru/document/cons_doc_LAW_51040/935a657a2b5f7c7a6436cb756694bb2d649c7a00/)

**Исходный Excel:** `CF1!F9:AS9` → fix

### `F.TIME.FLAG_ESCROW_RELEASE` — Флаг месяца раскрытия эскроу очереди
**Единица:** 0/1 · **Размерность:** p, t · **Статус:** verified
```
flag_release[p,t] = 1{ t == month_index(rnv_date[p]) + TIME.ESCROW_RELEASE_LAG_M }
```
**Зависит от:** `TIME.MILESTONES`, `TIME.ESCROW_RELEASE_LAG_M`

**Почему так:** ч.6 ст.15.5 214-ФЗ — перечисление не позднее 10 рабочих дней после РНВ; раскрытие по каждой очереди отдельно

**Отклонённые варианты:**
- Раскрытие одной датой для всех очередей по «окончанию ПФ» (исходник) — завышает процентные расходы по ранним очередям

**Источники:** [S_214_ART15_5](https://www.consultant.ru/document/cons_doc_LAW_51038/7e20edcc51ba599c70fb328204e3ac1226e7d912/)

**Исходный Excel:** `CF1!F6:AS6` → fix — AB6 = 1 проставлено руками

## TEP

### `F.TEP.GFA_ABOVE` — ГНС наземной части в модели
**Единица:** м2 · **Размерность:** скаляр · **Статус:** verified
```
стадия «концепция»:      gfa_above = TEP.GFA_ABOVE
стадия «оценка участка»: gfa_above = TEP.GPZU_GFA_MAX, если суммарная поэтажная площадь указана в ГПЗУ/ПЗЗ;
                         иначе gfa_above = TEP.FOOTPRINT_AREA × TEP.AVG_FLOORS
ошибка, если TEP.FOOTPRINT_AREA > LAND.AREA × TEP.GPZU_COVERAGE_MAX
```
**Зависит от:** `GEN.PROJECT_STAGE`, `TEP.GFA_ABOVE`, `TEP.GPZU_GFA_MAX`, `TEP.FOOTPRINT_AREA`, `TEP.AVG_FLOORS`, `LAND.AREA`, `TEP.GPZU_COVERAGE_MAX`

**Почему так:** До концепции объём застройки ограничен предельными параметрами разрешённого строительства (ст.38 ГрК РФ): суммарная поэтажная площадь из ГПЗУ/ПЗЗ — прямой предел; если её нет — пятно застройки × средняя этажность, где пятно не больше участка × максимальный процент застройки. После концепции — ТЭП архитектора, который уже учитывает эти пределы

**Отклонённые варианты:**
- Ввод ГНС числом на стадии оценки без документа — не проверяется по ГПЗУ
- Молча ограничивать пятно MIN(пятно, участок × % застройки) — скрывает ошибку ввода; вместо этого ошибка с указанием превышения
- Одна «СПП (ГНС)» без указания стадии и документа (исходник ТЭПы!C19)

**Источники:** [S_GRK_38](https://www.consultant.ru/document/cons_doc_LAW_51040/312302f37ac9299771d2bf4f9b4bb797fb476948/), `S_PROJECT_DOCS`

**Исходный Excel:** `ТЭПы!C19` → fix — вводилось числом без указания, из ГПЗУ или из концепции

### `F.TEP.GFA_SPLIT` — ГНС жилой и нежилой части в модели
**Единица:** м2 · **Размерность:** скаляр · **Статус:** verified
```
стадия «концепция»: res_gfa = TEP.RES_GFA;  nonres_gfa = TEP.NONRES_GFA
стадия «оценка участка»:
  если ГПЗУ/ППТ задают разделение (TEP.RES_GFA и TEP.NONRES_GFA заполнены) — они же;
  иначе res_gfa = F.TEP.GFA_ABOVE × TEP.RES_GFA_SHARE;  nonres_gfa = F.TEP.GFA_ABOVE × (1 − TEP.RES_GFA_SHARE)
```
**Зависит от:** `GEN.PROJECT_STAGE`, `TEP.RES_GFA`, `TEP.NONRES_GFA`, `F.TEP.GFA_ABOVE`, `TEP.RES_GFA_SHARE`

**Почему так:** Жилая и нежилая части имеют разные коэффициенты продаваемой площади, разные продукты и разный НДС. Разделение берётся из документа, а при его отсутствии — одной долей, чтобы части в сумме давали ГНС наземную

**Отклонённые варианты:**
- Одну часть из документа, а вторую — долей: смешение документа и допущения, сумма может не совпасть с ГНС

**Источники:** [S_GRK_38](https://www.consultant.ru/document/cons_doc_LAW_51040/312302f37ac9299771d2bf4f9b4bb797fb476948/), `S_PROJECT_DOCS`, `S_COMPANY_ACTUALS`

**Исходный Excel:** `ТЭПы!C20:C21` → keep

### `F.TEP.APT_AREA` — Площадь квартир в модели (для продажи, по ДДУ)
**Единица:** м2 · **Размерность:** скаляр · **Статус:** verified
```
стадия «концепция»:      apt_area_total = TEP.APT_AREA
стадия «оценка участка»: apt_area_total = res_gfa × TEP.APT_EFFICIENCY   (res_gfa — из F.TEP.GFA_SPLIT)
```
**Зависит от:** `GEN.PROJECT_STAGE`, `TEP.APT_AREA`, `F.TEP.GFA_SPLIT`, `TEP.APT_EFFICIENCY`

**Почему так:** Площадь квартиры для продажи — площадь по ДДУ: общая площадь жилого помещения (ч.5 ст.15 ЖК РФ) плюс лоджии × 0,5, балконы × 0,3, террасы × 0,3, веранды × 1,0 (Приказ Минстроя № 854/пр); обмер — Приказ Росреестра № П/0393, приложение 2. До концепции площадь квартир получают из ГНС жилой части через коэффициент, подтверждённый фактом компании (уровень 4) или экспертом (уровень 5)

**Отклонённые варианты:**
- Ввод итоговой площади квартир на стадии оценки без коэффициента — непроверяемо
- Обратный расчёт коэффициента из заданной площади (исходник ТЭПы!D22 = C22/C20)
- Общая площадь по ЖК без лоджий/балконов — не совпадает с площадью в ДДУ, по которой считается выручка

**Источники:** [S_ZHK_15](https://www.consultant.ru/document/cons_doc_LAW_51057/3219ce4c6d0c49870efd7094d883d2d14184ce52/), [S_MINSTROY_854](https://base.garant.ru/71569280/), [S_ROSREESTR_P0393](https://www.consultant.ru/document/cons_doc_LAW_368160/), `S_PROJECT_DOCS`, `S_COMPANY_ACTUALS`

**Исходный Excel:** `ТЭПы!C22, ТЭПы!D22` → fix — площадь вбита числом, коэффициент получен обратным делением

### `F.TEP.COMM_AREA` — Площадь ПСН в модели
**Единица:** м2 · **Размерность:** скаляр · **Статус:** verified
```
стадия «концепция»:      comm_area = TEP.COMM_AREA
стадия «оценка участка»: comm_area = nonres_gfa × TEP.COMM_EFFICIENCY   (nonres_gfa — из F.TEP.GFA_SPLIT)
```
**Зависит от:** `GEN.PROJECT_STAGE`, `TEP.COMM_AREA`, `F.TEP.GFA_SPLIT`, `TEP.COMM_EFFICIENCY`

**Почему так:** Та же логика, что для квартир, со своим коэффициентом: у нежилой части иная доля продаваемой площади. Обмер — Приказ Росреестра № П/0393, приложение 2

**Отклонённые варианты:**
- Применять к нежилой части коэффициент квартир — разная планировочная эффективность
- Коэффициент 0,8 без назначения (исходник ТЭПы!D23)

**Источники:** [S_ROSREESTR_P0393](https://www.consultant.ru/document/cons_doc_LAW_368160/), `S_PROJECT_DOCS`, `S_COMPANY_ACTUALS`

**Исходный Excel:** `ТЭПы!C23` → keep

### `F.TEP.APT_COUNT` — Количество квартир по типу
**Единица:** шт · **Размерность:** k · **Статус:** verified
```
стадия «концепция»:      count[k] = TEP.APT_MIX.count[k]
стадия «оценка участка»: count[k] = FLOOR( TEP.APT_MIX.area_share[k] × apt_area_total / TEP.APT_MIX.avg_area[k] )
                         ошибка, если |Σ_k area_share[k] − 1| > 1e-9
```
**Зависит от:** `GEN.PROJECT_STAGE`, `TEP.APT_MIX`, `F.TEP.APT_AREA`

**Почему так:** Квартира — целое число. На стадии оценки квартирография задаётся долями площади и средней площадью типа, количество вычисляется; округление вниз гарантирует, что продаётся не больше площади, чем есть

**Отклонённые варианты:**
- ROUND — может дать площадь больше F.TEP.APT_AREA
- Дробное количество (исходник: дробные лоты ПСН 136,1 × 80 м², План продаж!43)
- Одновременный ввод количества и долей (исходник ТЭПы!C41:C43 и F41:F43) — расходятся

**Источники:** `S_PROJECT_DOCS`, `S_COMPANY_ACTUALS`

**Исходный Excel:** `ТЭПы!F41:F43` → keep

**Контрольный пример:** `{'input': {'area_share': 0.25, 'apt_area_total': 143560, 'avg_area': 35.108}, 'output': 1022}`

### `F.TEP.APT_TYPE_AREA` — Площадь квартир по типу
**Единица:** м2 · **Размерность:** k · **Статус:** verified
```
apt_area[k] = F.TEP.APT_COUNT[k] × TEP.APT_MIX.avg_area[k]
```
**Зависит от:** `F.TEP.APT_COUNT`, `TEP.APT_MIX`

**Почему так:** Количество и средняя площадь — первичные данные квартирографии; средняя площадь — по ДДУ, как F.TEP.APT_AREA

**Источники:** `S_PROJECT_DOCS`

**Исходный Excel:** `ТЭПы!E41:E43` → keep

**Контрольный пример:** `{'input': {'count': 961, 'avg_area': 35.108}, 'output': 33738.788}`

### `F.TEP.APT_SHARE` — Доля типа квартир (по количеству)
**Единица:** доля · **Размерность:** k · **Статус:** verified
```
apt_share[k] = F.TEP.APT_COUNT[k] / Σ_k F.TEP.APT_COUNT[k]
```
**Зависит от:** `F.TEP.APT_COUNT`

**Почему так:** Доля вычисляется — нельзя получить противоречие между долей и количеством

**Отклонённые варианты:**
- Ручной ввод долей параллельно с количеством (ТЭПы!C41:C43)

**Источники:** `S_PROJECT_DOCS`

**Исходный Excel:** `ТЭПы!C41:C43` → replace

### `F.TEP.APT_AREA_CHECK` — Сверка площади квартир: квартирография vs ТЭП
**Единица:** доля · **Размерность:** скаляр · **Статус:** verified
```
apt_diff_m2 = Σ_k apt_area[k] − apt_area_total;  apt_check = apt_diff_m2 / apt_area_total;  предупреждение «расхождение {apt_diff_m2} м² ({apt_check})», если |apt_check| > TEP.APT_AREA_TOLERANCE
```
**Зависит от:** `F.TEP.APT_TYPE_AREA`, `F.TEP.APT_AREA`, `TEP.APT_AREA_TOLERANCE`

**Почему так:** На стадии концепции площадь квартир есть дважды — итог ТЭП и сумма квартирографии; на стадии оценки сумма меньше итога из-за округления количества вниз. Расхождение больше порога должно быть видно с разницей в м² и %

**Отклонённые варианты:**
- Молча брать одно из двух чисел (в исходнике ТЭПы!E44 и ТЭПы!C22 введены независимо)

**Источники:** `S_PROJECT_DOCS`

**Исходный Excel:** `ТЭПы!E44 vs ТЭПы!C22` → new

### `F.TEP.PARKING_REQUIRED` — Требуемое количество машино-мест по нормативу региона
**Единица:** шт · **Размерность:** скаляр · **Статус:** needs_verification
```
parking_required = CEILING( Σ_k F.TEP.APT_COUNT[k] × norm(TEP.APT_MIX.avg_area[k]) ), norm() — из TEP.PARKING_NORM региона (Москва — ПП № 2118-ПП от 05.08.2026, СПб — ПП № 257 от 11.04.2017)
```
**Зависит от:** `F.TEP.APT_COUNT`, `TEP.APT_MIX`, `TEP.PARKING_NORM`

**Почему так:** Нормативы обеспеченности — обязательное требование РНГП; число мест определяет подземную часть и выручку

**Отклонённые варианты:**
- Вбитое число без документа (862 в исходнике при нормативе ≈ 2 785)

**Источники:** [S_MSK_PARKING_2118PP](https://mperspektiva.ru/topics/moskva-izmenila-normativy-obespechennosti-novostroek-parkovkami/), [S_SPB_NGP_257](https://base.garant.ru/43424438/), [S_SP_42_2026](https://www.nep.expert/news/sp-42-13330-2026/)

**Исходный Excel:** `ТЭПы!J41:J44` → fix — J44 перебит числом 862

**Контрольный пример:** `{'input': {'counts': [961, 720, 720], 'norms': [0.8, 1.2, 1.6]}, 'output': 2785}`

### `F.TEP.PARKING_COUNT` — Количество машино-мест в модели
**Единица:** шт · **Размерность:** скаляр · **Статус:** verified
```
parking_calc = MAX( F.TEP.PARKING_REQUIRED, TEP.PARKING_GPZU_COUNT ?? 0 )
parking = TEP.PARKING_COUNT_OVERRIDE ?? parking_calc      (override — только с вложенным документом)
предупреждение «ниже норматива, основание — документ», если override < F.TEP.PARKING_REQUIRED
```
**Зависит от:** `F.TEP.PARKING_REQUIRED`, `TEP.PARKING_GPZU_COUNT`, `TEP.PARKING_COUNT_OVERRIDE`

**Почему так:** Число мест — норматив региона или больше, если так требуют ГПЗУ/ППТ. Отклонение, в том числе меньше норматива, допустимо только по документу (ГПЗУ, ППТ, СТУ, решение органа)

**Отклонённые варианты:**
- Вбитое число поверх норматива без документа (исходник ТЭПы!C27, J44 = 862)
- Брать ГПЗУ/ППТ, даже если оно меньше норматива, — норматив обязателен; меньшее число — только по документу через override

**Источники:** `S_PROJECT_DOCS`, [S_MSK_PARKING_2118PP](https://mperspektiva.ru/topics/moskva-izmenila-normativy-obespechennosti-novostroek-parkovkami/), [S_SPB_NGP_257](https://base.garant.ru/43424438/)

**Исходный Excel:** `ТЭПы!C27` → fix

### `F.TEP.PARKING_SPACE_MIN_AREA` — Минимальная площадь машино-места
**Единица:** м2 · **Размерность:** скаляр · **Статус:** verified
```
parking_space_min = TEP.PARKING_SPACE_MIN_LENGTH × TEP.PARKING_SPACE_MIN_WIDTH
```
**Зависит от:** `TEP.PARKING_SPACE_MIN_LENGTH`, `TEP.PARKING_SPACE_MIN_WIDTH`

**Почему так:** Нижняя граница площади на одно машино-место: само место не меньше 5,3 × 2,5 м (Приказ Росреестра № П/0316); с проездами площадь не может быть меньше. Максимальный размер с 28.10.2021 не ограничен — верхней границы нет

**Отклонённые варианты:**
- Задавать 13,25 м² отдельным числом — теряется связь с размерами из приказа

**Источники:** [S_ROSREESTR_P0316](https://www.consultant.ru/law/hotdocs/70715.html)

**Контрольный пример:** `{'input': {'length': 5.3, 'width': 2.5}, 'output': 13.25}`

### `F.TEP.GFA_BELOW_EST` — Оценка подземной площади по числу машино-мест
**Единица:** м2 · **Размерность:** скаляр · **Статус:** verified
```
gfa_below_est = F.TEP.PARKING_COUNT × TEP.PARKING_AREA_PER_SPACE;  ошибка, если TEP.PARKING_AREA_PER_SPACE < F.TEP.PARKING_SPACE_MIN_AREA
```
**Зависит от:** `F.TEP.PARKING_COUNT`, `TEP.PARKING_AREA_PER_SPACE`, `F.TEP.PARKING_SPACE_MIN_AREA`

**Почему так:** Только стадия «Оценка участка»: подземной концепции ещё нет. Площадь на место с проездами — факт компании (уровень 4) или эксперт (уровень 5) с обоснованием и диапазоном; меньше минимальной площади самого места быть не может

**Источники:** `S_COMPANY_ACTUALS`, [S_ROSREESTR_P0316](https://www.consultant.ru/law/hotdocs/70715.html)

**Исходный Excel:** `ТЭПы!E49, ТЭПы!C34` → keep

**Контрольный пример:** `{'input': {'parking': 862, 'area_per_space': 40.945}, 'output': 35294.59}`

### `F.TEP.GFA_BELOW` — Площадь подземной части в модели
**Единица:** м2 · **Размерность:** скаляр · **Статус:** verified
```
стадия «концепция»:      gfa_below = TEP.GFA_BELOW
стадия «оценка участка»: gfa_below = F.TEP.GFA_BELOW_EST
```
**Зависит от:** `GEN.PROJECT_STAGE`, `TEP.GFA_BELOW`, `F.TEP.GFA_BELOW_EST`

**Почему так:** На стадии концепции подземная часть (паркинг, техпомещения) — из ТЭП архитектора; до неё — оценка через число машино-мест

**Отклонённые варианты:**
- Выводить подземную площадь из числа мест и после концепции (исходник ТЭПы!C34 = E49)

**Источники:** `S_PROJECT_DOCS`, `S_COMPANY_ACTUALS`

**Исходный Excel:** `ТЭПы!C34` → fix

### `F.TEP.GFA_TOTAL` — ГНС общая
**Единица:** м2 · **Размерность:** скаляр · **Статус:** verified
```
gfa_total = F.TEP.GFA_ABOVE + F.TEP.GFA_BELOW
```
**Зависит от:** `F.TEP.GFA_ABOVE`, `F.TEP.GFA_BELOW`

**Почему так:** Разделение на наземную и подземную части — у них разная стоимость СМР и разный охват НЦС

**Отклонённые варианты:**
- Одна «СПП (ГНС)» без разделения (исходник ТЭПы!C19)

**Источники:** `S_PROJECT_DOCS`, [S_NCS_TECHPART](https://meganorm.ru/mega_doc/norm/normativy/1/ntss_81-02-01-2023_ukrupnennye_normativy_tseny_stroitelstva.html)

**Исходный Excel:** `ТЭПы!C19` → fix

### `F.TEP.SALEABLE_AREA` — Продаваемая площадь (м²)
**Единица:** м2 · **Размерность:** скаляр · **Статус:** verified
```
saleable = Σ_k apt_area[k] + TEP.APART_AREA + comm_area + TEP.STORAGE_AREA;  машино-места — отдельно, в штуках (F.TEP.PARKING_COUNT), в м² не суммируются;  МОП, техпомещения и проезды паркинга не входят
```
**Зависит от:** `F.TEP.APT_TYPE_AREA`, `TEP.APART_AREA`, `F.TEP.COMM_AREA`, `TEP.STORAGE_AREA`

**Почему так:** Единое определение для всех проектов: продаваемая площадь = квартиры + апартаменты + ПСН + кладовые, каждая — по правилам обмера Росреестра (П/0393, приложение 2), квартиры — по ДДУ. Итоговым числом не вводится (параметра нет): сумма всегда раскладывается по продуктам и сходится с планом продаж

**Отклонённые варианты:**
- Ввод итогового числа (исходник ТЭПы!C35 = 149 281): не раскладывается по продуктам и расходится с суммой квартир и ПСН (153 882)
- Суммировать м² машино-мест с м² квартир (дашборд исходника — 189 177 м²)
- Включать МОП, техпомещения, проезды паркинга — они не продаются

**Источники:** [S_ROSREESTR_P0393](https://www.consultant.ru/document/cons_doc_LAW_368160/), [S_ZHK_15](https://www.consultant.ru/document/cons_doc_LAW_51057/3219ce4c6d0c49870efd7094d883d2d14184ce52/), [S_MINSTROY_854](https://base.garant.ru/71569280/), `S_PROJECT_DOCS`

**Исходный Excel:** `ТЭПы!C35, ТЭПы!E38, CF1!D11` → fix — C35 — число без расшифровки; в новой модели не используется, в режиме совместимости — только база перевода сумм бюджета в ставки на м²

### `F.TEP.LANDSCAPE_AREA` — Площадь благоустройства и её состав
**Единица:** м2 · **Размерность:** скаляр · **Статус:** verified
```
landscape = LAND.AREA × TEP.LANDSCAPE_SHARE; roads = landscape × TEP.ROAD_SHARE; green = landscape × TEP.GREEN_SHARE; ground_parking = landscape - roads - green
```
**Зависит от:** `LAND.AREA`, `TEP.LANDSCAPE_SHARE`, `TEP.ROAD_SHARE`, `TEP.GREEN_SHARE`

**Почему так:** База для статьи «Благоустройство»; проверка минимального озеленения по НГП

**Источники:** `S_PROJECT_DOCS`, [S_SP_42_2026](https://www.nep.expert/news/sp-42-13330-2026/)

**Исходный Excel:** `ТЭПы!C29:C33` → keep

## LAND

### `F.LAND.TAX_COEF` — Повышающий коэффициент земельного налога
**Единица:** коэф · **Размерность:** t · **Статус:** needs_verification
```
coef[t] = IF(NOT TAX.LAND_COEF_APPLY) 1 ELSE IF(years_since(land_acquired, date[t]) <= TIME.RNS_TO_RNV_TAX_YEARS) TAX.LAND_COEF_UP_TO_3Y ELSE TAX.LAND_COEF_OVER_3Y; действует до госрегистрации прав на объект (≈ handover_end последней очереди)
```
**Зависит от:** `TAX.LAND_COEF_APPLY`, `TAX.LAND_COEF_UP_TO_3Y`, `TAX.LAND_COEF_OVER_3Y`, `TIME.MILESTONES`

**Почему так:** п.15 ст.396 НК РФ; для участков > 300 млн руб. — позиция ФНС (письмо 25.08.2026)

**Отклонённые варианты:**
- Отсутствие коэффициентов (исходник) — налог занижен в 2–4 раза

**Источники:** [S_NK_396](https://www.consultant.ru/document/cons_doc_LAW_28165/9aa69b8504295f7fce85452466c428d2522a89c8/), [S_FNS_LANDCOEF_2026](https://www.garant.ru/products/ipo/prime/doc/414716619/)

### `F.LAND.TAX_OR_RENT` — Земельный налог или аренда, помесячно
**Единица:** руб · **Размерность:** t · **Статус:** needs_verification
```
IF LAND.TENURE = собственность: land_pay[t] = cad_value[year(t)] × TAX.LAND_RATE × F.LAND.TAX_COEF[t] / 12 × 1{land_acquired <= date[t] <= handover_end_last} IF LAND.TENURE = аренда: land_pay[t] = LAND.RENT_ANNUAL × index[year(t)] / 12 × 1{lease period} cad_value = LAND.CADASTRAL_VALUE_AFTER_VRI после смены ВРИ, иначе LAND.CADASTRAL_VALUE
```
**Зависит от:** `LAND.TENURE`, `LAND.CADASTRAL_VALUE`, `LAND.CADASTRAL_VALUE_AFTER_VRI`, `TAX.LAND_RATE`, `F.LAND.TAX_COEF`, `LAND.RENT_ANNUAL`

**Почему так:** Налог — от кадастровой стоимости (ст.390–391 НК РФ) по ставке муниципалитета; платёж только за период владения. Одна строка вместо двух в исходнике — нет двойного счёта

**Отклонённые варианты:**
- Равномерное деление итоговой суммы на 7,25 года (CF1!F24, F84) — игнорирует даты владения и коэффициенты
- Одновременно «Аренда/налог ЗУ» и «Налог на имущество» 0,2% (исходник)

**Источники:** [S_NK_394](https://www.consultant.ru/document/cons_doc_LAW_28165/fd2ac88b2311a6053a128cfa43aa07672e826213/), [S_NK_396](https://www.consultant.ru/document/cons_doc_LAW_28165/9aa69b8504295f7fce85452466c428d2522a89c8/), [S_FNS_RATES](https://www.nalog.gov.ru/rn77/service/tax/), [S_MSK_RENT_273PP](https://erzrf.ru/news/v-moskve-aktualizirovan-poryadok-vzimaniya-platy-za-arendu-i-za-izmeneniye-vida-razreshennogo-ispolzovaniya-zemelnogo-uchastka), [S_SPB_RENT_608](http://docs.cntd.ru/document/8462648)

**Исходный Excel:** `CF1!F24:AH24, CF1!F84:AH84, CF1!B84` → replace

**Контрольный пример:** `{'input': {'cad_value': 5834907660, 'rate': 0.015, 'coef': 2}, 'output_per_month': 14587269.15, 'note': 'ставка 1,5% — пример для участка > 300 млн; фактическая — по ОКТМО'}`

### `F.LAND.VRI_FEE` — Плата за изменение ВРИ
**Единица:** руб · **Размерность:** скаляр · **Статус:** needs_verification
```
vri_fee = region.vri_fee.exists ? region_formula(LAND.CADASTRAL_VALUE, LAND.CADASTRAL_VALUE_AFTER_VRI, ...) : 0;  Москва: от прироста кадастровой стоимости (КС2 − КС1) × коэффициент территории по приложению к ПП 593-ПП
```
**Зависит от:** `GEN.REGION_CODE`, `LAND.CADASTRAL_VALUE`, `LAND.CADASTRAL_VALUE_AFTER_VRI`

**Почему так:** Плата — региональная; привязка к приросту кадастровой стоимости делает её воспроизводимой

**Отклонённые варианты:**
- 5 000 руб/м² ГНС (исходник Бюджет!D22) — экспертно, без источника

**Источники:** [S_MSK_VRI_593PP](https://base.garant.ru/70457992/de40175ab12d04d68f792b5b742a18fc/)

**Исходный Excel:** `Бюджет!D22:F22` → replace

## CAPEX

### `F.CAPEX.ITEM_TOTAL` — Сумма статьи в ценах даты расценки
**Единица:** руб · **Размерность:** i · **Статус:** verified
```
item_total[i] = rate[i] × base_qty[i];  base_qty — значение параметра/формулы, указанной в capex_items.base (для «фикс» = 1)
```
**Зависит от:** `CAPEX.ITEMS`

**Почему так:** Сумма всегда выводится из ставки и объёма — любую цифру можно объяснить

**Отклонённые варианты:**
- Вбитая сумма + обратный расчёт расценки D = F/E (исходник Бюджет!D17:D49) — расценка не проверяема

**Источники:** `S_COMPANY_ACTUALS`, [S_NCS_2026_01](https://docs.cntd.ru/document/1316343087)

**Исходный Excel:** `Бюджет!D17:F49` → replace

### `F.CAPEX.INDEX` — Индекс пересчёта из цен даты расценки в цены месяца t
**Единица:** коэф · **Размерность:** i, t · **Статус:** verified
```
index[i,t] = Π по годам y от price_date[i] до date[t] (1 + CAPEX.COST_INDEX[y]) ^ (доля года y в интервале)
```
**Зависит от:** `CAPEX.COST_INDEX`, `CAPEX.ITEMS`

**Почему так:** Стройка длится 3–6 лет; без индексации затраты занижены. Индексы — прогноз МЭР / Минстроя

**Отклонённые варианты:**
- Отсутствие индексации (исходник)

**Источники:** [S_MINEC_SCENARIO_2027](https://www.garant.ru/products/ipo/prime/doc/414115625/), [S_FGISCS](https://fgiscs.minstroyrf.ru/)

### `F.CAPEX.SCHEDULE_WEIGHT` — Вес месяца в графике статьи
**Единица:** доля · **Размерность:** i, t · **Статус:** verified
```
uniform: w = 1/N в месяцах [from, to);  s_curve: x_t = (t - t_from + 1)/N, C(x) = 3x² − 2x³, w = C(x_t) − C(x_{t-1});  at_milestone: w = 1 в месяце вехи;  follow_smr: w = smr_cash[t] / Σ smr_cash;  follow_sales: w = sales_value[t] / Σ sales_value;  manual: ряд пользователя. Проверка Σ_t w = 1
```
**Зависит от:** `CAPEX.ITEMS`, `TIME.MILESTONES`

**Почему так:** График привязан к вехам: сдвиг РНС автоматически сдвигает затраты. S-кривая C(x) = 3x²−2x³ — симметричная кривая освоения с пиком в середине стройки

**Отклонённые варианты:**
- Ручные проценты по кварталам (исходник CF1 строки «Проставить темп,%») — не двигаются вместе с датами, суммы рядов ≠ 100% не контролируются

**Источники:** `S_EXPERT`

**Исходный Excel:** `CF1!F22:AS76 (строки «Проставить темп»)` → replace — ряды сохранены в tests/cases как manual для сверки

**Контрольный пример:** `{'input': {'rule': 's_curve', 'N': 4}, 'output': [0.15625, 0.34375, 0.34375, 0.15625]}`

### `F.CAPEX.ITEM_CASH` — Платёж по статье в месяце t (с НДС)
**Единица:** руб · **Размерность:** i, t · **Статус:** verified
```
item_cash[i,t] = item_total[i] × w[i,t] × index[i,t] × (vat_included[i] ? 1 : 1 + TAX.VAT_RATE × vat_applicable[i])
```
**Зависит от:** `F.CAPEX.ITEM_TOTAL`, `F.CAPEX.SCHEDULE_WEIGHT`, `F.CAPEX.INDEX`, `TAX.VAT_RATE`

**Почему так:** Денежный поток — с НДС (так платят подрядчикам); вычитаемая часть НДС возвращается в модуле TAX

**Отклонённые варианты:**
- Смешение сумм с НДС и без НДС в исходнике (не указано)

**Источники:** [S_NK_164](https://www.consultant.ru/document/cons_doc_LAW_28165/35cc6698564adc4507baa31c9cfdbb4f2516d068/)

**Исходный Excel:** `CF1!F21:AS76 (нечётные строки)` → fix

### `F.CAPEX.SMR_TOTAL` — Итого СМР (без НДС, в ценах расценок)
**Единица:** руб · **Размерность:** скаляр · **Статус:** verified
```
smr_total = Σ item_total[i] для group ∈ {СМР, сети, благоустройство, соцобъекты}
```
**Зависит от:** `F.CAPEX.ITEM_TOTAL`

**Почему так:** База для процентных статей (техзаказчик, стройконтроль, резерв)

**Отклонённые варианты:**
- База техзаказчика — выручка (исходник Бюджет!E43)

**Источники:** [S_MINSTROY_297](https://www.consultant.ru/document/cons_doc_LAW_357554/)

**Исходный Excel:** `Бюджет!F30` → fix

### `F.CAPEX.NCS_BENCH` — Контроль СМР надземной части по НЦС
**Единица:** руб · **Размерность:** скаляр · **Статус:** needs_verification
```
ncs_bench = NCS_per_m2(класс, этажность) × F.TEP.GFA_ABOVE × region.ncs_k_per × К_рег × К_с × Ипр;  deviation = item_total[SMR_ABOVE] / ncs_bench − 1; |deviation| > CAPEX.NCS_BENCH_TOLERANCE → требуется обоснование
```
**Зависит от:** `F.TEP.GFA_ABOVE`, `GEN.REGION_CODE`, `CAPEX.NCS_BENCH_TOLERANCE`

**Почему так:** Формула пересчёта НЦС по п.40 техчасти: С = [(НЦС×М×Кпер×Кпер/зон×Крег×Кс)+Зр]×Ипр+НДС. В НЦС уже учтены ПИР, стройконтроль, резерв — при сравнении их нужно добавить к расценке компании

**Источники:** [S_NCS_2026_01](https://docs.cntd.ru/document/1316343087), [S_NCS_TECHPART](https://meganorm.ru/mega_doc/norm/normativy/1/ntss_81-02-01-2023_ukrupnennye_normativy_tseny_stroitelstva.html)

### `F.CAPEX.TOTAL` — Итого бюджет
**Единица:** руб · **Размерность:** скаляр · **Статус:** verified
```
capex_total = Σ_i Σ_t item_cash[i,t];  проверка: = Σ бюджет по группам (CHECK.BUDGET_EQ_CF)
```
**Зависит от:** `F.CAPEX.ITEM_CASH`

**Почему так:** Итог бюджета и итог денежного потока — одно число

**Отклонённые варианты:**
- Бюджет и CF1 расходятся (исходник: УДС 535,6 млн есть в бюджете, нет в CF1)

**Источники:** `S_EXPERT`

**Исходный Excel:** `Бюджет!F59, CF1!C18` → fix

## SALES

### `F.SALES.SOLD_AREA` — Продано в месяце, м² (шт для м/м)
**Единица:** м2 · **Размерность:** k, p, t · **Статус:** verified
```
sold[k,t] = MIN( pace[k,t], remaining[k,t-1] ) × 1{ flag_ddu[p,t] OR flag_dkp[p,t] };  remaining[k,t] = stock[k] − Σ_{τ<=t} sold[k,τ]
```
**Зависит от:** `SALES.PACE`, `SALES.PRODUCTS`, `F.TIME.FLAG_PRESALE`, `F.TIME.FLAG_POST_RNV`

**Почему так:** Нельзя продать больше, чем построено; продажи — только в разрешённый период

**Отклонённые варианты:**
- Темпы без ограничения остатком (исходник)

**Источники:** [S_EISZHS_SALES](https://xn--80az8a.xn--d1aqf.xn--p1ai/%D0%B0%D0%BD%D0%B0%D0%BB%D0%B8%D1%82%D0%B8%D0%BA%D0%B0/%D1%80%D0%B5%D0%B0%D0%BB%D0%B8%D0%B7%D0%B0%D1%86%D0%B8%D1%8F_%D1%81%D1%82%D1%80%D0%BE%D1%8F%D1%89%D0%B8%D1%85%D1%81%D1%8F_%D0%BA%D0%B2%D0%B0%D1%80%D1%82%D0%B8%D1%80)

**Исходный Excel:** `План продаж!E28:AU54` → fix

### `F.SALES.PRICE` — Цена 1 м² в месяце t
**Единица:** руб/м2 · **Размерность:** k, t · **Статус:** verified
```
price[k,t] = start_price[k] × Π_{τ<=t} (1 + g_month[τ]) × stage_factor(progress[p,t]);  g_month = (1 + SALES.PRICE_MARKET_GROWTH[year])^(1/12) − 1;  stage_factor — произведение надбавок SALES.PRICE_STAGE_UPLIFT пройденных стадий; progress = накопленные СМР / СМР итого по очереди
```
**Зависит от:** `SALES.PRODUCTS`, `SALES.PRICE_MARKET_GROWTH`, `SALES.PRICE_STAGE_UPLIFT`, `F.CAPEX.ITEM_CASH`

**Значение за прошлый месяц (t−1):** `F.CAPEX.ITEM_CASH`

**Почему так:** Цена растёт по двум причинам: рынок (инфляция цен) и снижение риска по мере готовности. Раздельно — чтобы сценарии были осмысленны

**Отклонённые варианты:**
- Константа 2%/квартал на весь срок (исходник) — за 29 кварталов +77%, без связи со стройкой и рынком

**Источники:** [S_EISZHS_SERIES](https://xn--80az8a.xn--d1aqf.xn--p1ai/%D0%B0%D0%BD%D0%B0%D0%BB%D0%B8%D1%82%D0%B8%D0%BA%D0%B0/%D1%81%D1%82%D0%B0%D1%82%D0%B8%D1%81%D1%82%D0%B8%D1%87%D0%B5%D1%81%D0%BA%D0%B8%D0%B5_%D1%80%D1%8F%D0%B4%D1%8B), [S_MINEC_SCENARIO_2027](https://www.garant.ru/products/ipo/prime/doc/414115625/)

**Исходный Excel:** `План продаж!E31:AM56` → replace

### `F.SALES.CONTRACT_VALUE` — Стоимость договоров, заключённых в месяце t
**Единица:** руб · **Размерность:** k, p, t · **Статус:** verified
```
value[k,t] = sold[k,t] × price[k,t]
```
**Зависит от:** `F.SALES.SOLD_AREA`, `F.SALES.PRICE`

**Почему так:** Выручка по подписанным договорам (с НДС, если продукт облагается)

**Источники:** `S_EXPERT`

**Исходный Excel:** `План продаж!E27, E32, E37, E42, E47, E52` → keep

### `F.SALES.CASH_IN` — Поступления от покупателей по графику оплат
**Единица:** руб · **Размерность:** k, p, t · **Статус:** verified
```
cash_in[t] = Σ_{τ<=t} value[τ] × ( (mortgage_share + full_share) × 1{t=τ} + installment_share × ( down × 1{t=τ} + (1−down)/n × 1{τ < t <= τ+n} ) ), n = installment_months
```
**Зависит от:** `F.SALES.CONTRACT_VALUE`, `SALES.PAYMENT_MIX`

**Почему так:** Ипотека и 100% оплата поступают в месяц сделки; рассрочка — первоначальный взнос + равные платежи. Проверка: сумма долей = 1

**Отклонённые варианты:**
- Структура оплат на листе «Эскроу» не связана с CF1 и не сходится к 100% (исходник 0,7+0,1+0)

**Источники:** [S_CBR_MORTGAGE](https://www.cbr.ru/statistics/bank_sector/mortgage/)

**Исходный Excel:** `Эскроу!C5:AL33` → replace

### `F.SALES.WAVG_PRICE` — Средневзвешенная цена продаж
**Единица:** руб/м2 · **Размерность:** k · **Статус:** verified
```
wavg_price[k] = Σ_t value[k,t] / Σ_t sold[k,t]
```
**Зависит от:** `F.SALES.CONTRACT_VALUE`, `F.SALES.SOLD_AREA`

**Почему так:** Средняя цена должна учитывать объёмы продаж в каждом периоде

**Отклонённые варианты:**
- AVERAGE цен по периодам (исходник План продаж!D31, D66) — период без продаж весит как пиковый

**Источники:** `S_EXPERT`

**Исходный Excel:** `План продаж!D31, D36, D41, D66` → replace

### `F.SALES.END_PRICE` — Цена в конце продаж
**Единица:** руб/м2 · **Размерность:** k · **Статус:** verified
```
end_price[k] = price[k, t_last_sale[k]], t_last_sale — последний месяц с sold > 0
```
**Зависит от:** `F.SALES.PRICE`, `F.SALES.SOLD_AREA`

**Почему так:** Фактический последний месяц продаж

**Отклонённые варианты:**
- Фиксированный столбец S (исходник План продаж!D65)

**Источники:** `S_EXPERT`

**Исходный Excel:** `План продаж!D65` → replace

### `F.SALES.REVENUE_TOTAL` — Выручка итого (с НДС) и без НДС
**Единица:** руб · **Размерность:** скаляр · **Статус:** verified
```
revenue_gross = Σ_{k,t} value[k,t];  revenue_net = revenue_gross − Σ output_vat
```
**Зависит от:** `F.SALES.CONTRACT_VALUE`, `F.TAX.OUTPUT_VAT`

**Почему так:** Итог плана продаж = итог выручки в CF (CHECK.REVENUE_EQ_CF)

**Отклонённые варианты:**
- Исходник: план продаж 118,13 млрд, CF1 117,51 млрд — продажи после столбца AH не перенесены (−616 млн)

**Источники:** `S_EXPERT`

**Исходный Excel:** `План продаж!D25, Бюджет!F12, CF1!C15` → fix

## ESCROW

### `F.ESC.DEPOSIT` — Пополнение эскроу
**Единица:** руб · **Размерность:** p, t · **Статус:** verified
```
deposit[p,t] = Σ_k cash_in[k,p,t] по договорам ДДУ (заключённым при flag_ddu)
```
**Зависит от:** `F.SALES.CASH_IN`, `F.TIME.FLAG_PRESALE`

**Почему так:** Все платежи по ДДУ, включая рассрочку, поступают на эскроу (ст.15.4 214-ФЗ)

**Источники:** [S_214_ART15_4](https://www.consultant.ru/document/cons_doc_LAW_51038/57da6efc7ca337d428cf526d01e70925ce5bdcb0/)

**Исходный Excel:** `CF1!F92:AS92` → keep

### `F.ESC.BALANCE` — Остаток на эскроу на конец месяца
**Единица:** руб · **Размерность:** p, t · **Статус:** verified
```
esc_bal[p,t] = esc_bal[p,t-1] + deposit[p,t] − release[p,t];  release[p,t] = flag_release[p,t] × (esc_bal[p,t-1] + deposit[p,t]) + 1{t > t_release[p]} × deposit[p,t]
```
**Зависит от:** `F.ESC.DEPOSIT`, `F.TIME.FLAG_ESCROW_RELEASE`

**Почему так:** Раскрытие по очереди; платежи рассрочки после раскрытия проходят «транзитом» и раскрываются в том же месяце

**Отклонённые варианты:**
- Один общий счёт на все очереди (исходник)

**Источники:** [S_214_ART15_5](https://www.consultant.ru/document/cons_doc_LAW_51038/7e20edcc51ba599c70fb328204e3ac1226e7d912/)

**Исходный Excel:** `CF1!F91:AS94` → fix

### `F.ESC.COVERAGE` — Покрытие долга остатками эскроу
**Единица:** доля · **Размерность:** t · **Статус:** verified
```
coverage[t] = Σ_p esc_bal_avg[p,t] × (1 − FIN.ESCROW_RESERVE_RATE) / (debt_avg[t] + accrued_interest[t-1]),  esc_bal_avg = (bal[t-1]+bal[t])/2
```
**Зависит от:** `F.ESC.BALANCE`, `F.FIN.DEBT`, `F.FIN.INTEREST`

**Значение за прошлый месяц (t−1):** `F.FIN.DEBT`, `F.FIN.INTEREST`

**Почему так:** Коэффициент К1 для ставки ПФ; средние остатки за период — как в методике исходника и кредитных договорах

**Источники:** `S_BANK_TERMSHEET`, [S_CBR_PF_STATS](https://www.cbr.ru/statistics/bank_sector/equity_const_financing/)

**Исходный Excel:** `CF1!F120:AS122` → keep

## FIN

### `F.FIN.EQUITY_REQUIRED` — Требуемое собственное участие
**Единица:** руб · **Размерность:** скаляр · **Статус:** needs_verification
```
equity_req = FIN.EQUITY_SHARE × capex_total (включая стоимость участка)
```
**Зависит от:** `FIN.EQUITY_SHARE`, `F.CAPEX.TOTAL`

**Почему так:** Банк требует внести собственные средства ДО первой выборки кредита; земля обычно засчитывается в собственное участие

**Отклонённые варианты:**
- 10% от расходов каждого периода (исходник CF1!G132)

**Источники:** [S_214_ART3](https://www.consultant.ru/document/cons_doc_LAW_51038/24a7b7f2b0571ac53f7b789c337316109c23d1a7/), `S_BANK_TERMSHEET`

**Исходный Excel:** `CF1!D132:AS132, Бюджет!F65` → fix

### `F.FIN.FUNDING_NEED` — Потребность в финансировании месяца
**Единица:** руб · **Размерность:** t · **Статус:** verified
```
need[t] = MAX(0, capex_cash[t] + opex_cash[t] + taxes_paid[t] + fees[t] − dkp_cash[t] − released_to_developer[t] − cash_bal[t-1])
```
**Зависит от:** `F.CAPEX.ITEM_CASH`, `F.TAX.PAYMENTS`, `F.ESC.BALANCE`

**Значение за прошлый месяц (t−1):** `F.TAX.PAYMENTS`

**Почему так:** Сначала используются собственные поступления, затем собственный капитал, затем кредит

**Источники:** `S_EXPERT`

**Исходный Excel:** `CF1!F98` → fix

### `F.FIN.EQUITY_IN` — Взнос собственного капитала
**Единица:** руб · **Размерность:** t · **Статус:** verified
```
equity_in[t] = MIN(need[t], equity_req − Σ_{τ<t} equity_in[τ]) пока накопленный взнос < equity_req; после первой выборки — только на покрытие дефицита вне лимита (cash gap)
```
**Зависит от:** `F.FIN.FUNDING_NEED`, `F.FIN.EQUITY_REQUIRED`

**Почему так:** Очерёдность: собственные средства → кредит

**Источники:** `S_BANK_TERMSHEET`

**Исходный Excel:** `CF1!F132:AS132` → replace

### `F.FIN.LIMIT` — Лимит проектного финансирования
**Единица:** руб · **Размерность:** скаляр · **Статус:** verified
```
limit = capex_total_financeable − equity_req  (без капитализированных процентов — они учитываются отдельно как PIK)
```
**Зависит от:** `F.CAPEX.TOTAL`, `F.FIN.EQUITY_REQUIRED`

**Почему так:** Лимит покрывает бюджет за вычетом собственного участия; проценты капитализируются и гасятся при раскрытии эскроу — как в исходнике (строки 107–110)

**Отклонённые варианты:**
- Лимит = СМР + ПИР + участок + коммерческие + налоги (исходник Бюджет!F67) — включает участок, уже оплаченный собственными средствами

**Источники:** `S_BANK_TERMSHEET`

**Исходный Excel:** `Бюджет!F67, CF1!C98` → fix

### `F.FIN.DRAW` — Выборка кредита
**Единица:** руб · **Размерность:** t · **Статус:** verified
```
draw[t] = MIN(need[t] − equity_in[t], limit − Σ_{τ<t} draw[τ]) × 1{ Σ equity_in >= equity_req } × 1{ t < t_release_last }
```
**Зависит от:** `F.FIN.FUNDING_NEED`, `F.FIN.EQUITY_IN`, `F.FIN.LIMIT`

**Почему так:** Выборка после внесения собственного участия и в пределах лимита

**Источники:** `S_BANK_TERMSHEET`

**Исходный Excel:** `CF1!F98:AS98` → fix — в исходнике зависела от флага эскроу F8, который перебит нулями

### `F.FIN.RATE` — Текущая ставка ПФ
**Единица:** %годовых · **Размерность:** t · **Статус:** verified
```
K1[t] = MIN(coverage[t-1], 1);  K2[t] = 1 − K1[t];  base_rate[t] = FIN.KEY_RATE_PATH[t] + FIN.RATE_BASE_SPREAD;  SkR[t] = MAX((esc − (debt+accr))/(debt+accr) × FIN.RATE_DISCOUNT_COEF, 0);  rate[t] = MAX(FIN.RATE_PREFERENTIAL × K1 + base_rate × K2 − SkR, FIN.RATE_MIN)
```
**Зависит от:** `F.ESC.COVERAGE`, `FIN.KEY_RATE_PATH`, `FIN.RATE_BASE_SPREAD`, `FIN.RATE_PREFERENTIAL`, `FIN.RATE_DISCOUNT_COEF`, `FIN.RATE_MIN`

**Значение за прошлый месяц (t−1):** `F.ESC.COVERAGE`

**Почему так:** Рыночная механика ПФ с эскроу: льготная ставка на покрытую часть, базовая (ключевая + спред) на непокрытую. Покрытие берётся за прошлый месяц — нет циклической ссылки

**Отклонённые варианты:**
- Фиксированная базовая ставка 20% при ключевой 14,25% (исходник) — сценарий ставки ЦБ не влияет на проект

**Источники:** `S_BANK_TERMSHEET`, [S_CBR_PF_STATS](https://www.cbr.ru/statistics/bank_sector/equity_const_financing/), [S_CBR_KEYRATE](https://www.cbr.ru/hd_base/keyrate/)

**Исходный Excel:** `CF1!F115:AS125` → fix

**Контрольный пример:** `{'input': {'pref': 0.05, 'key': 0.14, 'spread': 0.0575, 'coverage': 0.4, 'skr': 0, 'min': 0.001}, 'output': 0.1385}`

### `F.FIN.INTEREST` — Проценты начисленные (капитализируемые)
**Единица:** руб · **Размерность:** t · **Статус:** verified
```
interest[t] = ( (debt[t-1] + (debt[t-1] + draw[t]))/2 + accrued[t-1] ) × rate[t] × days[t] / 365;  accrued[t] = accrued[t-1] + interest[t] − interest_paid[t]
```
**Зависит от:** `F.FIN.RATE`, `F.FIN.DRAW`, `F.TIME.DAYS`

**Почему так:** Методика исходника (строка 107) сохранена: проценты на средний долг + начисленные ранее (сложный процент при капитализации)

**Источники:** `S_BANK_TERMSHEET`

**Исходный Excel:** `CF1!F107:AS110` → keep

### `F.FIN.REPAYMENT` — Погашение долга и процентов
**Единица:** руб · **Размерность:** t · **Статус:** verified
```
from_escrow[t] = MIN(Σ_p release[p,t], debt[t-1] + draw[t] + accrued[t]) — сначала проценты, затем тело;  from_dkp[t] = MIN(dkp_cash[t] (100% sweep), остаток долга) после t_release;  debt[t] = debt[t-1] + draw[t] − principal_repaid[t]
```
**Зависит от:** `F.ESC.BALANCE`, `F.FIN.DRAW`, `F.FIN.INTEREST`, `F.SALES.CASH_IN`

**Почему так:** ч.6 ст.15.5 214-ФЗ позволяет направлять средства эскроу в погашение кредита; остаток долга гасится из ДКП

**Отклонённые варианты:**
- Погашение по залоговой стоимости (исходник строки 102–105) не доведено до формул

**Источники:** [S_214_ART15_5](https://www.consultant.ru/document/cons_doc_LAW_51038/7e20edcc51ba599c70fb328204e3ac1226e7d912/), `S_BANK_TERMSHEET`

**Исходный Excel:** `CF1!F99:AS106, F108:AS109` → fix — AA109:AB109 ссылаются на соседний столбец (AB85 вместо AA85)

### `F.FIN.DEBT` — Остаток основного долга
**Единица:** руб · **Размерность:** t · **Статус:** verified
```
debt[t] = debt[t-1] + draw[t] − principal_repaid[t];  debt_avg[t] = (debt[t-1] + debt[t-1] + draw[t]) / 2
```
**Зависит от:** `F.FIN.DRAW`, `F.FIN.REPAYMENT`

**Значение за прошлый месяц (t−1):** `F.FIN.REPAYMENT`

**Почему так:** Баланс долга BoP → EoP

**Источники:** `S_BANK_TERMSHEET`

**Исходный Excel:** `CF1!F97:AS97, F106:AS106` → keep

### `F.FIN.FEES` — Комиссии банка
**Единица:** руб · **Размерность:** t · **Статус:** verified
```
fee_arr[t] = FIN.FEE_ARRANGEMENT × limit × 1{t = t_first_draw};  fee_commit[t] = FIN.FEE_COMMIT × (limit − Σ draw) × days[t]/365 × 1{availability}
```
**Зависит от:** `F.FIN.LIMIT`, `F.FIN.DRAW`, `FIN.FEE_ARRANGEMENT`, `FIN.FEE_COMMITMENT`

**Почему так:** Стандартные комиссии кредитного договора

**Отклонённые варианты:**
- «Банковские расходы 15% от ПФ» (исходник Бюджет!F68) — дублирует проценты

**Источники:** `S_BANK_TERMSHEET`

**Исходный Excel:** `CF1!F111:AS112, Бюджет!D68:F68` → fix

### `F.FIN.EFFECTIVE_RATE` — Эффективная стоимость кредита
**Единица:** %годовых · **Размерность:** скаляр · **Статус:** verified
```
eff_rate = XIRR( bank_flow[t] = draw[t] − repaid_principal[t] − interest_paid[t] − fees[t] (с позиции банка знак обратный), date[t] )
```
**Зависит от:** `F.FIN.DRAW`, `F.FIN.REPAYMENT`, `F.FIN.FEES`

**Почему так:** XIRR по датам — корректен при неравных периодах

**Отклонённые варианты:**
- (1+IRR квартальный)^4 − 1 (исходник D128) — допустимо только при равных периодах

**Источники:** `S_EXPERT`

**Исходный Excel:** `CF1!D128` → fix

## TAX

### `F.TAX.OUTPUT_VAT` — НДС с реализации
**Единица:** руб · **Размерность:** k, t · **Статус:** needs_verification
```
output_vat[k,t] = value[k,t] × TAX.VAT_RATE / (1 + TAX.VAT_RATE) × taxable(k, channel(t));  taxable — из TAX.VAT_REGIME
```
**Зависит от:** `F.SALES.CONTRACT_VALUE`, `TAX.VAT_RATE`, `TAX.VAT_REGIME`

**Почему так:** Цена в договоре включает НДС → выделение 22/122. Облагаются только продукты/каналы из таблицы режима

**Отклонённые варианты:**
- 22% «сверху» от цены с НДС по всей выручке ПСН+ММ (исходник План продаж!E61)

**Источники:** [S_NK_149](https://www.consultant.ru/document/cons_doc_LAW_28165/c8ebcedc9ddce9d959d6c520c3b0d602f71e8e12/), [S_NK_164](https://www.consultant.ru/document/cons_doc_LAW_28165/35cc6698564adc4507baa31c9cfdbb4f2516d068/), [S_MINFIN_VAT_DDU_2023](https://www.garant.ru/products/ipo/prime/doc/407693240/)

**Исходный Excel:** `План продаж!D60:AM61` → fix

**Контрольный пример:** `{'input': {'value': 1220, 'rate': 0.22}, 'output': 220}`

### `F.TAX.INPUT_VAT_SHARE` — Доля входящего НДС к вычету
**Единица:** доля · **Размерность:** скаляр · **Статус:** needs_verification
```
input_share = TAX.INPUT_VAT_RECOVERABLE ?? (Σ облагаемая выручка без НДС / Σ вся выручка без НДС)
```
**Зависит от:** `TAX.INPUT_VAT_RECOVERABLE`, `F.TAX.OUTPUT_VAT`, `F.SALES.REVENUE_TOTAL`

**Почему так:** Раздельный учёт (п.4 ст.170 НК РФ): НДС по освобождённым операциям включается в стоимость

**Источники:** [S_NK_149](https://www.consultant.ru/document/cons_doc_LAW_28165/c8ebcedc9ddce9d959d6c520c3b0d602f71e8e12/), [S_MINFIN_VAT_DDU_2023](https://www.garant.ru/products/ipo/prime/doc/407693240/)

### `F.TAX.VAT_PAYABLE` — НДС к уплате / возмещению
**Единица:** руб · **Размерность:** quarter · **Статус:** needs_verification
```
vat_q = Σ_{t∈q} output_vat[t] − Σ_{t∈q} input_vat[t] × input_share;  уплата — равными долями в 3 месяца, следующих за кварталом (vat_q > 0); возмещение — через 3 месяца после квартала (vat_q < 0)
```
**Зависит от:** `F.TAX.OUTPUT_VAT`, `F.CAPEX.ITEM_CASH`, `F.TAX.INPUT_VAT_SHARE`

**Почему так:** Налоговый период по НДС — квартал; порядок уплаты — ст.174 НК РФ

**Отклонённые варианты:**
- 5 млн в квартал вручную (исходник CF1!M85:AA85)

**Источники:** [S_NK_164](https://www.consultant.ru/document/cons_doc_LAW_28165/35cc6698564adc4507baa31c9cfdbb4f2516d068/), [S_NK_174](https://www.consultant.ru/document/cons_doc_LAW_28165/)

**Исходный Excel:** `CF1!F85:AS85, Бюджет!F54` → replace

### `F.TAX.PROFIT_BASE` — Налоговая база по налогу на прибыль
**Единица:** руб · **Размерность:** t · **Статус:** needs_verification
```
ДДУ: economy[p] = Σ средства ДДУ очереди p без НДС − затраты на передаваемые объекты очереди p (распределение общих затрат пропорционально продаваемой площади); признаётся в месяце handover_end[p]. ДКП: profit_dkp[t] = выручка ДКП без НДС − себестоимость проданных площадей (средняя себестоимость м² × проданная площадь) в месяце продажи. Прочие расходы, не относящиеся к целевому финансированию, — в периоде возникновения. base[t] = economy × 1{t = handover_end} + profit_dkp[t] − other_expenses[t]
```
**Зависит от:** `F.SALES.CONTRACT_VALUE`, `F.CAPEX.TOTAL`, `F.FIN.INTEREST`, `TIME.MILESTONES`

**Значение за прошлый месяц (t−1):** `F.FIN.INTEREST`

**Почему так:** Средства дольщиков — целевое финансирование (пп.14 п.1 ст.251 НК РФ); финрез (экономия) — внереализационный доход в периоде исполнения всех обязательств по ДДУ (письмо Минфина от 28.07.2026 № 03-03-08/65074)

**Отклонённые варианты:**
- 5,7% от выручки (исходник Бюджет!M55)
- (выручка − расходы − собственный капитал) × 25% (исходник Бюджет!J55:K55) — капитал не уменьшает базу

**Источники:** [S_NK_251](https://www.consultant.ru/document/cons_doc_LAW_28165/850d11e08b0cb09a2318af00f2f0aff805d39c85/), [S_MINFIN_PROFIT_DDU_2026](https://www.garant.ru/products/ipo/prime/doc/414657525/)

**Исходный Excel:** `Бюджет!F55, J55:M55, CF1!AB86` → replace

### `F.TAX.PROFIT_TAX` — Налог на прибыль с учётом переноса убытков
**Единица:** руб · **Размерность:** year · **Статус:** needs_verification
```
loss_used[y] = MIN(loss_cf[y-1], MAX(base[y],0) × TAX.LOSS_CARRYFORWARD_LIMIT);  tax[y] = (MAX(base[y],0) − loss_used[y]) × TAX.PROFIT_RATE;  loss_cf[y] = loss_cf[y-1] − loss_used[y] + MAX(−base[y],0);  уплата — в марте следующего года (упрощение; авансовые платежи — опция)
```
**Зависит от:** `F.TAX.PROFIT_BASE`, `TAX.PROFIT_RATE`, `TAX.LOSS_CARRYFORWARD_LIMIT`

**Почему так:** Ставка 25% (ст.284), ограничение переноса убытков (ст.283)

**Источники:** [S_NK_284](https://www.consultant.ru/document/cons_doc_LAW_28165/eb9180fc785448d58fe76ef323fb67d1832b9363/), [S_NK_283](https://www.consultant.ru/document/cons_doc_LAW_28165/f07c38898fd7af4a54b1c6d33e01f23cc2dae757/)

**Исходный Excel:** `CF1!AB86` → replace — весь налог одной суммой в квартале AB

### `F.TAX.PAYMENTS` — Налоговые платежи месяца
**Единица:** руб · **Размерность:** t · **Статус:** needs_verification
```
taxes_paid[t] = vat_paid[t] − vat_refund[t] + profit_tax_paid[t] + land_pay[t]
```
**Зависит от:** `F.TAX.VAT_PAYABLE`, `F.TAX.PROFIT_TAX`, `F.LAND.TAX_OR_RENT`

**Почему так:** Единая строка налогов в CF

**Отклонённые варианты:**
- Налог на имущество 0,2% кадастровой стоимости земли (исходник CF1!84): объект незавершённого строительства и квартиры-товары налогом на имущество по кадастровой стоимости у застройщика в общем случае не облагаются; земля облагается земельным налогом

**Источники:** [S_NK_394](https://www.consultant.ru/document/cons_doc_LAW_28165/fd2ac88b2311a6053a128cfa43aa07672e826213/)

**Исходный Excel:** `CF1!F81:AS86` → replace

## CF

### `F.CF.CFADS` — Денежный поток проекта до финансирования
**Единица:** руб · **Размерность:** t · **Статус:** verified
```
cfads[t] = Σ_p release[p,t] + dkp_cash[t] − Σ_i item_cash[i,t] − taxes_paid[t]
```
**Зависит от:** `F.ESC.BALANCE`, `F.SALES.CASH_IN`, `F.CAPEX.ITEM_CASH`, `F.TAX.PAYMENTS`

**Почему так:** Деньги дольщиков доступны застройщику только после раскрытия эскроу — поэтому в CFADS входит раскрытие, а не продажи

**Отклонённые варианты:**
- Выручка по дате продажи (исходник CF1!F133 = F15 − F18 − F81) — завышает CF до РНВ

**Источники:** [S_214_ART15_5](https://www.consultant.ru/document/cons_doc_LAW_51038/7e20edcc51ba599c70fb328204e3ac1226e7d912/)

**Исходный Excel:** `CF1!F133:AS133` → fix

### `F.CF.FCFE` — Денежный поток акционера
**Единица:** руб · **Размерность:** t · **Статус:** verified
```
fcfe[t] = cfads[t] + draw[t] − principal_repaid[t] − interest_paid[t] − fees[t];  отрицательные значения = взносы акционера (equity_in + cash gap), положительные = распределения
```
**Зависит от:** `F.CF.CFADS`, `F.FIN.DRAW`, `F.FIN.REPAYMENT`, `F.FIN.FEES`

**Почему так:** Стандартное определение FCFE

**Отклонённые варианты:**
- FCFE = ΔCash − upfront equity (исходник CF1!F138) — зависит от остатка кэша

**Источники:** `S_EXPERT`

**Исходный Excel:** `CF1!F138:AS138` → replace

### `F.CF.CASH_BALANCE` — Остаток денежных средств
**Единица:** руб · **Размерность:** t · **Статус:** verified
```
cash[t] = cash[t-1] + fcfe[t] + equity_in[t] − distributions[t];  CHECK: cash[t] >= 0, иначе cash_gap[t] = −cash[t] покрывается акционером
```
**Зависит от:** `F.CF.FCFE`, `F.FIN.EQUITY_IN`

**Почему так:** Разрыв ликвидности должен быть виден явно

**Источники:** `S_EXPERT`

**Исходный Excel:** `CF1!F134:AS137` → fix

## KPI

### `F.KPI.DISCOUNT_RATE` — Ставка дисконтирования
**Единица:** %годовых · **Размерность:** скаляр · **Статус:** verified
```
r = VAL.RISK_FREE + VAL.EQUITY_PREMIUM
```
**Зависит от:** `VAL.RISK_FREE`, `VAL.EQUITY_PREMIUM`

**Почему так:** Кумулятивный подход: доходность ОФЗ + премия за риск; каждая часть имеет свой источник

**Отклонённые варианты:**
- Cost of equity 25% одной цифрой (исходник CF1!D139)

**Источники:** [S_CBR_ZCYC](https://www.cbr.ru/hd_base/zcyc_params/), `S_EXPERT`

**Исходный Excel:** `CF1!D139` → replace

### `F.KPI.NPV` — NPV проекта и акционера
**Единица:** руб · **Размерность:** скаляр · **Статус:** verified
```
npv_project = Σ_t cfads[t] / (1+r)^((date[t] − GEN.VALUATION_DATE)/365);  npv_equity = то же для fcfe[t]
```
**Зависит от:** `F.CF.CFADS`, `F.CF.FCFE`, `F.KPI.DISCOUNT_RATE`, `GEN.VALUATION_DATE`

**Почему так:** Дисконтирование по фактическим датам (XNPV)

**Отклонённые варианты:**
- NPV = финрез (исходник Бюджет!F63) — без учёта времени

**Источники:** `S_EXPERT`

**Исходный Excel:** `Бюджет!F63, Dashboard!C57, CF1!D148` → replace

### `F.KPI.IRR` — IRR проекта и акционера
**Единица:** %годовых · **Размерность:** скаляр · **Статус:** verified
```
irr_project = XIRR(cfads[t], date[t]);  irr_equity = XIRR(fcfe[t], date[t])
```
**Зависит от:** `F.CF.CFADS`, `F.CF.FCFE`

**Почему так:** IRR — ставка, обнуляющая NPV

**Отклонённые варианты:**
- «IRR» = финрез / затраты (исходник Бюджет!F64, Dashboard!C44) — это ROI
- «IRR продаж» = прибыль / выручка (Dashboard!C43) — это маржа

**Источники:** `S_EXPERT`

**Исходный Excel:** `Бюджет!F64, Dashboard!C43:C45, CF1!C143` → replace

### `F.KPI.MARGIN` — Прибыль и маржа
**Единица:** руб / доля · **Размерность:** скаляр · **Статус:** verified
```
gross_profit = revenue_net − capex_total_net;  net_profit = gross_profit − Σ interest − Σ fees − Σ profit_tax;  gross_margin = gross_profit / revenue_net;  net_margin = net_profit / revenue_net;  ROI = net_profit / (capex_total_net + Σ interest)
```
**Зависит от:** `F.SALES.REVENUE_TOTAL`, `F.CAPEX.TOTAL`, `F.FIN.INTEREST`, `F.TAX.PROFIT_TAX`

**Почему так:** Недисконтированные показатели — с корректными названиями

**Источники:** `S_EXPERT`

**Исходный Excel:** `Бюджет!F61:H61, Dashboard!C33:C42` → fix

### `F.KPI.COST_PER_M2` — Себестоимость 1 м² продаваемой площади и наценка
**Единица:** руб/м2 · **Размерность:** скаляр · **Статус:** verified
```
cost_m2 = (capex_total_net + Σ interest) / F.TEP.SALEABLE_AREA;  markup = wavg_price_all / cost_m2 − 1
```
**Зависит от:** `F.CAPEX.TOTAL`, `F.FIN.INTEREST`, `F.TEP.SALEABLE_AREA`, `F.SALES.WAVG_PRICE`

**Почему так:** Делитель — вся продаваемая площадь

**Отклонённые варианты:**
- Деление на площадь только квартир типа 1 (исходник Бюджет!F69 → 2,96 млн руб/м², наценка −80%)

**Источники:** `S_EXPERT`

**Исходный Excel:** `Бюджет!F69:F71, Dashboard!C50` → fix

### `F.KPI.PEAK_EQUITY` — Пиковая потребность в капитале и срок окупаемости
**Единица:** руб / дата · **Размерность:** скаляр · **Статус:** verified
```
peak_equity = −MIN_t Σ_{τ<=t} fcfe[τ];  payback_date = первая date[t] после пика, где Σ_{τ<=t} fcfe[τ] >= 0
```
**Зависит от:** `F.CF.FCFE`

**Почему так:** Ключевые для инвестора показатели ликвидности

**Источники:** `S_EXPERT`

### `F.KPI.LTC_LTV` — LTC и LTV
**Единица:** доля · **Размерность:** t · **Статус:** verified
```
LTC[t] = (debt[t] + accrued[t]) / Σ_{τ<=t} capex_cash[τ];  LTV[t] = (debt[t] + accrued[t]) / market_value_unsold[t], market_value_unsold = остаток площадей × price[t]
```
**Зависит от:** `F.FIN.DEBT`, `F.FIN.INTEREST`, `F.CAPEX.ITEM_CASH`, `F.SALES.PRICE`

**Почему так:** LTV — к рыночной стоимости активов (остаток площадей + эскроу), а не к дисконтированной стоимости капитала

**Отклонённые варианты:**
- LTV к «Market Value of Asset» из DCF по cost of equity (исходник CF1!F144) — зависит от выбранной ставки, max = 0 из-за неработающих флагов

**Источники:** `S_BANK_TERMSHEET`

**Исходный Excel:** `CF1!F144:AS145, Dashboard!C46` → replace

### `F.KPI.LLCR` — LLCR (коэффициент покрытия долга за срок кредита)
**Единица:** коэф · **Размерность:** t · **Статус:** verified
```
LLCR[t] = Σ_{τ>=t}^{t_maturity} cfads[τ] / (1 + rate_avg)^((date[τ]−date[t])/365) / (debt[t] + accrued[t])
```
**Зависит от:** `F.CF.CFADS`, `F.FIN.RATE`, `F.FIN.DEBT`

**Почему так:** Общепринятое определение в проектном финансировании: приведённый CFADS за оставшийся срок кредита / остаток долга. Минимальное значение по периодам — ковенант

**Отклонённые варианты:**
- NPV(=FCFE) / проценты (исходник CF1!D150)
- (Выручка − налоги) / (выборка + %) (исходник CF1!D155)
- Две разные формулы в Dashboard!C51 и C52 с одинаковым смыслом

**Источники:** `S_EXPERT`

**Исходный Excel:** `CF1!D148:D155, Dashboard!C51:C64` → replace

### `F.KPI.UNFORECASTED_REVENUE` — Выручка после РНВ (продажи по ДКП)
**Единица:** руб / доля · **Размерность:** скаляр · **Статус:** verified
```
dkp_revenue = Σ_t value[t] × flag_dkp[t];  dkp_share = dkp_revenue / revenue_gross
```
**Зависит от:** `F.SALES.CONTRACT_VALUE`, `F.TIME.FLAG_POST_RNV`

**Почему так:** Показатель риска: доля выручки, не участвующей в покрытии кредита эскроу

**Отклонённые варианты:**
- Сумма фиксированных столбцов Q:S (исходник Бюджет!E73)

**Источники:** `S_EXPERT`

**Исходный Excel:** `Бюджет!C73:E75` → replace

## CHECK

### `F.CHECK.ALL` — Свод проверок
**Единица:** bool · **Размерность:** скаляр · **Статус:** verified
```
PAYMENT_MIX_SUM   : |mortgage + full + installment − 1| < 1e-9
SCHEDULE_SUM      : для каждой статьи |Σ_t w − 1| < 1e-9
SOLD_LE_STOCK     : Σ_t sold[k,t] <= stock[k]
UNSOLD_AT_END     : остаток > 0 в последнем месяце → предупреждение
REVENUE_EQ_CF     : Σ план продаж = Σ поступления (эскроу + ДКП) + дебиторка на конец
BUDGET_EQ_CF      : Σ бюджет по статьям = Σ затрат в CF
ESCROW_NONNEG     : esc_bal >= 0
DEBT_LE_LIMIT     : Σ draw <= limit
DEBT_REPAID       : debt[T] + accrued[T] = 0
CASH_NONNEG       : cash[t] >= 0 (иначе cash gap)
SOURCES_PRESENT   : у каждого параметра и формулы есть source_ids, у level 5 — автор и диапазон
PARKING_NORM      : parking >= MAX(parking_required, TEP.PARKING_GPZU_COUNT) или override с вложенным документом
NCS_DEVIATION     : |deviation| <= tolerance или есть обоснование
APT_AREA_MATCH    : |apt_check| <= TEP.APT_AREA_TOLERANCE (иначе предупреждение с разницей в м² и %)
STAGE_INPUTS      : для стадии GEN.PROJECT_STAGE заполнены обязательные входы раздела TEP с документом
FOOTPRINT_LIMIT   : TEP.FOOTPRINT_AREA <= LAND.AREA × TEP.GPZU_COVERAGE_MAX
APT_MIX_SHARE_SUM : стадия «оценка участка»: |Σ_k area_share[k] − 1| < 1e-9
PARKING_AREA_MIN  : TEP.PARKING_AREA_PER_SPACE >= F.TEP.PARKING_SPACE_MIN_AREA
```

**Почему так:** Ни одна из этих ошибок исходника не должна повториться незаметно

**Источники:** `S_EXPERT`
