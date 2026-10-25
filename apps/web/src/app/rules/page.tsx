import Link from "next/link";
import { Icon } from "@/components/studly/Icon";
import styles from "../information.module.css";

export default function RulesPage() {
  return (
    <div className={`campus-page ${styles.page}`}>
      <header className={styles.heading}>
        <p className="page-eyebrow">О платформе</p>
        <h1 className="page-heading">Правила платформы</h1>
        <p className="page-muted">Условия использования STUDLY.</p>
      </header>
      <section className={`page-panel ${styles.state}`} aria-labelledby="rules-state-title">
        <span className={styles.stateIcon}><Icon name="book" size={30} /></span>
        <span className={styles.status}>Раздел готовится</span>
        <h2 id="rules-state-title">Правила готовятся</h2>
        <p>Здесь будут правила использования STUDLY.</p>
        <div className="page-actions"><Link href="/search" className="page-button">Перейти в каталог <Icon name="arrow" /></Link><Link href="/about" className="page-button-secondary">О платформе</Link></div>
      </section>
    </div>
  );
}
