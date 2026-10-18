"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import services from "@/data/services";
import { catalogClient, demoMode, money } from "@/lib/api/catalog";
import { ApiError, apiErrorMessage, pagePath } from "@/lib/api/client";
import { useApiResource } from "@/components/catalog/ApiState";
import { SearchFilters } from "@/components/catalog/SearchFilters";
import { CampusServiceCard } from "@/components/studly/CampusServiceCard";
import { Icon } from "@/components/studly/Icon";
import { Button, StatusPanel } from "@/components/studly/primitives";
import {
  filterSearchServices, normalizeSearch, searchRequestQuery, validatePriceRange,
  type DurationFilter, type SortOption,
} from "@/lib/catalog/search";

const categories = [...new Set(services.map(service => service.category))];

function SearchSkeleton() {
  return (
    <StatusPanel kind="loading" title="Загружаем услуги…">
      <div className="skeleton-grid" aria-hidden="true">
        {[0, 1, 2].map(index => <div className="skeleton-card" key={index} />)}
      </div>
    </StatusPanel>
  );
}

function SearchContent({ initialQuery }: { initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [duration, setDuration] = useState<DurationFilter>("any");
  const [rating47, setRating47] = useState(false);
  const [sort, setSort] = useState<SortOption>("relevance");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterDialog = useRef<HTMLDialogElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState({ search: "", query: "" });
  const normalizedQuery = normalizeSearch(query);
  const requestQuery = searchRequestQuery(query, page);
  const load = useCallback((signal: AbortSignal) => demoMode ? Promise.resolve(null) : catalogClient.list(requestQuery, signal), [requestQuery]);
  const { data, error, retry } = useApiResource(requestQuery, load);

  const sourceServices = useMemo(() => demoMode ? services : (data?.results ?? []).map(service => ({
    id: service.id, title: service.title, description: service.description, price: money(service.price_amount, service.currency),
    priceNumber: Number(service.price_amount), seller: service.performer.name, rating: "", category: "", profileId: service.performer.id,
    duration: `${service.duration_days} дн.`, durationDays: service.duration_days, included: service.included, isDemo: service.is_demo,
  })), [data]);

  const values = useMemo(() => ({ query, category, minPrice, maxPrice, duration, rating47, sort }), [query, category, minPrice, maxPrice, duration, rating47, sort]);
  const price = validatePriceRange(minPrice, maxPrice);
  const hasActiveFilters = Boolean(category || minPrice || maxPrice || duration !== "any" || rating47 || sort !== "relevance");
  const filteredServices = useMemo(() => filterSearchServices(sourceServices, values, demoMode), [sourceServices, values]);

  // A modal must never leave the desktop page inert after a viewport change.
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 701px)");
    const closeOnDesktop = () => {
      if (desktop.matches && filterDialog.current?.open) filterDialog.current.close();
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  const updateQuery = (value: string) => {
    setQuery(value);
    setPage({ search: "", query: "" });
  };
  const resetFilters = () => {
    setCategory("");
    setMinPrice("");
    setMaxPrice("");
    setDuration("any");
    setRating47(false);
    setSort("relevance");
  };
  const filterFields = {
    values, isDemo: demoMode, onMinPrice: setMinPrice, onMaxPrice: setMaxPrice,
    onDuration: setDuration, onRating: setRating47,
  };
  const openFilters = () => {
    filterDialog.current?.showModal();
    setFiltersOpen(true);
  };

  return (
    <>
      <section className="intro" aria-labelledby="search-title">
        <p className="eyebrow">Свои люди. Нужные навыки.</p>
        <h1 className="intro-title" id="search-title">Найди своего<br /><span>исполнителя.</span></h1>
        <p className="intro-copy">От учёбы до творчества — нужная помощь рядом.</p>
        <div className="intro-art" aria-hidden="true" />
      </section>

      <form className="search-form" role="search" onSubmit={event => { event.preventDefault(); if (window.matchMedia("(pointer: coarse)").matches) searchInput.current?.blur(); }}>
        <Icon name="search" />
        <label className="sr-only" htmlFor="service-search">Поиск услуг и исполнителей</label>
        <input ref={searchInput} className="search-input" id="service-search" type="search" value={query}
          onChange={event => updateQuery(event.target.value)} placeholder="Что тебе нужно?" autoComplete="off" enterKeyHint="search" />
        {query && <button className="icon-btn clear-search" type="button" aria-label="Очистить поиск" onClick={() => { updateQuery(""); searchInput.current?.focus(); }}><Icon name="close" /></button>}
        <Button type="submit" className="search-submit" aria-label="Найти услуги"><span className="button-label">Найти</span><Icon name="arrow" /></Button>
      </form>

      <nav className="category-list" aria-label="Категории услуг">
        <button className="category-chip" type="button" aria-pressed={!category} onClick={() => setCategory("")}><Icon name="grid" />Все услуги</button>
        {demoMode ? categories.map(item => (
          <button key={item} className="category-chip" type="button" aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>
        )) : <span className="filter-note">Категории пока не подключены к API.</span>}
      </nav>

      <div className="catalog-layout">
        <aside className="filters-panel" aria-label="Фильтры услуг">
          <div className="filter-head">Фильтры<button type="button" className="reset-btn" disabled={!hasActiveFilters} onClick={resetFilters}>Сбросить</button></div>
          <SearchFilters {...filterFields} />
          <p className="filter-note">{demoMode ? "Демонстрационные предложения. Имена и данные вымышлены." : "Цена, срок и сортировка применяются к текущей странице."}</p>
        </aside>

        <section className="results" aria-labelledby="results-title" aria-busy={!demoMode && !data && !error}>
          <div className="results-toolbar">
            <div>
              <h2 className="results-title" id="results-title">Услуги</h2>
              <span className="results-count" aria-live="polite">
                {demoMode ? `Найдено: ${filteredServices.length}` : data ? `Показано: ${filteredServices.length} на этой странице · Всего: ${data.count}` : error ? "Не удалось загрузить услуги" : "Загрузка…"}
              </span>
            </div>
            <div className="toolbar-actions">
              <button type="button" className="filter-toggle" onClick={openFilters} aria-label="Открыть фильтры" aria-haspopup="dialog" aria-expanded={filtersOpen} aria-controls="search-filter-dialog"><Icon name="filter" /><span>Фильтры</span></button>
              <label className="sr-only" htmlFor="search-sort">Сортировка услуг</label>
              <select className="sort-select" id="search-sort" value={sort} onChange={event => setSort(event.target.value as SortOption)}>
                <option value="relevance">По релевантности</option><option value="priceAsc">Сначала дешевле</option>
                <option value="priceDesc">Сначала дороже</option><option value="rating" disabled={!demoMode}>По рейтингу</option>
                <option value="duration">Сначала быстрее</option>
              </select>
            </div>
          </div>

          {!demoMode && <p className="catalog-notice">Цена, срок и сортировка применяются к текущей странице. Рейтинг пока недоступен.</p>}
          <div className="active-filters">
            {category && <button type="button" onClick={() => setCategory("")} aria-label={`Убрать категорию ${category}`}>{category}<Icon name="close" /></button>}
            {(minPrice || maxPrice) && <button type="button" onClick={() => { setMinPrice(""); setMaxPrice(""); }}>Цена: {minPrice || "0"}–{maxPrice || "∞"} ₽<span className="sr-only"> — убрать фильтр</span><Icon name="close" /></button>}
            {duration !== "any" && <button type="button" onClick={() => setDuration("any")}>До {duration} {duration === "1" ? "дня" : "дней"}<span className="sr-only"> — убрать фильтр</span><Icon name="close" /></button>}
            {rating47 && <button type="button" onClick={() => setRating47(false)}>Рейтинг 4,7+<span className="sr-only"> — убрать фильтр</span><Icon name="close" /></button>}
          </div>

          {!demoMode && !data ? error ? (
            <StatusPanel kind="error" title="Не удалось загрузить услуги"
              action={!(error instanceof ApiError && error.status === 404) ? <Button onClick={retry}>Повторить загрузку</Button> : undefined}>
              <p>{apiErrorMessage(error)}</p>
            </StatusPanel>
          ) : <SearchSkeleton /> : filteredServices.length ? (
            <div className="service-grid">
              {filteredServices.map(service => <CampusServiceCard key={service.id} id={service.id} title={service.title}
                description={service.description} category={service.category} price={service.price} seller={service.seller}
                profileId={service.profileId} duration={service.duration} rating={demoMode ? service.rating : undefined}
                isDemo={demoMode || ("isDemo" in service && Boolean(service.isDemo))} />)}
            </div>
          ) : (
            <StatusPanel kind="empty" title="Пока ничего не нашлось" action={
              <Button onClick={() => { updateQuery(""); resetFilters(); }}>Сбросить поиск и фильтры</Button>
            }><p>Попробуй другой запрос или убери часть фильтров.</p></StatusPanel>
          )}

          {!demoMode && data && (data.previous || data.next) && (
            <nav className="catalog-pagination" aria-label="Страницы каталога">
              {data.previous && <Button variant="secondary" onClick={() => setPage({ search: normalizedQuery, query: pagePath(data.previous!, "services/").split("?")[1] ?? "" })}>Назад</Button>}
              {data.next && <Button variant="secondary" onClick={() => setPage({ search: normalizedQuery, query: pagePath(data.next!, "services/").split("?")[1] ?? "" })}>Далее</Button>}
            </nav>
          )}
        </section>
      </div>

      <dialog className="filter-dialog" id="search-filter-dialog" ref={filterDialog} aria-labelledby="search-filter-title" onClose={() => setFiltersOpen(false)}>
        <form className="filter-form" onSubmit={event => { event.preventDefault(); if (!price.error) filterDialog.current?.close(); }}>
          <div className="filter-dialog-head"><h2 id="search-filter-title">Фильтры</h2><button type="button" className="icon-btn" aria-label="Закрыть фильтры" onClick={() => filterDialog.current?.close()}><Icon name="close" /></button></div>
          <SearchFilters {...filterFields} />
          {!demoMode && <p className="filter-note">Цена и срок применяются к текущей странице.</p>}
          <div className="dialog-actions">
            <Button type="button" variant="secondary" onClick={resetFilters} disabled={!hasActiveFilters}>Сбросить</Button>
            <Button type="submit" className="filter-apply" disabled={Boolean(price.error)}>Показать услуги</Button>
          </div>
        </form>
      </dialog>
    </>
  );
}

function SearchWithQuery() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  return <SearchContent key={query} initialQuery={query} />;
}

export default function SearchPage() {
  return <Suspense fallback={<SearchSkeleton />}><SearchWithQuery /></Suspense>;
}
