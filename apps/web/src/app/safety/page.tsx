import Link from "next/link";
import { Icon } from "@/components/studly/Icon";
import styles from "../information.module.css";

export default function SafetyPage() {
  return (
    <div className={`campus-page ${styles.page}`}>
      <header className={styles.heading}>
        <p className="page-eyebrow">О платформе</p>
        <h1 className="page-heading">Безопасность</h1>
        <p className="page-muted">Правила безопасной работы на платформе.</p>
      </header>
      <section className={`page-panel ${styles.state}`} aria-labelledby="safety-state-title">
        <span className={`${styles.stateIcon} ${styles.sage}`}><Icon name="heart" size={30} /></span>
        <span className={styles.status}>Раздел готовится</span>
        <h2 id="safety-state-title">Информация скоро появится</h2>
        <p>Подробная информация о безопасности на STUDLY пока не опубликована.</p>
        <div className="page-actions"><Link href="/search" className="page-button">Перейти в каталог <Icon name="arrow" /></Link><Link href="/rules" className="page-button-secondary">Правила платформы</Link></div>
      </section>
    </div>
  );
}
