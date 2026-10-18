"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import BrandMark from "@/components/BrandMark";
import { useAuth } from "@/context/AuthContext";
import { demoMode } from "@/lib/data-mode";
import { useCampusPlatform, type CampusTheme } from "@/lib/telegram/campus-platform";
import { Icon, type IconName } from "./Icon";
import "./tokens.css";
import "./campus.css";

const navigation: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Главная", icon: "home" },
  { href: "/search", label: "Поиск", icon: "search" },
  { href: "/favorites", label: "Избранное", icon: "heart" },
  { href: "/chats", label: "Чаты", icon: "chat" },
  { href: "/profile", label: "Профиль", icon: "user" },
];
const moreLinks = [
  ["/create-service", "Предложить услугу"], ["/orders", "Мои заказы"], ["/notifications", "Уведомления"],
  ["/support", "Поддержка"], ["/safety", "Безопасность"], ["/rules", "Правила"], ["/about", "О STUDLY"],
];

export function CampusShell({ children }: { children: ReactNode }) {
  const { sdkReady } = useAuth();
  const platform = useCampusPlatform(sdkReady);
  const [manualTheme, setManualTheme] = useState<CampusTheme>("auto");
  const theme = manualTheme === "auto" ? platform.theme : manualTheme;
  const menu = useRef<HTMLDialogElement>(null);
  function toggleTheme() {
    const dark = theme === "dark" || (theme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setManualTheme(dark ? "light" : "dark");
  }
  return <div className="studly-app" data-theme={theme} style={platform.style}>
    <div className="app">
      <a href="#search-title" className="skip-link">Перейти к каталогу</a>
      <header className="topbar">
        <Link href="/" className="brand" aria-label="STUDLY — главная"><span className="brand-mark"><BrandMark size={36} /></span><span>STUDLY</span></Link>
        <nav className="desktop-nav" aria-label="Основная навигация">{navigation.slice(0, 4).map(item => <Link key={item.href} href={item.href} className={`nav-item${item.href === "/search" ? " is-active" : ""}`} aria-current={item.href === "/search" ? "page" : undefined}>{item.label}</Link>)}</nav>
        <div className="header-actions">
          <span className="demo-label" title={demoMode ? "Демонстрационные данные. Реальных заказов и платежей нет." : "Данные Django API"}>{demoMode ? "ДЕМО" : "LIVE"}</span>
          <Link href="/create-service" className="publish-btn">Предложить услугу</Link>
          <button type="button" className="icon-btn theme-toggle" onClick={toggleTheme} aria-label="Переключить светлую и тёмную тему"><span className="theme-light-icon"><Icon name="moon" /></span><span className="theme-dark-icon"><Icon name="sun" /></span></button>
          <button type="button" className="icon-btn menu-toggle" onClick={() => menu.current?.showModal()} aria-label="Открыть меню"><Icon name="menu" /></button>
        </div>
      </header>
      <main className="workspace">{children}</main>
      <nav className="bottom-nav" aria-label="Нижняя навигация">{navigation.map(item => <Link key={item.href} href={item.href} className={`bottom-item${item.href === "/search" ? " is-active" : ""}`} aria-current={item.href === "/search" ? "page" : undefined}><Icon name={item.icon} /><span>{item.label}</span></Link>)}</nav>
      <dialog ref={menu} className="menu-dialog" aria-labelledby="campus-menu-title" onClick={event => { if (event.target === event.currentTarget) menu.current?.close(); }}>
        <div className="dialog-inner"><div className="dialog-heading"><h2 id="campus-menu-title">Меню STUDLY</h2><button type="button" className="icon-btn" aria-label="Закрыть меню" onClick={() => menu.current?.close()}><Icon name="close" /></button></div>
          <nav className="menu-links" aria-label="Все разделы">{[...navigation.map(item => [item.href, item.label]), ...moreLinks].map(([href, label]) => <Link key={href} href={href} onClick={() => menu.current?.close()}>{label}</Link>)}</nav>
          <button type="button" className="secondary-btn system-theme" onClick={() => setManualTheme("auto")}>Тема Telegram / системы</button>
          {demoMode && <p role="note">Демонстрационный режим. Данные вымышлены; настоящие платежи и регистрация аккаунта недоступны.</p>}
        </div>
      </dialog>
    </div>
  </div>;
}
