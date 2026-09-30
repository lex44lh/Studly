"use client";

import { useEffect, useState } from "react";
import { useFavorites } from "@/context/FavoritesContext";
import ServiceCard from "@/components/ServiceCard";
import BackButton from "@/components/BackButton";

export default function FavoritesPage() {
  const { favorites } = useFavorites();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const allServices = [
    {
      id: 1,
      title: "Помогу с C++",
      price: "500 ₽",
      seller: "Иван Петров",
      rating: "4.9 (126 отзывов)",
    },
    {
      id: 2,
      title: "Помощь с Python",
      price: "900 ₽",
      seller: "Дмитрий Иванов",
      rating: "5.0 (54 отзыва)",
    },
    {
      id: 3,
      title: "Напишу Telegram-бота",
      price: "2000 ₽",
      seller: "Алексей Смирнов",
      rating: "4.8 (64 отзыва)",
    },
    {
      id: 100,
      title: "Репетитор по английскому",
      price: "700 ₽",
      seller: "Анна Смирнова",
      rating: "4.8 (93)",
    },
    {
      id: 101,
      title: "Монтаж видео",
      price: "1200 ₽",
      seller: "Максим Козлов",
      rating: "4.9 (41)",
    },
  ];

  const favoriteServices = allServices.filter((service) =>
    favorites.includes(service.id)
  );

  return (
    <div>
      <BackButton />

      <h1>Избранное ❤️</h1>

      {!mounted ? (
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
