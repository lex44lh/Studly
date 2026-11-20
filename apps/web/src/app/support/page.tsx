import Link from "next/link";
import { Icon } from "@/components/studly/Icon";
import styles from "../information.module.css";
import { getApprovedLegalPublication } from "../rules/publication";
import { legalPreviewEnabled } from "../rules/preview";

export default function SupportPage() {
  const operator = getApprovedLegalPublication()?.operator;
  const preview = !operator && legalPreviewEnabled();
  return (
    <div className={`campus-page ${styles.page}`}>
      <header className={styles.heading}>
        <p className="page-eyebrow">О платформе</p>
        <h1 className="page-heading">Контакты и реквизиты</h1>
        <p className="page-muted">Раздел связи со STUDLY.</p>
      </header>
      {operator ? (
        <section className={`page-panel ${styles.document}`} aria-labelledby="operator-title">
          <h2 id="operator-title">{operator.name}</h2>
          <dl>
            <dt>ИНН</dt><dd>{operator.inn}</dd>
            <dt>ОГРНИП</dt><dd>{operator.ogrnip}</dd>
            <dt>Адрес для корреспонденции</dt><dd>{operator.address}</dd>
            <dt>Телефон поддержки</dt><dd><a href={`tel:${operator.phone.replace(/[^+\d]/g, "")}`}>{operator.phone}</a></dd>
            {operator.email && <><dt>Электронная почта</dt><dd><a href={`mailto:${operator.email}`}>{operator.email}</a></dd></>}
          </dl>
        </section>
      ) : (
        <section className={`page-panel ${styles.state}`} aria-labelledby="support-state-title">
          <span className={styles.stateIcon}><Icon name="chat" size={30} /></span>
          <h2 id="support-state-title">Контакты и реквизиты готовятся</h2>
          {preview && <p>Для публикации нужны данные зарегистрированного ИП, публичный адрес и телефон поддержки.</p>}
        </section>
      )}
      <nav className="page-actions" aria-label="О платформе">
        <Link href="/rules" className="page-button-secondary">Документы STUDLY</Link>
        <Link href="/about" className="page-button-secondary">О STUDLY</Link>
      </nav>
    </div>
  );
}
