"use client";
import Link from "next/link";
import { PageHeading } from "@/components/studly/PageHeading";
import { Icon } from "@/components/studly/Icon";
import { demoMode } from "@/lib/api/catalog";

import {
  useMemo,
  useState,
  use,
} from "react";
import ServiceCard from "@/components/ServiceCard";
import BackButton from "@/components/BackButton";
import { useDemoCatalog } from "@/features/demo-workspace/catalog";

type Props = {
  params: Promise<{
    slug: string;
  }>;
};

type DurationFilter =
  | "any"
  | "1"
  | "3"
  | "7";

type SortOption =
  | "relevance"
  | "priceAsc"
  | "priceDesc"
  | "rating"
  | "duration";

const categoryNames: Record<
  string,
  string
> = {
  programming: "💻 Программирование",
  courseworks: "🎓 Помощь с курсовыми",
  homework: "📚 Помощь с заданиями",
  tutoring: "👨‍🏫 Репетиторство",
  engineering: "📐 Инженерная графика",
  presentations: "📊 Презентации",
  reports: "📝 Рефераты и отчёты",
  video: "🎬 Видеомонтаж",
};

const categoryNamesWithoutEmoji: Record<
  string,
  string
> = {
  programming: "Программирование",
  courseworks: "Помощь с курсовыми",
  homework: "Помощь с заданиями",
  tutoring: "Репетиторство",
  engineering: "Инженерная графика",
  presentations: "Презентации",
  reports: "Рефераты и отчёты",
  video: "Видеомонтаж",
};

