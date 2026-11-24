export type DurationFilter = "any" | "1" | "3" | "7";
export type SortOption = "relevance" | "priceAsc" | "priceDesc" | "rating" | "duration";

export type SearchableService = {
  title: string;
  seller: string;
  description: string;
  category: string;
  rating: string;
  priceNumber: number;
  durationDays: number;
};

export type SearchFilters = {
  query: string;
  category: string;
  minPrice: string;
  maxPrice: string;
  duration: DurationFilter;
  rating47: boolean;
  sort: SortOption;
};

export function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

export function normalizePriceInput(value: string) {
  return value.trim().replace(/^0+(?=\d)/, "");
}

function parsePriceBound(value: string) {
  const text = normalizePriceInput(value).replace(",", ".");
  if (!text) return { value: null, text };
  const amount = Number(text);
  const valid = /^\d+(?:\.\d{1,2})?$/.test(text) && amount <= 99_999_999.99;
  return { value: valid ? amount : null, text: valid ? text : null };
}

export function validatePriceRange(minPrice: string, maxPrice: string) {
  const lower = parsePriceBound(minPrice);
  const upper = parsePriceBound(maxPrice);
  const min = lower.value;
  const max = upper.value;
  const invalidMin = lower.text === null;
  const invalidMax = upper.text === null;
  const invalidRange = min !== null && max !== null && min > max;
  return {
    min, max, minParam: lower.text, maxParam: upper.text, invalidMin, invalidMax, invalidRange,
    error: invalidMin || invalidMax
      ? "Укажите цену от 0 до 99 999 999,99 ₽, не более двух знаков после запятой."
      : invalidRange ? "Минимальная цена не может быть выше максимальной." : "",
  };
}

// Live search/pagination belong to Django. Local filters only see its current
// response page; demo search additionally uses its bundled metadata.
export function filterSearchServices<T extends SearchableService>(source: readonly T[], filters: SearchFilters, isDemo: boolean): T[] {
  const query = normalizeSearch(filters.query);
  const price = validatePriceRange(filters.minPrice, filters.maxPrice);
  const searchable = (service: T) => [service.title, service.seller, service.description, service.category].join(" ").toLowerCase();
  let result = [...source];
  if (isDemo && query) result = result.filter(service => searchable(service).includes(query));
  if (isDemo && filters.category) result = result.filter(service => service.category === filters.category);
  // Invalid ranges must not silently apply just one bound.
  if (!price.error && price.min !== null) result = result.filter(service => service.priceNumber >= price.min!);
  if (!price.error && price.max !== null) result = result.filter(service => service.priceNumber <= price.max!);
  if (filters.duration !== "any") result = result.filter(service => service.durationDays <= Number(filters.duration));
  if (isDemo && filters.rating47) result = result.filter(service => Number.parseFloat(service.rating) >= 4.7);
  switch (filters.sort) {
    case "priceAsc": result.sort((a, b) => a.priceNumber - b.priceNumber); break;
    case "priceDesc": result.sort((a, b) => b.priceNumber - a.priceNumber); break;
    case "duration": result.sort((a, b) => a.durationDays - b.durationDays); break;
    case "rating":
      if (isDemo) result.sort((a, b) => Number.parseFloat(b.rating) - Number.parseFloat(a.rating));
      break;
    case "relevance":
      if (isDemo && query) result.sort((a, b) => searchable(a).indexOf(query) - searchable(b).indexOf(query));
      break;
  }
  return result;
}

export function searchRequestQuery(query: string, page: { search: string; query: string }) {
  return page.search === normalizeSearch(query) && page.query
    ? page.query : new URLSearchParams({ search: query.trim() }).toString();
}
