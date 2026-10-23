import { demoMode } from "@/lib/data-mode";
import Link from "next/link";
import { Icon } from "@/components/studly/Icon";
import { RegistrationProvider } from "@/context/RegistrationContext";
import styles from "@/components/registration/registration.module.css";

export default function RegistrationLayout({ children }: { children: React.ReactNode }) {
  // Until Django is connected, forms are a development-only preview.
  if (process.env.NODE_ENV !== "development" && !demoMode) {
    return <section className={styles.screen} aria-labelledby="registration-unavailable-title">
      <div className={`${styles.container} ${styles.center}`}>
        <p className={styles.eyebrow}>Знакомство со STUDLY</p>
        <div className={styles.panel}>
        <div className={styles.stateIcon}><Icon name="user" /></div>
        <h1 id="registration-unavailable-title" className={styles.title}>Регистрация скоро появится</h1>
        <p className={styles.intro}>Пока вы можете посмотреть услуги в каталоге STUDLY.</p>
        <Link className={styles.primary} href="/">Перейти в каталог</Link>
        </div>
      </div>
    </section>;
  }
  return <RegistrationProvider>{children}</RegistrationProvider>;
}
