import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "../../information.module.css";
import { getLegalDocument, getLegalDocumentIndex } from "../publication";
import { getLegalPreviewSections } from "../preview";

export default async function LegalDocumentPage({ params }: { params: Promise<{ document: string }> }) {
  const { document } = await params;
  const title = getLegalDocumentIndex().find(([id]) => id === document)?.[1];
  const published = getLegalDocument(document);
  const preview = published ? null : getLegalPreviewSections(document);
  if (!title || (!published && !preview)) notFound();

  const sections = published?.sections ?? preview;
  return (
    <div className={`campus-page ${styles.page}`}>
      <header className={styles.heading}>
        <p className="page-eyebrow">Документы STUDLY</p>
        <h1 className="page-heading">{title}</h1>
        {published ? (
          <p className="page-muted">Редакция {published.version} от <time dateTime={published.effectiveDate}>{published.effectiveDate}</time></p>
        ) : <p className={styles.status}>Черновик для согласования</p>}
      </header>
      <article className={`page-panel ${styles.document}`}>
        {sections?.map(section => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            {section.text.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          </section>
        ))}
      </article>
      <nav className="page-actions" aria-label="Связанные разделы">
        <Link href="/rules" className="page-button-secondary">Все документы</Link>
        <Link href="/support" className="page-button-secondary">Контакты и реквизиты</Link>
      </nav>
    </div>
  );
}
