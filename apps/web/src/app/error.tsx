"use client";

import Link from "next/link";
import { Icon } from "@/components/studly/Icon";
import styles from "./information.module.css";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className={`campus-page ${styles.page}`}>
      <section className={`page-panel ${styles.state}`} aria-labelledby="error-title">
        <span className={styles.stateIcon}><Icon name="close" size={30} /></span>
        <p className="page-eyebrow">Что-то пошло не так</p>
        <h1 className="page-heading" id="error-title">Не удалось открыть страницу</h1>
        <p>Возникла ошибка. Попробуйте открыть страницу ещё раз.</p>
        <div className="page-actions"><button type="button" className="page-button" onClick={reset}>Попробовать снова</button><Link href="/search" className="page-button-secondary">Перейти в каталог</Link></div>
      </section>
    </div>
  );
}
