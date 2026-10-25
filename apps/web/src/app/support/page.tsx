import Link from "next/link";
import { Icon } from "@/components/studly/Icon";
import styles from "../information.module.css";

export default function SupportPage() {
  return (
    <div className={`campus-page ${styles.page}`}>
      <header className={styles.heading}>
        <p className="page-eyebrow">О платформе</p>
        <h1 className="page-heading">Поддержка</h1>
        <p className="page-muted">Раздел связи со STUDLY.</p>
      </header>
      <section className={`page-panel ${styles.state}`} aria-labelledby="support-state-title">
        <span className={styles.stateIcon}><Icon name="chat" size={30} /></span>
        <span className={styles.status}>Раздел готовится</span>
        <h2 id="support-state-title">Связь с поддержкой скоро появится</h2>
        <p>Здесь будет связь со службой поддержки STUDLY.</p>
        <div className="page-actions"><Link href="/search" className="page-button">Перейти в каталог <Icon name="arrow" /></Link><Link href="/about" className="page-button-secondary">О платформе</Link></div>
      </section>
    </div>
  );
}
