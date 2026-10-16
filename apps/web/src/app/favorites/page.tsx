"use client";

import { useFavorites } from "@/context/FavoritesContext";
import ServiceCard from "@/components/ServiceCard";
import BackButton from "@/components/BackButton";
import services from "@/data/services";
import { demoMode } from "@/lib/api/catalog";
import LiveFavorites from "@/components/catalog/LiveFavorites";

function DemoFavoritesPage() {
  const { favorites, isHydrated } = useFavorites();

  const favoriteServices = services.filter((service) =>
    favorites.includes(service.id)
  );

  return (
    <div>
      <BackButton />

      <h1>Избранное ❤️</h1>

      {!isHydrated ? (
        <p>Загрузка...</p>
      ) : favoriteServices.length === 0 ? (
        <p>У Вас пока нет избранных услуг</p>
      ) : (
        favoriteServices.map((service) => (
          <ServiceCard
            key={service.id}
            id={service.id}
            title={service.title}
            price={service.price}
            seller={service.seller}
            rating={service.rating}
          />
        ))
      )}
    </div>
  );
}

export default function FavoritesPage() { return demoMode ? <DemoFavoritesPage /> : <LiveFavorites />; }
