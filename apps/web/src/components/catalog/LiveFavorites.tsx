"use client";
import Link from "next/link";
import { PageHeading } from "@/components/studly/PageHeading";
import { Icon } from "@/components/studly/Icon";
import { useFavorites } from "@/context/FavoritesContext";
import BackButton from "@/components/BackButton";
import { CampusServiceCard } from "@/components/studly/CampusServiceCard";
import { money } from "@/lib/api/catalog";
import { LiveAccess, LiveState } from "@/features/live/shared";

function FavoritesContent() {
  const { serverServices, error, refresh } = useFavorites();
  return <>
    {error && <LiveState error={error} retry={refresh} />}
    {!serverServices ? !error && <LiveState loading /> : !serverServices.length ?
      <div className="page-panel page-empty"><Icon name="heart" /><h2>Здесь пока пусто</h2><p>Добавьте понравившиеся услуги в избранное.</p><Link className="page-button" href="/search">Найти услугу <Icon name="arrow" /></Link></div> :
      <><p className="page-muted" role="status">Сохранено: {serverServices.length}</p><div className="page-grid">{serverServices.map(service =>
        <CampusServiceCard key={service.id} id={service.id} title={service.title} description={service.description}
          price={money(service.price_amount, service.currency)} seller={service.performer.name} profileId={service.performer.id}
          duration={`${service.duration_days} дн.`} isDemo={service.is_demo} />)}</div></>}
  </>;
}
export default function LiveFavorites() {
  return <div className="campus-page"><BackButton /><PageHeading title="Избранное">Список сохраняется в Вашем аккаунте на сервере.</PageHeading>
    <LiveAccess><FavoritesContent /></LiveAccess>
  </div>;
}
