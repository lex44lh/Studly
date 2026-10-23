"use client";

import Link from "next/link";
import { useFavorites } from "@/context/FavoritesContext";
import ServiceCard from "@/components/ServiceCard";
import BackButton from "@/components/BackButton";
import { useDemoCatalog } from "@/features/demo-workspace/catalog";
import { demoMode } from "@/lib/api/catalog";
import LiveFavorites from "@/components/catalog/LiveFavorites";
import { PageHeading } from "@/components/studly/PageHeading";
import { Icon } from "@/components/studly/Icon";

function DemoFavoritesPage() {
  const services = useDemoCatalog();
  const { favorites, isHydrated } = useFavorites();
  const favoriteServices = services.filter(service => favorites.includes(service.id));
  return <div className="campus-page"><BackButton /><PageHeading title="Избранное">Предложения, к которым хочется вернуться. Список сохраняется в этом браузере.</PageHeading>
    {!isHydrated ? <div className="page-resource" role="status">Загрузка…</div> : favoriteServices.length === 0 ? <div className="page-panel page-empty"><Icon name="heart" /><h2>Здесь пока пусто</h2><p>У Вас пока нет избранных услуг. Нажмите на сердечко рядом с понравившимся предложением.</p><Link href="/search" className="page-button">Найти услугу <Icon name="arrow" /></Link></div> : <div className="page-grid">{favoriteServices.map(service => <ServiceCard key={service.id} {...service} isDemo />)}</div>}
  </div>;
}
export default function FavoritesPage() { return demoMode ? <DemoFavoritesPage /> : <LiveFavorites />; }