function DemoCategoryPage({
  params,
}: Props) {
  const services = useDemoCatalog();
  const { slug } = use(params);

  const [query, setQuery] =
    useState("");

  const [filtersOpen, setFiltersOpen] =
    useState(false);

  const [minPrice, setMinPrice] =
    useState("");

  const [maxPrice, setMaxPrice] =
    useState("");

  const [duration, setDuration] =
    useState<DurationFilter>("any");

  const [rating47, setRating47] =
    useState(false);

  const [sort, setSort] =
    useState<SortOption>("relevance");

  const title = slug
    ? categoryNames[slug] ?? "Категория"
    : "Категория";

  const categoryName = slug
    ? categoryNamesWithoutEmoji[slug]
    : undefined;

  const categoryServices = useMemo(() => {
    if (!demoMode || !categoryName) {
      return [];
    }

    return services.filter(
      (service) =>
        service.category === categoryName
    );
  }, [categoryName, services]);

  const normalizedQuery =
    query.trim().toLowerCase();

  const minPriceValue =
    minPrice.trim() === "" ? null : Number(minPrice);
  const maxPriceValue =
    maxPrice.trim() === "" ? null : Number(maxPrice);
  const hasInvalidMinPrice =
    minPriceValue !== null &&
    (!Number.isFinite(minPriceValue) || minPriceValue < 0);
  const hasInvalidMaxPrice =
    maxPriceValue !== null &&
    (!Number.isFinite(maxPriceValue) || maxPriceValue < 0);
  const hasInvalidPriceRange =
    !hasInvalidMinPrice &&
    !hasInvalidMaxPrice &&
    minPriceValue !== null &&
    maxPriceValue !== null &&
    minPriceValue > maxPriceValue;
  const priceError = hasInvalidMinPrice || hasInvalidMaxPrice
    ? "Цена не может быть отрицательной."
    : hasInvalidPriceRange
      ? "Минимальная цена не может быть выше максимальной."
      : "";

  const hasActiveFilters =
    minPrice !== "" ||
    maxPrice !== "" ||
    duration !== "any" ||
    rating47 ||
    sort !== "relevance";

  const filteredServices = useMemo(() => {
    let result = [...categoryServices];

    // Поиск внутри категории
    if (normalizedQuery) {
      result = result.filter((service) => {
        const searchableText = [
          service.title,
          service.seller,
          service.description,
          service.category,
        ]
          .join(" ")
          .toLowerCase();

        return searchableText.includes(
          normalizedQuery
        );
      });
    }

    // Минимальная цена
    if (!priceError && minPriceValue !== null) {
      result = result.filter(
        (service) => service.priceNumber >= minPriceValue
      );
    }

    if (!priceError && maxPriceValue !== null) {
      result = result.filter(
        (service) => service.priceNumber <= maxPriceValue
      );
    }

    // Срок
    if (duration !== "any") {
      const maxDays = Number(duration);

      result = result.filter(
        (service) =>
          service.durationDays <= maxDays
      );
    }

    // Рейтинг 4.7+
    if (rating47) {
      result = result.filter(
        (service) =>
          Number.parseFloat(service.rating) >=
          4.7
      );
    }

    // Сортировка
    if (sort === "priceAsc") {
      result.sort(
        (a, b) =>
          a.priceNumber - b.priceNumber
      );
    }

    if (sort === "priceDesc") {
      result.sort(
        (a, b) =>
          b.priceNumber - a.priceNumber
      );
    }

    if (sort === "rating") {
      result.sort(
        (a, b) =>
          Number.parseFloat(b.rating) -
          Number.parseFloat(a.rating)
      );
    }

    if (sort === "duration") {
      result.sort(
        (a, b) =>
          a.durationDays - b.durationDays
      );
    }

    if (sort === "relevance" && normalizedQuery) {
      result.sort((a, b) => {
        const aText = [a.title, a.seller, a.description, a.category]
          .join(" ")
          .toLowerCase();
        const bText = [b.title, b.seller, b.description, b.category]
          .join(" ")
          .toLowerCase();
        return aText.indexOf(normalizedQuery) - bText.indexOf(normalizedQuery);
      });
    }

    return result;
  }, [
    categoryServices,
    normalizedQuery,
    minPriceValue,
    maxPriceValue,
    priceError,
    duration,
    rating47,
    sort,
  ]);

  const resetFilters = () => {
    setMinPrice("");
    setMaxPrice("");
    setDuration("any");
    setRating47(false);
    setSort("relevance");
  };

  return <div className="campus-page"><BackButton /><PageHeading title={title.replace(/^[^А-Яа-яA-Za-z]+/, "")}>Предложения в выбранной категории.</PageHeading>
    <div className="category-search">
      <label htmlFor="category-query" className="sr-only">Поиск в категории</label>
      <input id="category-query" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Поиск в категории…" />
      {query && <button className="icon-btn" type="button" onClick={() => setQuery("")} aria-label="Очистить поиск"><Icon name="close" /></button>}
      <button className="icon-btn" type="button" onClick={() => setFiltersOpen(value => !value)} aria-label={filtersOpen ? "Закрыть фильтры" : "Открыть фильтры"} aria-expanded={filtersOpen} aria-controls="category-filters"><Icon name={filtersOpen ? "close" : "filter"} /></button>
    </div>
    {filtersOpen && <section id="category-filters" className="page-panel category-filters" aria-label="Фильтры категории">
      <fieldset className="category-filter"><legend>Цена</legend><div className="category-price">
        <input type="number" min="0" value={minPrice} aria-invalid={hasInvalidMinPrice || hasInvalidPriceRange} aria-label="Минимальная цена" onChange={event => setMinPrice(event.target.value)} placeholder="От ₽" />
        <input type="number" min="0" value={maxPrice} aria-invalid={hasInvalidMaxPrice || hasInvalidPriceRange} aria-label="Максимальная цена" onChange={event => setMaxPrice(event.target.value)} placeholder="До ₽" />
      </div>{priceError && <p className="page-error" role="alert">{priceError}</p>}</fieldset>
      <fieldset className="category-filter"><legend>Срок выполнения</legend>{[["1", "До 1 дня"], ["3", "До 3 дней"], ["7", "До 7 дней"], ["any", "Любой"]].map(([value,label]) => <label className="category-option" key={value}><input type="radio" name="duration" value={value} checked={duration===value} onChange={() => setDuration(value as DurationFilter)} />{label}</label>)}</fieldset>
      <div className="category-filter"><label htmlFor="category-sort">Сортировка</label><select id="category-sort" value={sort} onChange={event => setSort(event.target.value as SortOption)}><option value="relevance">По релевантности</option><option value="priceAsc">Сначала дешевле</option><option value="priceDesc">Сначала дороже</option><option value="rating">По рейтингу</option><option value="duration">По сроку выполнения</option></select>
      <label className="category-option"><input type="checkbox" checked={rating47} onChange={event => setRating47(event.target.checked)} />Рейтинг 4,7+</label>{hasActiveFilters && <button type="button" className="page-button-secondary" onClick={resetFilters}>Сбросить</button>}</div>
    </section>}
    <p className="page-muted" role="status">Найдено услуг: {filteredServices.length}</p>
    {filteredServices.length ? <div className="page-grid">{filteredServices.map(service => <ServiceCard key={service.id} {...service} isDemo />)}</div> : <div className="page-panel page-empty"><Icon name="search" /><h2>Ничего не найдено</h2><p>В этой категории нет услуг, соответствующих Вашему запросу или параметрам фильтрации.</p></div>}
  </div>;
}

export default function CategoryPage({ params }: Props) {
  return demoMode ? <DemoCategoryPage params={params} /> : <>
    <p className="page-capability-note" role="note">Серверный каталог категорий ещё не подключён. Демонстрационные услуги в LIVE не подставляются.</p>
    <div className="campus-page page-actions"><BackButton /><Link href="/search" className="page-button-secondary">Перейти к поиску</Link></div>
    <fieldset disabled className="page-disabled-preview"><DemoCategoryPage params={params} /></fieldset>
  </>;
}
