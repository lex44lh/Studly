"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFavorites } from "@/context/FavoritesContext";
import { Icon } from "@/components/studly/Icon";
import "./service-detail.css";

type Detail = {
  id: number;
  title: string;
  description: string;
  price: string;
  duration: string;
  seller: string;
  profileId: number;
  included: string[];
  category?: string;
  rating?: string;
  isDemo: boolean;
};

export function DetailNavigation() {
  const router = useRouter();
  return <nav className="sd-navigation" aria-label="Навигация по услуге">
    <button type="button" className="sd-back" onClick={() => router.back()}><Icon name="arrow" />Назад</button>
    <Link href="/search">Каталог услуг <Icon name="grid" /></Link>
  </nav>;
}

export function DetailState({ children }: { children: ReactNode }) {
  return <div className="service-detail"><DetailNavigation /><section className="sd-panel sd-state" aria-labelledby="service-title">
    <span className="sd-kicker">STUDLY · УСЛУГА</span><h1 id="service-title" tabIndex={-1}>Детали услуги</h1>{children}
    <Link className="secondary-btn sd-catalog-link" href="/search">Вернуться в каталог <Icon name="arrow" /></Link>
  </section></div>;
}

export function ServiceDetail({ service, extras, order, chat, isDemoMode }: {
  service: Detail;
  extras?: ReactNode;
  order: ReactNode;
  chat: ReactNode;
  isDemoMode: boolean;
}) {
  const { isFavorite, toggleFavorite, isHydrated } = useFavorites();
  const favorite = isHydrated && isFavorite(service.id);
  const initials = service.seller.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join("");
  return <article className="service-detail">
    <DetailNavigation />
    <div className="sd-layout">
      <div className="sd-main">
        <header className="sd-hero sd-panel">
          <div className="sd-hero-top"><span className="sd-tag">{service.category || "Услуга"}</span>
            <button type="button" className="sd-favorite" disabled={!isHydrated} aria-pressed={favorite} aria-label={favorite ? "Убрать из избранного" : "Добавить в избранное"} onClick={() => toggleFavorite(service.id)}><Icon name="heart" /><span>{favorite ? "Сохранено" : "Сохранить"}</span></button>
          </div>
          <p className="sd-kicker">СВОИ ЛЮДИ. НУЖНЫЕ НАВЫКИ.</p>
          <h1 id="service-title" tabIndex={-1}>{service.title}</h1>
          <div className="sd-facts"><div><span>Стоимость услуги</span><strong>{service.price}</strong></div><div><span><Icon name="clock" />Срок выполнения</span><strong>{service.duration}</strong></div></div>
          <div className="sd-ribbon" aria-hidden="true"><span /><span /><span /></div>
        </header>

        <section className="sd-panel sd-performer" aria-labelledby="performer-title">
          <div className="sd-section-label"><span className="sd-step">01</span><h2 id="performer-title">Исполнитель</h2></div>
          <Link href={`/profile/${service.profileId}`} className="sd-profile"><span className="sd-avatar" aria-hidden="true">{initials || <Icon name="user" />}</span><span><strong>{service.seller || "Профиль исполнителя"}</strong>{service.rating && <small>★ {service.rating} · Демо</small>}<span className="sd-profile-link">Открыть профиль <Icon name="arrow" /></span></span></Link>
          <div className="sd-chat">{chat}</div>
        </section>

        <section className="sd-panel sd-description" aria-labelledby="description-title">
          <div className="sd-section-label"><span className="sd-step">02</span><h2 id="description-title">Об услуге</h2></div>
          <p className="sd-prose">{service.description || "Исполнитель пока не добавил описание."}</p>
          <h3>Что входит в услугу</h3>
          {service.included.length ? <ul className="sd-included">{service.included.map((item, index) => <li key={index}><span aria-hidden="true">✓</span>{item}</li>)}</ul> : <p className="sd-muted">Состав услуги пока не указан.</p>}
        </section>

        <section className="sd-panel sd-extras" aria-labelledby="extras-title">
          <div className="sd-section-label"><span className="sd-step">03</span><h2 id="extras-title">Дополнительные услуги</h2></div>
          {extras || <p className="sd-muted">Дополнительные услуги пока недоступны.</p>}
        </section>

        <section className="sd-conditions" aria-labelledby="conditions-title"><Icon name="book" /><div><h2 id="conditions-title">Перед оформлением</h2><p>{isDemoMode ? "Можно обсудить детали в демо-чате. Заказ сохранится только в этом браузере. Настоящих платежей нет." : "Срок и состав указаны выше. Расчёт стоимости предварительный: цена не резервируется. Оформление заказа и чат на этой странице пока недоступны."}</p></div></section>
      </div>

      <aside className="sd-aside">
        <section id="service-order" tabIndex={-1} className="sd-panel sd-order" aria-labelledby="order-title">
          <p className="sd-kicker">{isDemoMode ? "ВАШ ДЕМО-ПРИМЕР" : "ПРОЗРАЧНАЯ СТОИМОСТЬ"}</p>
          <h2 id="order-title">{isDemoMode ? "Оформление заказа" : "Расчёт стоимости"}</h2>
          <p className="sd-muted">{isDemoMode ? "Выберите нужные дополнения — сумма и срок обновятся." : "Стоимость и комиссия из расчёта STUDLY."}</p>
          <div className="sd-order-action">{order}</div>
          <p className="sd-order-note">{isDemoMode ? "Только локальный пример. Деньги не списываются." : "Оплата не выполняется. Итог определяется сервером."}</p>
        </section>
        {service.isDemo && <p className="sd-demo-note" role="note"><span>ДЕМО</span>{isDemoMode ? "Демонстрационная услуга. Данные вымышлены." : "Демонстрационная услуга из API. Это не реальное предложение."}</p>}
        <Link href="/search" className="sd-explore">Посмотреть другие услуги <Icon name="arrow" /></Link>
      </aside>
    </div>

    <div className="sd-mobile-dock"><span><small>Стоимость услуги</small><strong>{service.price}</strong></span><a className="primary-btn" href="#service-order">{isDemoMode ? "К оформлению" : "К расчёту"}<Icon name="arrow" /></a></div>
  </article>;
}
