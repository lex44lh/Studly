import Link from "next/link";
import { Icon } from "@/components/studly/Icon";
import styles from "../information.module.css";
import { getApprovedLegalPublication, getLegalDocumentIndex } from "./publication";
import { legalPreviewEnabled } from "./preview";

export default function RulesPage() {
  const published = getApprovedLegalPublication();
  const preview = !published && legalPreviewEnabled();

  return (
    <div className={`campus-page ${styles.page}`}>
      <header className={styles.heading}>
        <p className="page-eyebrow">О платформе</p>
        <h1 className="page-heading">Документы STUDLY</h1>
        {preview && <p className={styles.status}>Черновики для согласования</p>}
      </header>
      {published || preview ? (
        <nav className={styles.links} aria-label="Документы платформы">
          {getLegalDocumentIndex().map(([id, title]) => (
            <Link key={id} className={styles.linkCard} href={`/rules/${id}`}>
              <span className={styles.cardIcon}><Icon name="book" /></span>
              <span><strong>{title}</strong></span>
              <Icon name="arrow" />
            </Link>
          ))}
        </nav>
      ) : <p className="page-muted">Документы готовятся к публикации.</p>}
      <nav className="page-actions" aria-label="О платформе">
        <Link href="/support" className="page-button-secondary">Контакты и реквизиты</Link>
        <Link href="/about" className="page-button-secondary">О STUDLY</Link>
      </nav>
    </div>
  );
}
