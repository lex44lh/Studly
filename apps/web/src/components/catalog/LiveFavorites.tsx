"use client";
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
    {count > 1 && <div>
      <p>Группа {group + 1} из {count}</p>
      <button type="button" disabled={!group} onClick={() => { setGroup(group - 1); setPage(""); }}>Предыдущая группа</button>
      <button type="button" disabled={group + 1 >= count} onClick={() => { setGroup(group + 1); setPage(""); }}>Следующая группа</button>
    </div>}
  </>;
}
export default function LiveFavorites() {
  const { favorites, isHydrated } = useFavorites();
  return <div><BackButton /><h1>Избранное ❤️</h1><p>Список сохраняется только в этом браузере.</p>
    {!isHydrated ? <p>Загрузка…</p> : !favorites.length ? <p>У Вас пока нет избранных услуг</p> : <FavoritePages key={favorites.join(",")} ids={favorites} />}
  </div>;
}
