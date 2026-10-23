import { demoMode } from "@/lib/data-mode";
import AccountWorkspace from "@/features/demo-workspace/AccountWorkspace";
import Link from "next/link";
import { Icon } from "@/components/studly/Icon";
import styles from "../information.module.css";

export default function ProfilePage() {
  if (demoMode) return <AccountWorkspace />;
  return (
    <div className={`campus-page ${styles.page}`}>
      <header className={styles.heading}>
        <p className="page-eyebrow">Мой STUDLY</p>
        <h1 className="page-heading">Профиль</h1>
        <p className="page-muted">Личное пространство на платформе.</p>
      </header>
      <section className={`page-panel ${styles.profileState}`} aria-labelledby="profile-state-title">
        <span className={styles.stateIcon}><Icon name="user" size={30} /></span>
        <div><span className={styles.status}>Раздел готовится</span><h2 id="profile-state-title">Профиль пока не подключён</h2><p>Информация об аккаунте здесь ещё не отображается. Вы можете перейти в существующие разделы STUDLY.</p></div>
      </section>
      <nav className={styles.links} aria-label="Мои разделы">
        <Link className={styles.linkCard} href="/favorites"><span className={styles.cardIcon}><Icon name="heart" /></span><span><strong>Избранное</strong><small>Сохранённые услуги</small></span><Icon name="arrow" /></Link>
        <Link className={styles.linkCard} href="/orders"><span className={styles.cardIcon}><Icon name="book" /></span><span><strong>Мои заказы</strong><small>Перейти в раздел заказов</small></span><Icon name="arrow" /></Link>
        <Link className={styles.linkCard} href="/chats"><span className={styles.cardIcon}><Icon name="chat" /></span><span><strong>Чаты</strong><small>Перейти к перепискам</small></span><Icon name="arrow" /></Link>
      </nav>
      <Link className={styles.catalogLink} href="/search">Вернуться к услугам <Icon name="arrow" /></Link>
    </div>
  );
}
