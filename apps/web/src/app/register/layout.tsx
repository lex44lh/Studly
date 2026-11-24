import { demoMode, emailAuthUiEnabled } from "@/lib/data-mode";
import { EmailRegistrationGate } from "@/features/email-auth/EmailRegistrationGate";
import Link from "next/link";
import { Icon } from "@/components/studly/Icon";
import { RegistrationProvider } from "@/context/RegistrationContext";
import styles from "@/components/registration/registration.module.css";

export default function RegistrationLayout({ children }: { children: React.ReactNode }) {
  // The published onboarding stays closed until both rollout and API allow registration.
  if (process.env.NODE_ENV !== "development" && !demoMode) {
    const closed = <section className={styles.screen} aria-labelledby="registration-unavailable-title">
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
    return emailAuthUiEnabled ? <EmailRegistrationGate closed={closed}>{children}</EmailRegistrationGate> : closed;
  }
  return <RegistrationProvider>{children}</RegistrationProvider>;
}
