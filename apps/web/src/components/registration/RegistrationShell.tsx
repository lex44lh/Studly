"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BrandMark from "@/components/BrandMark";
import { useRegistration } from "@/context/RegistrationContext";
import { prerequisitePath } from "@/lib/registration/draft";
import styles from "./registration.module.css";

export function RegistrationStep({ step, title, intro, children }: {
  step: "roles" | "profile" | "performer";
  title: string;
  intro: string;
  children: ReactNode;
}) {
  const { draft } = useRegistration();
  const router = useRouter();
  const target = prerequisitePath(draft, step);
  useEffect(() => { if (target) router.replace(target); }, [router, target]);
  const number = step === "roles" ? 1 : step === "profile" ? 2 : 3;
  const total = draft.roles.includes("performer") ? 3 : 2;
  return (
    <main className={styles.screen}>
      <div className={styles.container}>
        <div className={styles.brand}><BrandMark size={36} /><span>STUDLY</span></div>
        {target ? <p role="status">Открываем предыдущий шаг…</p> : <>
          <nav aria-label="Навигация регистрации" className={styles.navigation}>
            <Link className={styles.back} href={step === "roles" ? "/welcome" : step === "profile" ? "/register/roles" : "/register/profile"}>← Назад</Link>
            <span className={styles.step}>Шаг {number} из {total}</span>
          </nav>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.intro}>{intro}</p>
          <p className={styles.notice}>Предпросмотр регистрации · Аккаунт не создаётся. Данные временные и сбросятся после обновления страницы.</p>
          {children}
        </>}
      </div>
    </main>
  );
}

export function RegistrationPreviewEnd({ onBack }: { onBack: () => void }) {
  return <section aria-labelledby="preview-end-title" className={styles.form}>
    <h2 id="preview-end-title" className={styles.legend}>Вы просмотрели шаги регистрации</h2>
    <p className={styles.hint}>Это только предпросмотр: данные не отправлены, учётная запись не создана. Завершение регистрации пока недоступно.</p>
    <div className={styles.actions}>
      <button type="button" className={styles.secondary} onClick={onBack}>Вернуться к форме</button>
      <Link className={styles.primary} href="/">Перейти в каталог</Link>
    </div>
  </section>;
}
