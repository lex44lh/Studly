"use client";

import { useState } from "react";
import type { Specialization } from "@/types/registration";
import { filterSpecializations, toggleSpecialization } from "@/lib/registration/draft";
import styles from "./registration.module.css";

export type SpecializationSource =
  | { status: "loading" | "unavailable" | "error" }
  | { status: "available"; options: Specialization[] };

export default function SpecializationPicker({ source, selected, onChange, onRetry }: {
  source: SpecializationSource;
  selected: Specialization[];
  onChange: (selected: Specialization[]) => void;
  onRetry: () => void;
}) {
  const [query, setQuery] = useState("");
  const options = source.status === "available" ? filterSpecializations(source.options, query) : [];
  return <fieldset className={styles.fieldset}>
    <legend className={styles.legend}>Специализации <span className={styles.optional}>можно выбрать позже</span></legend>
    <div className={styles.field}>
      <label htmlFor="specialization-search">Поиск специализаций</label>
      <input type="search" id="specialization-search" className={styles.input} placeholder="Поиск по списку" value={query}
        onChange={event => setQuery(event.target.value)} disabled={source.status !== "available"} />
      {source.status === "loading" && <p className={styles.hint} role="status">Загружаем специализации…</p>}
      {source.status === "unavailable" && <p className={styles.hint} role="status">Справочник пока недоступен в предпросмотре. Этот шаг можно заполнить позже.</p>}
      {source.status === "error" && <div role="status">
        <p className={styles.hint}>Не удалось загрузить специализации. Можно продолжить без них.</p>
        <button type="button" className={styles.back} onClick={onRetry}>Повторить загрузку</button>
      </div>}
      {source.status === "available" && <>
        <p className={styles.hint} role="status">{source.options.length ? `Найдено: ${options.length}` : "Список специализаций пока пуст."}</p>
        {options.length ? <div className={styles.options}>
          {options.map(option => <label className={styles.option} key={option.id}>
            <input type="checkbox" checked={selected.some(item => item.id === option.id)}
              onChange={() => onChange(toggleSpecialization(selected, option))} />
            <span>{option.title}</span>
          </label>)}
        </div> : source.options.length > 0 && <p className={styles.hint}>Ничего не найдено. Попробуйте другой запрос.</p>}
      </>}
    </div>
    <div className={styles.chips} aria-label="Выбранные специализации">
      {selected.map(item => <button className={styles.chip} type="button" key={item.id} aria-label={`Убрать специализацию ${item.title}`}
        onClick={() => onChange(toggleSpecialization(selected, item))}>{item.title} ×</button>)}
    </div>
    <p className={styles.hint}>Можно выбрать любое количество. Перед публикацией профиля или услуги потребуется хотя бы одна специализация.</p>
  </fieldset>;
}
