import type { SearchFilters } from "@/lib/catalog/search";

// Django applies these filters before pagination. Ratings have no Live source.
export function liveSearchQuery(filters: SearchFilters) {
  const parameters = new URLSearchParams();
  if (filters.query.trim()) parameters.set("search", filters.query.trim());
  if (filters.category.trim()) parameters.set("category", filters.category.trim());
  if (filters.minPrice.trim()) parameters.set("min_price", filters.minPrice.trim());
  if (filters.maxPrice.trim()) parameters.set("max_price", filters.maxPrice.trim());
  if (filters.duration !== "any") parameters.set("max_duration", filters.duration);
  const ordering = { relevance: "id", priceAsc: "price_asc", priceDesc: "price_desc", duration: "duration_asc", rating: "id" };
  parameters.set("ordering", ordering[filters.sort]);
  return parameters.toString();
}
