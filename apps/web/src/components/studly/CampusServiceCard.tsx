"use client";

import Link from "next/link";
import { useFavorites } from "@/context/FavoritesContext";
import { Icon } from "./Icon";

type Props = { id: number; title: string; price: string; seller: string; rating?: string; description?: string; duration?: string; category?: string; profileId?: number; isDemo?: boolean };

// Abstract covers describe known categories; they never pretend to be seller photos.
function coverFor(category?: string) {
  if (!category) return { kind: "code", symbol: "↗", label: "STUDLY · УСЛУГИ" };
  if (/программ/i.test(category)) return { kind: "code", symbol: "{ }", label: category };
  if (/видео/i.test(category)) return { kind: "video", symbol: "▶", label: category };
  if (/презентац|дизайн/i.test(category)) return { kind: "design", symbol: "Aa", label: category };
  if (/репетитор/i.test(category)) return { kind: "math", symbol: "∑", label: category };
  return { kind: "career", symbol: "→", label: category };
}

export function CampusServiceCard({ id, title, price, seller, rating, description, duration, category, profileId, isDemo }: Props) {
  const { isFavorite, toggleFavorite, isHydrated } = useFavorites();
  const favorite = isHydrated && isFavorite(id);
  const cover = coverFor(category);
  const initials = seller.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join("");
  return <article className="service-card" data-kind={cover.kind} data-service-id={id}>
    <div className="service-cover"><span className="cover-label">{cover.label}</span><span className="cover-symbol" aria-hidden="true">{cover.symbol}</span>
      <button type="button" className="favorite-btn" disabled={!isHydrated} aria-label={`${favorite ? "Убрать из избранного" : "Добавить в избранное"}: ${title}`} aria-pressed={favorite} onClick={() => toggleFavorite(id)}><Icon name="heart" /></button>
    </div>
    <div className="card-body">
      <span className="card-category">{category || "Услуга"}{isDemo ? " · Демо" : ""}</span>
      <h3 className="service-title">{title}</h3>
      {description && <p className="service-description">{description}</p>}
      <div className="performer"><span className="avatar" aria-hidden="true">{initials}</span><span className="performer-copy">
        {profileId ? <Link href={`/profile/${profileId}`} className="performer-name">{seller}</Link> : <strong className="performer-name">{seller}</strong>}
        {rating && <span className="performer-specialty">★ {rating}</span>}
      </span></div>
      <div className="card-bottom"><span className="price-block"><strong className="price">{price}</strong></span>{duration && <span className="delivery"><Icon name="clock" />{duration}</span>}</div>
      <Link className="detail-btn" href={`/service/${id}`}>Посмотреть услугу</Link>
    </div>
  </article>;
}
