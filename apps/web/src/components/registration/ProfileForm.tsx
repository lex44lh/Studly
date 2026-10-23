"use client";

import { useState } from "react";
import Image from "next/image";
import { demoMode } from "@/lib/data-mode";
import { useRegistration } from "@/context/RegistrationContext";
import styles from "./registration.module.css";

export default function ProfileForm() {
  const { draft, dispatch, saveStep } = useRegistration();
  const profile = draft.profile;
  const [nameError, setNameError] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  return <form noValidate className={styles.form} onSubmit={event => {
    event.preventDefault();
    if (!profile.displayName.trim()) { setNameError(true); document.getElementById("display-name")?.focus(); return; }
    void saveStep("profile");
  }}>
    <div className={styles.field}>
      <label htmlFor="avatar" className={styles.label}>Аватар <span className={styles.optional}>необязательно</span></label>
      <div className={styles.avatarRow}>
        {profile.avatarUrl ? <Image src={profile.avatarUrl} width={72} height={72} unoptimized className={styles.avatar} alt="Предпросмотр аватара" />
          : <span className={styles.avatar} aria-hidden="true">{profile.displayName.trim().slice(0, 1).toUpperCase() || "S"}</span>}
        <div className={styles.avatarControls}>
          <input className={styles.fileInput} id="avatar" type="file" accept="image/png,image/jpeg,image/webp" aria-describedby="avatar-hint avatar-error"
            onChange={event => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
                setAvatarError("Выберите PNG, JPEG или WebP размером до 5 МБ."); return;
              }
              setAvatarError("");
              dispatch({ type: "profile", patch: { avatarFile: file, avatarUrl: URL.createObjectURL(file) } });
            }} />
          {profile.avatarUrl && <button type="button" className={styles.back} onClick={() => {
            dispatch({ type: "profile", patch: { avatarFile: null, avatarUrl: "" } }); setAvatarError("");
          }}>Удалить аватар</button>}
        </div>
      </div>
      <p id="avatar-hint" className={styles.hint}>PNG, JPEG или WebP, до 5 МБ. {demoMode ? "Изображение сохраняется локально в этом браузере." : "Изображение сохраняется при продолжении."}</p>
      <p id="avatar-error" className={styles.error} role="alert">{avatarError}</p>
    </div>
    <div className={styles.field}>
      <label htmlFor="display-name" className={styles.label}>Имя для отображения <span aria-hidden="true">*</span></label>
      <input id="display-name" className={styles.input} autoComplete="nickname" required maxLength={255} value={profile.displayName}
        aria-invalid={nameError} aria-describedby={nameError ? "name-error" : undefined}
        onChange={event => { dispatch({ type: "profile", patch: { displayName: event.target.value } }); setNameError(false); }} />
      {nameError && <p id="name-error" className={styles.error} role="alert">Укажите имя для отображения.</p>}
    </div>
    {([['university', 'Университет'], ['city', 'Город']] as const).map(([key, label]) => <div className={styles.field} key={key}>
      <label htmlFor={key} className={styles.label}>{label} <span className={styles.optional}>необязательно</span></label>
      <input id={key} className={styles.input} autoComplete={key === "city" ? "address-level2" : "off"} maxLength={255} value={profile[key]}
        onChange={event => dispatch({ type: "profile", patch: { [key]: event.target.value } })} />
    </div>)}
    <div className={styles.field}>
      <label htmlFor="about" className={styles.label}>О себе <span className={styles.optional}>необязательно</span></label>
      <textarea id="about" className={styles.textarea} maxLength={10000} value={profile.about} onChange={event => dispatch({ type: "profile", patch: { about: event.target.value } })} />
    </div>
    <div className={styles.actions}><button className={styles.primary} type="submit">Продолжить</button></div>
  </form>;
}
