import Link from "next/link";
import { Icon } from "@/components/studly/Icon";
import styles from "./information.module.css";

export default function NotFound() {
  return (
    <div className={`campus-page ${styles.page}`}>
      <section className={`page-panel ${styles.state}`} aria-labelledby="not-found-title">
        <span className={styles.errorCode} aria-hidden="true">404</span>
        <p className="page-eyebrow">Кажется, вы свернули не туда</p>
        <h1 className="page-heading" id="not-found-title">Страница не найдена</h1>
        <p>По этому адресу нет страницы. Найти нужную услугу можно в каталоге.</p>
        <div className="page-actions"><Link href="/search" className="page-button">Перейти в каталог <Icon name="arrow" /></Link><Link href="/" className="page-button-secondary">На главную</Link></div>
      </section>
    </div>
  );
}
