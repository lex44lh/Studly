"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/studly/Icon";
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
    <section className={styles.screen} aria-label="Регистрация STUDLY">
      <div className={styles.container}>
        <p className={styles.eyebrow}>Знакомство со STUDLY</p>
        <div className={styles.panel}>
        {!demoMode && auth.status !== "authenticated" ? <>
          <div className={styles.stateIcon}><Icon name="user" /></div>
          <h1 className={styles.title}>Вход в STUDLY</h1>
          <p className={styles.intro} role={auth.status === "error" ? "alert" : "status"}>{auth.message}</p>
          {auth.status !== "loading" && <button type="button" className={styles.secondary} onClick={refresh}>Повторить вход</button>}
        </> : loading ? <p className={styles.intro} role="status">Восстанавливаем регистрацию…</p> : error && !ready ? <>
          <p role="alert">{error}</p><button type="button" className={styles.secondary} onClick={retry}>Повторить загрузку</button>
        </> : target ? <p role="status">Открываем предыдущий шаг…</p> : <>
          <nav aria-label="Навигация регистрации" className={styles.navigation}>
            <Link onClick={event => { if (busy) event.preventDefault(); }} aria-disabled={busy} className={styles.back} href={step === "roles" ? "/welcome" : step === "profile" ? "/register/roles" : "/register/profile"}>← Назад</Link>
            <span className={styles.step}>Шаг {number} из {total}</span>
          </nav>
          <div className={styles.progress} aria-hidden="true">{Array.from({ length: total }, (_, index) => <span key={index} className={index < number ? styles.progressComplete : undefined} />)}</div>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.intro}>{intro}</p>
          {demoMode && <p className={styles.notice}>DEMO · Прогресс сохраняется локально в этом браузере. Серверный аккаунт не создаётся.</p>}
          {error && <p className={styles.error} role="alert">{error}</p>}
          <fieldset disabled={busy} className={styles.fieldset} aria-busy={busy}>
          {previewComplete ? <RegistrationPreviewEnd onBack={returnToForm} /> : children}
          </fieldset>
          {busy && <p className={styles.hint} role="status">Сохраняем…</p>}
        </>}
        </div>
        <p className={styles.footnote}>Твой кампус. Твои возможности.</p>
      </div>
    </section>
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
