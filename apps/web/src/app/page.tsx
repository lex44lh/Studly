"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ServiceCard from "@/components/ServiceCard";
import services from "@/data/services";

export default function HomePage() {
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");

  const categories = [
    {
      slug: "homework",
      title: "📚 Помощь с заданиями",
    },
    {
      slug: "tutoring",
      title: "👨‍🏫 Репетиторство",
    },
    {
      slug: "programming",
      title: "💻 Программирование",
    },
    {
      slug: "video",
      title: "🎬 Видеомонтаж",
    },
  ];

  const popularServices = services.slice(0, 4);

  const handleSearch = () => {
    const query = searchQuery.trim();

    if (!query) {
      router.push("/search");
      return;
    }

    router.push(
      `/search?q=${encodeURIComponent(query)}`
    );
  };

  return (
    <div>
      {/* Поиск */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          handleSearch();
        }}
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "24px",
        }}
      >
        <input
          type="search"
          value={searchQuery}
          onChange={(event) =>
            setSearchQuery(event.target.value)
          }
          placeholder="Поиск услуг..."
          style={{
            flex: 1,
            height: "44px",
            border: "1px solid #E5E7EB",
            borderRadius: "12px",
            padding: "0 12px",
            fontSize: "14px",
            outline: "none",
            boxSizing: "border-box",
          }}
        />

        <button
          type="submit"
          style={{
            width: "44px",
            height: "44px",
            border: "1px solid #E5E7EB",
            borderRadius: "12px",
            background: "#FFFFFF",
            cursor: "pointer",
            fontSize: "18px",
          }}
          aria-label="Найти"
        >
          🔍
        </button>
      </form>

      {/* Категории */}
      <h2>Популярные категории</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
          marginBottom: "32px",
        }}
      >
        {categories.map((category) => (
          <Link
            key={category.slug}
            href={`/category/${category.slug}`}
            style={{
              background: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: "12px",
              padding: "16px",
              textAlign: "center",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            {category.title}
          </Link>
        ))}
      </div>

      {/* Услуги */}
      <h2>Популярные услуги</h2>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {popularServices.map((service) => (
          <ServiceCard
            key={service.id}
            id={service.id}
            title={service.title}
            price={service.price}
            seller={service.seller}
            rating={service.rating}
          />
        ))}
      </div>

      {/* Все услуги */}
      <Link
        href="/search"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          marginTop: "20px",
          height: "48px",
          borderRadius: "12px",
          background: "#3547B8",
          color: "#FFFFFF",
          fontWeight: 600,
          textDecoration: "none",
          boxSizing: "border-box",
        }}
      >
        Смотреть все услуги
      </Link>
    </div>
  );
}
