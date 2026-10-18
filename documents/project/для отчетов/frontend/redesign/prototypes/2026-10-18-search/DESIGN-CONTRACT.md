# Изолированные прототипы /search — контракт

Только локальный визуальный прототип, не код приложения. Не изменять apps/web, API, зависимости, Git или чужие CSS. Общая разметка и JS одинаковы для всех трёх концепций. Один CSS theme на направление.

## Структура

`dist/campus.html`, `editorial.html`, `orbit.html`: body class `concept-campus|concept-editorial|concept-orbit`, `data-theme=light|dark` на html. Общие `base.css`, `app.js`; отдельные `themes/campus.css`, `editorial.css`, `orbit.css`. Тема auto через JS устанавливает data-theme из matchMedia. query `?theme=dark&components=1` допустим.

DOM (root создаёт его в app.js; стилизовать без изменения порядка semantic DOM):

```text
.app
  header.topbar
    a.brand > svg.brand-mark + span STUDLY
    nav.desktop-nav > button.nav-item [data-nav] + .is-active
    .header-actions > .demo-label, button.publish-btn, button.icon-btn.theme-toggle
  main.workspace
    section.intro > .eyebrow, h1.intro-title, p.intro-copy, .intro-art (CSS-only, decorative)
    form.search-form > svg.icon, input.search-input, button.icon-btn.clear-search, button.search-submit
    nav.category-list > button.category-chip [aria-pressed] (Все услуги, Учёба, Дизайн, Код, Медиа)
    .catalog-layout
      aside.filters-panel > .filter-head, .filter-group > label + input/select, button.reset-btn
      section.results
        .results-toolbar > h2.results-title + .results-count, .toolbar-actions > button.filter-toggle + select.sort-select
        .active-filters
        .service-grid > article.service-card[data-kind=math|design|code|english|video|career]
          .service-cover > .cover-label + .cover-symbol + button.favorite-btn[aria-pressed]
          .card-body > .card-category, h3.service-title, p.service-description
            .performer > span.avatar + .performer-copy > strong.performer-name + span.performer-specialty
            .card-bottom > .price-block > strong.price + span.price-unit, span.delivery
            button.detail-btn
        .empty-state [hidden]
    section.components-panel [hidden] > .component-heading + .button-states + .card-specimen
  nav.bottom-nav > button.bottom-item [data-nav] + .is-active, icon + span
  dialog.filter-dialog > form.filter-form (mobile filters, same fields)
  dialog.detail-dialog > .dialog-inner
  .toast[role=status]
```

Основные CSS tokens на `.concept-*` и `[data-theme=dark] .concept-*`: `--bg`, `--surface`, `--surface-2`, `--text`, `--muted`, `--line`, `--soft`, `--accent`, `--accent-text`, `--accent-soft`, `--accent-ink`, `--cover-a`, `--cover-a-ink`, `--cover-b`, `--cover-b-ink`, `--radius`, `--shadow`. Основной синий #3547B8 сохраняется. Accent control background blue #3547B8 + white text in both themes; dark selected text может использовать светлую пару через accent-ink. `--muted` обычный текст ≥4.5:1, normal text>=4.5. Focus outline>=3:1. Не менять исходный path логотипа; в dark version только fillwhite как existing inverse.

Base задаёт рабочую сетку: max-width1240, desktop header/main + aside220 + grid3col; <=1100 grid2col; <=700 mobile .topbar компактный, filters-panel hidden, filter-toggle visible, bottom-nav fixed с env safearea; grid1col. Свой CSS может менять grid/card composition с сохранением функциональности. Цель mobile390x844, desktop1440x1000, без горизонтального overflow320+. Типографика системная без сети, не более2семейств. Никаких постоянных animations/blur/WebGL/3D dependencies. Reduced Motion must end immediately. Кнопки≥44px; bottom nav≥56px. `.icon` width20 height20, SVG currentColor. System-safe fonts, все названия на русском.

## Содержимое — общее

6 явных демонстрационных услуг: математика900₽/60мин, презентация1500₽/проект, Python1200₽/60мин, английский800₽/45мин, видеомонтаж1800₽/ролик, резюме700₽/разбор. Все имена вымышлены, нет придуманных рейтингов/верификаций. Desktop/mobile общие поиски, categories, maxprice, deadline, sort, favorite, details; никакого network/localStorage/API.

Стили отдельной концепции должны быть существенно отличимы не только цветом: радиусы, плотность, типографика, обложки, границы, hero-композиция. При этом все три сохраняют быстрый и привычный поиск.
