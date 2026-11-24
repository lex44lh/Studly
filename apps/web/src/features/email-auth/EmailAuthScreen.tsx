"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { authClient, type AuthOptions } from "@/lib/api/auth";
import { registrationClient } from "@/lib/api/registration";
import { emailAuthError, parseEmailAction, type EmailAction } from "./flow";
import styles from "@/components/registration/registration.module.css";

type Screen = "login" | "register" | "forgot" | "verify" | "reset";
const titles: Record<Screen, string> = {
  login: "Вход в STUDLY", register: "Регистрация по почте", forgot: "Восстановление пароля",
  verify: "Подтверждение почты", reset: "Новый пароль",
};
const neutral = "Если действие доступно, инструкция отправлена на почту.";

export function EmailAuthScreen() {
  const { state } = useAuth();
  const [options, setOptions] = useState<AuthOptions | null>(null);
  const [action, setAction] = useState<EmailAction>(null);
  const [screen, setScreen] = useState<Screen>("login");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sessionCheckFailed, setSessionCheckFailed] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const active = useRef<AbortController | null>(null);

  useEffect(() => {
    function readAction() {
      const url = new URL(location.href);
      const next = parseEmailAction(url.hash);
      if (!next) return;
      history.replaceState(history.state, "", url.pathname + url.search);
      active.current?.abort();
      queueMicrotask(() => {
        setAction(next);
        setNotice("");
        setError(next?.kind === "invalid" ? "Ссылка недействительна. Запросите новое письмо." : "");
        if (next?.kind === "verify" || next?.kind === "reset") setScreen(next.kind);
      });
    }
    readAction();
    window.addEventListener("hashchange", readAction);
    return () => window.removeEventListener("hashchange", readAction);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    authClient.options(controller.signal).then(value => {
      if (!controller.signal.aborted) { setOptions(value); setReady(true); }
    }).catch(() => { if (!controller.signal.aborted) setReady(true); });
    return () => { controller.abort(); active.current?.abort(); };
  }, [refresh]);

  const allowsLogin = options?.email_login === true;
  const allowsRegistration = options?.email_registration === true;
  const mode = screen === "login" && !allowsLogin && allowsRegistration ? "register" : screen;
  const registration = mode === "register" || mode === "verify";
  const available = registration ? allowsRegistration : allowsLogin;
  const isSignedIn = state.status === "authenticated";
  const locked = isSignedIn && mode !== "reset";

  function navigate(next: Screen) {
    setScreen(next); setAction(null); setError(""); setNotice("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (active.current || !available || locked || sessionCheckFailed) return;
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "");
    const password = value("password");
    if ((mode === "verify" || mode === "reset") && password !== value("passwordConfirmation")) {
      setError("Пароли не совпадают."); return;
    }
    const controller = new AbortController();
    active.current = controller;
    setBusy(true); setError(""); setNotice("");
    try {
      const { signal } = controller;
      if (mode === "register" || mode === "forgot") {
        if (mode === "register") await authClient.emailRegister(value("email").trim(), signal);
        else await authClient.emailResetRequest(value("email").trim(), signal);
        setNotice(neutral);
      } else if (mode === "reset" && action?.kind === "reset") {
        await authClient.emailResetConfirm({ token: action.token, password }, signal);
        // Reload the shell so it no longer holds the revoked identity.
        location.replace("/auth/email/reset-complete");
      } else if (mode === "login") {
        const { user } = await authClient.emailLogin({ identifier: value("identifier").trim(), password }, signal);
        await finishSignIn(user.id, signal);
      } else if (mode === "verify" && action?.kind === "verify") {
        const { user } = await authClient.emailVerify({ token: action.token, username: value("username").trim(), password }, signal);
        await finishSignIn(user.id, signal);
      }
    } catch (cause) {
      if (!controller.signal.aborted) setError(emailAuthError(cause));
    } finally {
      if (active.current === controller) { active.current = null; setBusy(false); }
    }
  }

  async function finishSignIn(userId: number, signal: AbortSignal) {
    try {
      await authClient.confirmEmailSession(userId, signal);
      const profile = await registrationClient.loadDraft(signal);
      signal.throwIfAborted();
      location.replace(profile.status.is_complete || !allowsRegistration ? "/profile" : "/register/roles");
    } catch {
      if (signal.aborted) return;
      setSessionCheckFailed(true);
      setError("Вход принят, но состояние сессии или профиля не удалось подтвердить. Откройте кабинет, чтобы проверить её, без повторной отправки.");
    }
  }

  const needsNewPassword = mode === "verify" || mode === "reset";
  return <section className={styles.screen} aria-labelledby="email-auth-title"><div className={styles.container}><div className={styles.panel}>
    <h1 className={styles.title} id="email-auth-title">{titles[mode]}</h1>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    {!ready || state.status === "loading" ? <p role="status">Проверяем доступные способы входа…</p> : !options ?
      <><p role="alert">Не удалось проверить доступность входа.</p><button className={styles.secondary} onClick={() => { setReady(false); setRefresh(value => value + 1); }}>Повторить</button></> : sessionCheckFailed ? <Link className={styles.primary} href="/profile" onClick={event => { event.preventDefault(); location.replace("/profile"); }}>Проверить кабинет</Link> : locked ?
      <><p className={styles.intro}>Вы уже вошли в STUDLY.</p><Link className={styles.primary} href="/profile">Перейти в кабинет</Link>{allowsRegistration && <Link className={styles.back} href="/register/roles">Продолжить настройку профиля</Link>}</> : available ?
      <form key={mode} className={styles.form} onSubmit={submit} aria-busy={busy}>
        {mode === "login" && <label className={styles.field}><span className={styles.label}>Почта или логин</span><input className={styles.input} name="identifier" autoComplete="username" autoCapitalize="none" maxLength={254} required /></label>}
        {(mode === "register" || mode === "forgot") && <label className={styles.field}><span className={styles.label}>Электронная почта</span><input className={styles.input} name="email" type="email" autoComplete="email" maxLength={254} required /></label>}
        {mode === "verify" && <label className={styles.field}><span className={styles.label}>Логин</span><input className={styles.input} name="username" autoComplete="username" autoCapitalize="none" pattern="[a-zA-Z0-9][a-zA-Z0-9._\\-]{2,31}" title="3–32 символа: латинские буквы, цифры, точка, дефис или подчёркивание" required /></label>}
        {(mode === "login" || needsNewPassword) && <label className={styles.field}><span className={styles.label}>{needsNewPassword ? "Новый пароль" : "Пароль"}</span><input className={styles.input} name="password" type="password" autoComplete={needsNewPassword ? "new-password" : "current-password"} minLength={needsNewPassword ? 12 : undefined} maxLength={128} required />{needsNewPassword && <span className={styles.hint}>От 12 до 128 символов.</span>}</label>}
        {needsNewPassword && <label className={styles.field}><span className={styles.label}>Повторите пароль</span><input className={styles.input} name="passwordConfirmation" type="password" autoComplete="new-password" maxLength={128} required /></label>}
        <button className={styles.primary} type="submit" disabled={busy}>{busy ? "Отправляем…" : mode === "login" ? "Войти" : mode === "reset" ? "Сохранить пароль" : mode === "verify" ? "Подтвердить почту" : "Отправить письмо"}</button>
      </form> : <p className={styles.intro}>Этот способ входа сейчас недоступен.</p>}
    <div className={styles.actions}>
      {!sessionCheckFailed && !locked && allowsLogin && mode !== "login" && <button className={styles.secondary} disabled={busy} onClick={() => navigate("login")}>Войти с паролем</button>}
      {!sessionCheckFailed && !locked && allowsRegistration && mode !== "register" && <button className={styles.secondary} disabled={busy} onClick={() => navigate("register")}>Создать аккаунт</button>}
      {!sessionCheckFailed && !locked && allowsLogin && mode !== "forgot" && <button className={styles.secondary} disabled={busy} onClick={() => navigate("forgot")}>Забыли пароль?</button>}
      <Link className={styles.back} href="/search">Перейти в каталог</Link>
    </div>
  </div></div></section>;
}
