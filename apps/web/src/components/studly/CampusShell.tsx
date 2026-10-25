"use client";

import { useOptionalDemoWorkspace } from "@/features/demo-workspace/Provider";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import BrandMark from "@/components/BrandMark";
import { useAuth } from "@/context/AuthContext";
import { demoMode } from "@/lib/data-mode";
import { useCampusPlatform, type CampusTheme } from "@/lib/telegram/campus-platform";
import { Icon, type IconName } from "./Icon";
import "./tokens.css";
import "./campus.css";
import "./campus-pages.css";

const navigation: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Главная", icon: "home" },
  { href: "/search", label: "Поиск", icon: "search" },
  { href: "/favorites", label: "Избранное", icon: "heart" },
  { href: "/chats", label: "Чаты", icon: "chat" },
  { href: "/profile", label: "Профиль", icon: "user" },
];
const categoryLinks = [
  ["programming", "Программирование"], ["courseworks", "Помощь с курсовыми"],
  ["homework", "Помощь с заданиями"], ["tutoring", "Репетиторство"],
  ["engineering", "Инженерная графика"], ["presentations", "Презентации"],
  ["reports", "Рефераты и отчёты"], ["video", "Видеомонтаж"],
];
const moreLinks = [
  ["/create-service", "Предложить услугу"], ["/orders", "Мои заказы"], ["/notifications", "Уведомления"],
  ["/support", "Поддержка"], ["/safety", "Безопасность"], ["/rules", "Правила"], ["/about", "О STUDLY"],
];

export function CampusShell({ children, skipLabel = "Перейти к каталогу", variant = "reference" }: {
  children: ReactNode;
  /** Legacy prop; the shell owns a stable skip target even when page content fails. */
  contentId?: string;
  skipLabel?: string; isSearchPage?: boolean; variant?: "reference" | "standard" | "onboarding";
}) {
  const pathname = usePathname();
  const workspace = useOptionalDemoWorkspace();
  const administration = pathname === "/admin";
  const onboarding = variant === "onboarding";
  const activeHref = pathname === "/" ? "/" : /^\/(search|service|category)(\/|$)/.test(pathname) ? "/search" : pathname.startsWith("/favorites") ? "/favorites" : pathname.startsWith("/chats") ? "/chats" : /^\/(profile|orders|create-service)(\/|$)/.test(pathname) ? "/profile" : "";
  const currentFor = (href: string) => href === activeHref ? (pathname === href ? "page" as const : "location" as const) : undefined;
  const { sdkReady } = useAuth();
  const platform = useCampusPlatform(sdkReady);
  const [manualTheme, setManualTheme] = useState<CampusTheme>("auto");
  const theme = manualTheme === "auto" ? platform.theme : manualTheme;
  const menu = useRef<HTMLDialogElement>(null);
  function toggleTheme() {
    const dark = theme === "dark" || (theme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setManualTheme(dark ? "light" : "dark");
  }
  return <div className={`studly-app campus-shell-${variant}`} data-theme={theme} style={platform.style}>
    <div className="app">
      <a href="#campus-content" className="skip-link">{skipLabel}</a>
      <header className="topbar">
        <Link href="/" className="brand" aria-label="STUDLY — главная"><span className="brand-mark"><BrandMark size={36} /></span><span>STUDLY</span></Link>
        {!onboarding && !administration && <nav className="desktop-nav" aria-label="Основная навигация">{navigation.slice(0, 4).map(item => <Link key={item.href} href={item.href} className={`nav-item${item.href === activeHref ? " is-active" : ""}`} aria-current={currentFor(item.href)}>{item.label}</Link>)}</nav>}
        <div className="header-actions">
          <span className="demo-label" title={demoMode ? "Демонстрационные данные. Реальных заказов и платежей нет." : "Данные Django API"}>{demoMode ? "ДЕМО" : "LIVE"}</span>
          {!onboarding && !administration && <Link href="/create-service" className="publish-btn">Предложить услугу</Link>}
          <button type="button" className="icon-btn theme-toggle" onClick={toggleTheme} aria-label="Переключить светлую и тёмную тему"><span className="theme-light-icon"><Icon name="moon" /></span><span className="theme-dark-icon"><Icon name="sun" /></span></button>
          <button type="button" className="icon-btn menu-toggle" onClick={() => menu.current?.showModal()} aria-label="Открыть меню"><Icon name="menu" /></button>
        </div>
      </header>
      <main className="workspace" id="campus-content" tabIndex={-1}>{children}</main>
      {!onboarding && !administration && <nav className="bottom-nav" aria-label="Нижняя навигация">{navigation.map(item => <Link key={item.href} href={item.href} className={`bottom-item${item.href === activeHref ? " is-active" : ""}`} aria-current={currentFor(item.href)}><Icon name={item.icon} /><span>{item.label}</span></Link>)}</nav>}
      <dialog ref={menu} className="menu-dialog" aria-labelledby="campus-menu-title" onClick={event => { if (event.target === event.currentTarget) menu.current?.close(); }}>
        <div className="dialog-inner"><div className="dialog-heading"><h2 id="campus-menu-title">Меню STUDLY</h2><button type="button" className="icon-btn" aria-label="Закрыть меню" onClick={() => menu.current?.close()}><Icon name="close" /></button></div>
          <nav className="menu-links" aria-label="Все разделы">{[...navigation.map(item => [item.href, item.label]), ...moreLinks].map(([href, label]) => <Link key={href} href={href} onClick={() => menu.current?.close()}>{label}</Link>)}</nav>
          {workspace?.state?.account && <p className="page-muted">Демо-аккаунт · {workspace.state.account.name} · {workspace.state.account.activeRole === "customer" ? "Ищу помощь" : "Оказываю услуги"}</p>}
          {workspace?.sandboxEnabled && <Link href="/admin" onClick={() => menu.current?.close()}>Административный Demo-sandbox</Link>}
          <h3 className="campus-menu-subtitle">Категории услуг</h3>
          <nav className="menu-links" aria-label="Категории услуг">{categoryLinks.map(([slug,label]) => <Link key={slug} href={`/category/${slug}`} onClick={() => menu.current?.close()}>{label}</Link>)}</nav>
          <button type="button" className="secondary-btn system-theme" onClick={() => setManualTheme("auto")}>Тема Telegram / системы</button>
          {demoMode && <p role="note">Демонстрационный режим. Данные вымышлены; настоящие платежи и регистрация аккаунта недоступны.</p>}
        </div>
      </dialog>
    </div>
  </div>;
}
