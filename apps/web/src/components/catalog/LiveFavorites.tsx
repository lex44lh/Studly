"use client";
import Link from "next/link";
import { PageHeading } from "@/components/studly/PageHeading";
import { Icon } from "@/components/studly/Icon";
import { useState } from "react";
import { useFavorites } from "@/context/FavoritesContext";
import BackButton from "@/components/BackButton";
import ServiceList from "./ServiceList";
function FavoritePages({ ids }: { ids: number[] }) {
  const [group, setGroup] = useState(0);
  const [page, setPage] = useState("");
  const count = Math.ceil(ids.length / 100);
  return <>
    <ServiceList key={`${group}:${ids.join(",")}`} query={page || `ids=${ids.slice(group * 100, (group + 1) * 100).join(",")}`} onPage={setPage} />
    {count > 1 && <div className="page-pagination">
      <p>Группа {group + 1} из {count}</p>
      <button type="button" disabled={!group} onClick={() => { setGroup(group - 1); setPage(""); }}>Предыдущая группа</button>
      <button type="button" disabled={group + 1 >= count} onClick={() => { setGroup(group + 1); setPage(""); }}>Следующая группа</button>
    </div>}
  </>;
}
export default function LiveFavorites() {
  const { favorites, isHydrated } = useFavorites();
  return <div className="campus-page"><BackButton /><PageHeading title="Избранное">Список сохраняется только в этом браузере.</PageHeading>
    {!isHydrated ? <div className="page-resource" role="status">Загрузка…</div> : !favorites.length ? <div className="page-panel page-empty"><Icon name="heart" /><h2>Здесь пока пусто</h2><p>У Вас пока нет избранных услуг.</p><Link className="page-button" href="/search">Найти услугу <Icon name="arrow" /></Link></div> : <FavoritePages key={favorites.join(",")} ids={favorites} />}
  </div>;
}
