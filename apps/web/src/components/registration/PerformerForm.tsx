"use client";

import { useEffect, useState } from "react";
import { useRegistration } from "@/context/RegistrationContext";
import SpecializationPicker, { type SpecializationSource } from "./SpecializationPicker";
import styles from "./registration.module.css";

export default function PerformerForm() {
  const { draft, dispatch, client, saveStep } = useRegistration();
  const performer = draft.performer;
  const [source, setSource] = useState<SpecializationSource>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    client.listSpecializations(controller.signal).then(result => {
      if (!controller.signal.aborted) setSource({ status: "available", options: result });
    }).catch(() => {
      if (!controller.signal.aborted) setSource({ status: "error" });
    });
    return () => controller.abort();
  }, [client, attempt]);

  return <form className={styles.form} onSubmit={event => { event.preventDefault(); void saveStep("performer"); }}>
    <SpecializationPicker source={source} selected={performer.specializations}
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
      <textarea id="portfolio" className={styles.textarea} placeholder="Ссылки или краткое описание ваших работ" maxLength={10000} value={performer.portfolio}
        onChange={event => dispatch({ type: "performer", patch: { portfolio: event.target.value } })} />
    </div>
    <div className={styles.actions}>
      <button className={styles.primary} type="submit">Сохранить и продолжить</button>
      <button className={styles.secondary} type="button" onClick={() => { void saveStep("performer", true); }}>Заполнить позже</button>
    </div>
  </form>;
}
