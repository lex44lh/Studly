import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import { RegistrationProvider } from "@/context/RegistrationContext";
import styles from "@/components/registration/registration.module.css";

export default function RegistrationLayout({ children }: { children: React.ReactNode }) {
  // Until Django is connected, forms are a development-only preview.
  if (process.env.NODE_ENV !== "development") {
    return <main className={styles.screen}>
      <div className={`${styles.container} ${styles.center}`}>
        <div className={styles.brand}><BrandMark size={42} /><span>STUDLY</span></div>
        <h1 className={styles.title}>Регистрация скоро появится</h1>
        <p className={styles.intro}>Пока вы можете посмотреть услуги в каталоге STUDLY.</p>
        <Link className={styles.primary} href="/">Перейти в каталог</Link>
      </div>
    </main>;
  }
  return <RegistrationProvider>{children}</RegistrationProvider>;
}
