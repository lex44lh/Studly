import Link from "next/link";
import { notFound } from "next/navigation";
import { emailAuthUiEnabled } from "@/lib/data-mode";
import styles from "@/components/registration/registration.module.css";
export const metadata = { title: "Пароль изменён — STUDLY", robots: { index: false, follow: false } };

export default function EmailResetCompletePage() {
  if (!emailAuthUiEnabled) notFound();
  return <section className={styles.screen} aria-labelledby="email-reset-title"><div className={styles.container}><div className={styles.panel}>
    <h1 className={styles.title} id="email-reset-title">Пароль изменён</h1>
    <p className={styles.intro} role="status">Пароль изменён. Войдите с новым паролем.</p>
    <Link href="/auth/email" className={styles.primary}>Перейти ко входу</Link>
  </div></div></section>;
}
