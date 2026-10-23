import WelcomeAction from "@/features/demo-workspace/WelcomeAction";
import { Icon } from "@/components/studly/Icon";
import styles from "./welcome.module.css";

export default function WelcomePage() {
  return (
    <section className={styles.welcome} aria-labelledby="welcome-title">
      <div className={styles.copy}>
        <p className={styles.eyebrow}><span />Студенческий кампус онлайн</p>
        <h1 id="welcome-title">Добро<br />пожаловать!</h1>
        <p className={styles.intro}>Находите нужную помощь, делитесь знаниями и развивайтесь вместе со STUDLY.</p>
        <div className={styles.action}>
          <WelcomeAction className={styles.start}/>
          <p>Платформа студенческих услуг</p>
        </div>
      </div>
      <div className={styles.campus} aria-hidden="true">
        <div className={styles.campusTop}><span>STUDLY / КАМПУС</span><Icon name="grid" /></div>
        <div className={styles.notebook}>
          <span className={styles.notebookLabel}>Место для твоих идей</span>
          <span className={styles.notebookTitle}>Знания.<br />Помощь.<br />Возможности.</span>
          <span className={styles.notebookFooter}>Твой ясный ритм <Icon name="arrow" /></span>
        </div>
        <div className={styles.note}><Icon name="book" /><span>Учиться<br /><strong>вместе проще</strong></span></div>
        <span className={styles.campusBottom}>НАХОДИ СВОЁ / ДЕЛИСЬ ТЕМ, ЧТО УМЕЕШЬ</span>
      </div>
    </section>
  );
}
