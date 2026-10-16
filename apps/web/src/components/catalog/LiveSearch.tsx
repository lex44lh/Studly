"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import ServiceCard from "@/components/ServiceCard";
import services from "@/data/services";
import { demoMode } from "@/lib/api/catalog";
import { catalogClient, money } from "@/lib/api/catalog";
import { ApiState, useApiResource } from "@/components/catalog/ApiState";
import { pagePath } from "@/lib/api/client";

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

function SearchContent({ initialQuery }: { initialQuery: string }) {


  const [query, setQuery] =
    useState(initialQuery);

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

  const normalizedQuery =
    query.trim().toLowerCase();

  const [page, setPage] = useState({ search: "", query: "" });
  const requestQuery = page.search === normalizedQuery && page.query
    ? page.query : new URLSearchParams({ search: query.trim() }).toString();
  const load = useCallback((signal: AbortSignal) => demoMode ? Promise.resolve(null) : catalogClient.list(requestQuery, signal), [requestQuery]);
  const { data, error, retry } = useApiResource(requestQuery, load);
  const sourceServices = useMemo(() => demoMode ? services : (data?.results ?? []).map(service => ({
    id: service.id, title: service.title, description: service.description, price: money(service.price_amount, service.currency),
    priceNumber: Number(service.price_amount), seller: service.performer.name, rating: "", category: "", profileId: service.performer.id,
    duration: `${service.duration_days} дн.`, durationDays: service.duration_days, included: service.included, isDemo: service.is_demo,
  })), [data]);

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
    let result = [...sourceServices];

    // Поиск
    if (demoMode && normalizedQuery) {
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
    // Цена применяется только после проверки всего диапазона.
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

    if (demoMode && sort === "relevance" && normalizedQuery) {
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
    sourceServices,
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

  return (
    <div>
      <h1
        style={{
          marginBottom: "16px",
        }}
      >
        Поиск услуг
      </h1>

      {/* Поиск + фильтры */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: filtersOpen
            ? "12px"
            : "24px",
        }}
      >
        <input
          type="search"
          value={query}
          onChange={(event) =>
            setQuery(event.target.value)
          }
          placeholder="Что Вы ищете?"
          autoFocus
          style={{
            flex: 1,
            height: "44px",
            border: "1px solid #E5E7EB",
            borderRadius: "12px",
            padding: "0 12px",
            fontSize: "14px",
            outline: "none",
            boxSizing: "border-box",
          }}
        />

        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            style={{
              width: "44px",
              height: "44px",
              border:
                "1px solid #E5E7EB",
              borderRadius: "12px",
              background: "#FFFFFF",
              cursor: "pointer",
              fontSize: "18px",
              flexShrink: 0,
            }}
            aria-label="Очистить поиск"
          >
            ×
          </button>
        )}

        <button
          type="button"
          onClick={() =>
            setFiltersOpen(
              (value) => !value
            )
          }
          style={{
            width: "44px",
            height: "44px",
            border:
              "1px solid #E5E7EB",
            borderRadius: "12px",
            background: "#FFFFFF",
            cursor: "pointer",
            fontSize: filtersOpen
              ? "22px"
              : "16px",
            flexShrink: 0,
          }}
          aria-label={
            filtersOpen
              ? "Закрыть фильтры"
              : "Открыть фильтры"
          }
        >
          {filtersOpen ? "×" : "⚙️"}
        </button>
      </div>

      {/* Фильтры */}
      {filtersOpen && (
        <div
          style={{
            border:
              "1px solid #E5E7EB",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "20px",
            background: "#FFFFFF",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent:
                "space-between",
              marginBottom: "16px",
            }}
          >
            <strong
              style={{
                fontSize: "16px",
              }}
            >
              Фильтры
            </strong>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                style={{
                  border: "none",
                  background: "none",
                  padding: 0,
                  color: "#3547B8",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Сбросить
              </button>
            )}
          </div>

          {/* Цена */}
          <div
            style={{
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                fontWeight: 600,
                fontSize: "14px",
                marginBottom: "8px",
              }}
            >
              Цена
            </div>

            <div
              style={{
                display: "flex",
                gap: "8px",
              }}
            >
              <input
                type="number"
                min="0"
                value={minPrice}
                aria-invalid={hasInvalidMinPrice || hasInvalidPriceRange}
                aria-label="Минимальная цена"
                onChange={(event) =>
                  setMinPrice(
                    event.target.value
                  )
                }
                placeholder="От ₽"
                style={{
                  width: "50%",
                  height: "44px",
                  border:
                    "1px solid #E5E7EB",
                  borderRadius: "10px",
                  padding: "0 12px",
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />

              <input
                type="number"
                min="0"
                value={maxPrice}
                aria-invalid={hasInvalidMaxPrice || hasInvalidPriceRange}
                aria-label="Максимальная цена"
                onChange={(event) =>
                  setMaxPrice(
                    event.target.value
                  )
                }
                placeholder="До ₽"
                style={{
                  width: "50%",
                  height: "44px",
                  border:
                    "1px solid #E5E7EB",
                  borderRadius: "10px",
                  padding: "0 12px",
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
            </div>
            {priceError && (
              <p
                role="alert"
                style={{
                  margin: "8px 0 0",
                  color: "#B42318",
                  fontSize: "13px",
                }}
              >
                {priceError}
              </p>
            )}
          </div>

          {/* Срок */}
          <div
            style={{
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                fontWeight: 600,
                fontSize: "14px",
                marginBottom: "10px",
              }}
            >
              Срок выполнения
            </div>

            {[
              ["1", "До 1 дня"],
              ["3", "До 3 дней"],
              ["7", "До 7 дней"],
              ["any", "Любой"],
            ].map(([value, label]) => (
              <label
                key={value}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "10px",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="duration"
                  value={value}
                  checked={
                    duration === value
                  }
                  onChange={() =>
                    setDuration(
                      value as DurationFilter
                    )
                  }
                />

                {label}
              </label>
            ))}
          </div>

          {/* Рейтинг */}
          <div
            style={{
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                fontWeight: 600,
                fontSize: "14px",
                marginBottom: "10px",
              }}
            >
              Рейтинг исполнителя
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                disabled={!demoMode}
                checked={rating47}
                onChange={(event) =>
                  setRating47(
                    event.target.checked
                  )
                }
              />

              4,7+
            </label>
          </div>

          {/* Сортировка */}
          <div>
            <div
              style={{
                fontWeight: 600,
                fontSize: "14px",
                marginBottom: "8px",
              }}
            >
              Сортировка
            </div>

            <select
              value={sort}
              onChange={(event) =>
                setSort(
                  event.target.value as SortOption
                )
              }
              style={{
                width: "100%",
                height: "44px",
                border:
                  "1px solid #E5E7EB",
                borderRadius: "10px",
                padding: "0 12px",
                fontSize: "14px",
                background: "#FFFFFF",
              }}
            >
              <option value="relevance">
                По релевантности
              </option>
              <option value="priceAsc">
                Сначала дешевле
              </option>
              <option value="priceDesc">
                Сначала дороже
              </option>
              <option value="rating" disabled={!demoMode}>
                По рейтингу
              </option>
              <option value="duration">
                По сроку выполнения
              </option>
            </select>
          </div>
        </div>
      )}

      {!normalizedQuery && !hasActiveFilters && (
        <div
          style={{
            marginBottom: "20px",
            color: "#6B7280",
            fontSize: "14px",
          }}
        >
          Найдите исполнителя или услугу по
          названию или описанию.
        </div>
      )}

      {(normalizedQuery ||
        hasActiveFilters) && (
        <div
          style={{
            marginBottom: "16px",
            fontSize: "14px",
            color: "#6B7280",
          }}
        >
          Найдено: {demoMode ? filteredServices.length : data?.count ?? 0}
        </div>
      )}

      {!demoMode && <p style={{ color: "#6B7280", fontSize: 14 }}>Цена, срок и сортировка применяются к текущей странице. Рейтинг пока недоступен.</p>}
      {!demoMode && !data ? <ApiState error={error} retry={retry} /> : filteredServices.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {filteredServices.map(
            (service) => (
              <ServiceCard
                key={service.id}
                id={service.id}
                title={service.title}
                price={service.price}
                seller={service.seller}
                rating={demoMode ? service.rating : undefined}
                isDemo={"isDemo" in service ? Boolean(service.isDemo) : undefined}
              />
            )
          )}
        </div>
      ) : (
        <div
          style={{
            border:
              "1px solid #E5E7EB",
            borderRadius: "16px",
            padding: "32px 20px",
            textAlign: "center",
            background: "#FFFFFF",
          }}
        >
          <div
            style={{
              fontSize: "32px",
              marginBottom: "12px",
            }}
          >
            🔍
          </div>

          <h3
            style={{
              marginTop: 0,
              marginBottom: "8px",
            }}
          >
            Ничего не найдено
          </h3>

          <p
            style={{
              margin: 0,
              color: "#6B7280",
              fontSize: "14px",
              lineHeight: 1.5,
            }}
          >
            Попробуйте изменить запрос
            или параметры фильтрации.
          </p>
        </div>
      )}
      {!demoMode && data && <nav aria-label="Страницы каталога">
        {data.previous && <button type="button" onClick={() => setPage({ search: normalizedQuery, query: pagePath(data.previous!, "services/").split("?")[1] ?? "" })}>Назад</button>}
        {data.next && <button type="button" onClick={() => setPage({ search: normalizedQuery, query: pagePath(data.next!, "services/").split("?")[1] ?? "" })}>Далее</button>}
      </nav>}

    </div>
  );
}

function SearchWithQuery() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  return <SearchContent key={query} initialQuery={query} />;
}

export default function SearchPage() {
  return (
    <Suspense fallback={<p>Загрузка поиска...</p>}>
      <SearchWithQuery />
    </Suspense>
  );
}
