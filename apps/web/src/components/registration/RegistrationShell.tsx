"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BrandMark from "@/components/BrandMark";
import { demoMode } from "@/lib/data-mode";
import { useAuth } from "@/context/AuthContext";
import { useRegistration } from "@/context/RegistrationContext";
import { prerequisitePath } from "@/lib/registration/draft";
import styles from "./registration.module.css";

export function RegistrationStep({ step, title, intro, children }: {
  step: "roles" | "profile" | "performer";
  title: string;
  intro: string;
  children: ReactNode;
}) {
  const { draft, previewComplete, returnToForm, ready, loading, busy, error, retry } = useRegistration();
  const { state: auth, refresh } = useAuth();
  const router = useRouter();
  const target = prerequisitePath(draft, step);
  useEffect(() => { if (!loading && target) router.replace(target); }, [router, target, loading]);
  const number = step === "roles" ? 1 : step === "profile" ? 2 : 3;
  const total = draft.roles.includes("performer") ? 3 : 2;
  return (
    <main className={styles.screen}>
      <div className={styles.container}>
        <div className={styles.brand}><BrandMark size={36} /><span>STUDLY</span></div>
        {!demoMode && auth.status !== "authenticated" ? <>
          <p role={auth.status === "error" ? "alert" : "status"}>{auth.message}</p>
          {auth.status !== "loading" && <button type="button" className={styles.secondary} onClick={refresh}>Повторить вход</button>}
        </> : loading ? <p role="status">Восстанавливаем регистрацию…</p> : error && !ready ? <>
          <p role="alert">{error}</p><button type="button" className={styles.secondary} onClick={retry}>Повторить загрузку</button>
        </> : target ? <p role="status">Открываем предыдущий шаг…</p> : <>
          <nav aria-label="Навигация регистрации" className={styles.navigation}>
            <Link onClick={event => { if (busy) event.preventDefault(); }} aria-disabled={busy} className={styles.back} href={step === "roles" ? "/welcome" : step === "profile" ? "/register/roles" : "/register/profile"}>← Назад</Link>
            <span className={styles.step}>Шаг {number} из {total}</span>
          </nav>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.intro}>{intro}</p>
          {demoMode && <p className={styles.notice}>DEMO · Данные формы остаются в этой вкладке. Аккаунт не создаётся.</p>}
          {error && <p className={styles.error} role="alert">{error}</p>}
          <fieldset disabled={busy} className={styles.fieldset} aria-busy={busy}>
          {previewComplete ? <RegistrationPreviewEnd onBack={returnToForm} /> : children}
          </fieldset>
          {busy && <p role="status">Сохраняем…</p>}
        </>}
      </div>
    </main>
  );
}

export function RegistrationPreviewEnd({ onBack }: { onBack: () => void }) {
  return <section aria-labelledby="preview-end-title" className={styles.form}>
    <h2 id="preview-end-title" className={styles.legend}>Вы просмотрели шаги регистрации</h2>
    <p className={styles.hint}>Это только предпросмотр: данные формы не отправлены, регистрация не завершена. Завершение регистрации пока недоступно.</p>
    <div className={styles.actions}>
      <button type="button" className={styles.secondary} onClick={onBack}>Вернуться к форме</button>
      <Link className={styles.primary} href="/">Перейти в каталог</Link>
    </div>
  </section>;
}
