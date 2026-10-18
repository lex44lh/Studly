"use client";

import { useId } from "react";
import type { DurationFilter, SearchFilters as FilterValues } from "@/lib/catalog/search";
import { validatePriceRange } from "@/lib/catalog/search";

type Props = {
  values: FilterValues;
  isDemo: boolean;
  onMinPrice: (value: string) => void;
  onMaxPrice: (value: string) => void;
  onDuration: (value: DurationFilter) => void;
  onRating: (value: boolean) => void;
};

// Desktop sidebar and mobile dialog share fields and parent state.
export function SearchFilters({ values, isDemo, onMinPrice, onMaxPrice, onDuration, onRating }: Props) {
  const id = useId();
  const price = validatePriceRange(values.minPrice, values.maxPrice);
  return (
    <>
      <fieldset className="filter-group">
        <legend>Цена, ₽</legend>
        <div className="price-inputs">
          <div><label htmlFor={`${id}-min`}>От</label>
            <input id={`${id}-min`} type="number" inputMode="decimal" min="0" step="any" value={values.minPrice}
              placeholder="0" aria-invalid={price.invalidMin || price.invalidRange}
              aria-describedby={price.error ? `${id}-price-error` : undefined} onChange={event => onMinPrice(event.target.value)} />
          </div>
          <div><label htmlFor={`${id}-max`}>До</label>
            <input id={`${id}-max`} type="number" inputMode="decimal" min="0" step="any" value={values.maxPrice}
              placeholder="Любая" aria-invalid={price.invalidMax || price.invalidRange}
              aria-describedby={price.error ? `${id}-price-error` : undefined} onChange={event => onMaxPrice(event.target.value)} />
          </div>
        </div>
        {price.error && <p className="filter-error" id={`${id}-price-error`} role="alert">{price.error}</p>}
      </fieldset>
      <div className="filter-group">
        <label htmlFor={`${id}-duration`}>Срок выполнения</label>
        <select id={`${id}-duration`} value={values.duration} onChange={event => onDuration(event.target.value as DurationFilter)}>
          <option value="any">Любой срок</option><option value="1">До 1 дня</option>
          <option value="3">До 3 дней</option><option value="7">До 7 дней</option>
        </select>
      </div>
      <fieldset className="filter-group">
        <legend>Рейтинг исполнителя</legend>
        <label className="filter-option" htmlFor={`${id}-rating`}>
          <input id={`${id}-rating`} type="checkbox" checked={values.rating47} disabled={!isDemo}
            aria-describedby={!isDemo ? `${id}-rating-note` : undefined} onChange={event => onRating(event.target.checked)} />
          <span>От 4,7 и выше</span>
        </label>
        {!isDemo && <p className="filter-note" id={`${id}-rating-note`}>Рейтинг пока недоступен в Live.</p>}
      </fieldset>
    </>
  );
}
