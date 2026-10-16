"use client";

import { useRegistration } from "@/context/RegistrationContext";
import { RegistrationStep } from "@/components/registration/RegistrationShell";
import styles from "@/components/registration/registration.module.css";
import type { RegistrationRole } from "@/types/registration";

const roles: { id: RegistrationRole; title: string; description: string }[] = [
  { id: "customer", title: "Ищу помощь", description: "Находите исполнителей для своих задач" },
  { id: "performer", title: "Оказываю услуги", description: "Делитесь знаниями и предлагайте свои услуги" },
];

export default function RolesPage() {
  const { draft, dispatch, saveStep } = useRegistration();
  return <RegistrationStep step="roles" title="Как вы хотите использовать STUDLY?" intro="Выберите одну или обе роли. Вы сможете развивать свои навыки и находить помощь одновременно.">
    <form className={styles.form} onSubmit={event => {
      event.preventDefault();
      if (draft.roles.length) void saveStep("roles");
    }}>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Ваши роли</legend>
        <div className={styles.roleList}>
          {roles.map(role => <label key={role.id} className={styles.role}>
            <input type="checkbox" name="roles" value={role.id} checked={draft.roles.includes(role.id)}
              onChange={() => dispatch({ type: "role", role: role.id })} />
            <span><strong>{role.title}</strong><small>{role.description}</small></span>
          </label>)}
        </div>
      </fieldset>
      <div className={styles.actions}>
        <button className={styles.primary} type="submit" disabled={!draft.roles.length}>Продолжить</button>
      </div>
    </form>
  </RegistrationStep>;
}
