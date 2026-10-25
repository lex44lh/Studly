import Link from "next/link";
import { Icon } from "@/components/studly/Icon";
import styles from "../information.module.css";

export default function AboutPage() {
  return (
    <div className={`campus-page ${styles.page}`}>
      <header className={styles.hero}>
        <span className={styles.heroIcon}><Icon name="book" size={32} /></span>
        <p className="page-eyebrow">О STUDLY</p>
        <h1 className="page-heading">Свои люди.<br /><span className={styles.accent}>Нужные навыки.</span></h1>
        <p className={styles.lead}>STUDLY — площадка услуг для студентов.</p>
        <div className="page-actions">
          <Link href="/search" className="page-button">Найти услугу <Icon name="arrow" /></Link>
        </div>
        <span className={styles.heroNumber} aria-hidden="true">ST.</span>
      </header>
      <nav className={styles.links} aria-label="Узнать о платформе">
        <Link className={styles.linkCard} href="/safety"><span className={styles.cardIcon}><Icon name="heart" /></span><span><strong>Безопасность</strong><small>Информация о безопасной работе</small></span><Icon name="arrow" /></Link>
        <Link className={styles.linkCard} href="/rules"><span className={styles.cardIcon}><Icon name="book" /></span><span><strong>Правила платформы</strong><small>Статус подготовки правил</small></span><Icon name="arrow" /></Link>
        <Link className={styles.linkCard} href="/support"><span className={styles.cardIcon}><Icon name="chat" /></span><span><strong>Поддержка</strong><small>Информация о разделе</small></span><Icon name="arrow" /></Link>
      </nav>
    </div>
  );
}
