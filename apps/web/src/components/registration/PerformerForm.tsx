"use client";

import { useEffect, useState } from "react";
import { demoMode } from "@/lib/data-mode";
import { useRegistration } from "@/context/RegistrationContext";
import SpecializationPicker, { type SpecializationSource } from "./SpecializationPicker";
import services from "@/data/services";
import styles from "./registration.module.css";

export default function PerformerForm() {
  const { draft, dispatch, client, saveStep } = useRegistration();
  const performer = draft.performer;
  const [source, setSource] = useState<SpecializationSource>(demoMode ? {status:"available",options:[...new Set(services.map(s=>s.category))].map((title,index)=>({id:`demo-category-${index}`,title}))} : {status:"loading"});
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (demoMode) return;
    const controller = new AbortController();
    client.listSpecializations(controller.signal).then(result => {
      if (!controller.signal.aborted) setSource({ status: "available", options: result });
    }).catch(() => {
      if (!controller.signal.aborted) setSource({ status: "error" });
    });
    return () => controller.abort();
  }, [client, attempt]);

  return <form className={styles.form} onSubmit={event => { event.preventDefault(); void saveStep("performer"); }}>
    <SpecializationPicker demo={demoMode} source={source} selected={performer.specializations}
      onChange={specializations => dispatch({ type: "performer", patch: { specializations } })}
      onRetry={() => { setSource({ status: "loading" }); setAttempt(value => value + 1); }} />
    <div className={styles.field}>
      <label htmlFor="performer-description" className={styles.label}>Описание исполнителя <span className={styles.optional}>необязательно</span></label>
      <textarea id="performer-description" className={styles.textarea} maxLength={10000} value={performer.description}
        onChange={event => dispatch({ type: "performer", patch: { description: event.target.value } })} />
    </div>
    <div className={styles.field}>
      <label htmlFor="study-year" className={styles.label}>Курс обучения <span className={styles.optional}>необязательно</span></label>
      <input id="study-year" className={styles.input} maxLength={100} value={performer.studyYear}
        onChange={event => dispatch({ type: "performer", patch: { studyYear: event.target.value } })} />
    </div>
    <div className={styles.field}>
      <label htmlFor="portfolio" className={styles.label}>Портфолио <span className={styles.optional}>необязательно</span></label>
      {demoMode && <p className={styles.hint}>Эта заметка сохранится в кабинете. Для проверки профиля добавьте отдельные примеры работ после регистрации.</p>}
      <textarea id="portfolio" className={styles.textarea} placeholder="Ссылки или краткое описание ваших работ" maxLength={10000} value={performer.portfolio}
        onChange={event => dispatch({ type: "performer", patch: { portfolio: event.target.value } })} />
    </div>
    <div className={styles.actions}>
      <button className={styles.primary} type="submit">Сохранить и продолжить</button>
      <button className={styles.secondary} type="button" onClick={() => { void saveStep("performer", true); }}>Заполнить позже</button>
    </div>
  </form>;
}
