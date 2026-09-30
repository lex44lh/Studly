"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useFavorites } from "@/context/FavoritesContext";

type Props = {
  id: number;
  title: string;
  price: string;
  seller: string;
  rating: string;
};

export default function ServiceCard({
  id,
  title,
  price,
  seller,
  rating,
}: Props) {
  const {
    toggleFavorite,
    isFavorite,
  } = useFavorites();

  const favorite = isFavorite(id);
const [mounted, setMounted] =
  useState(false);

useEffect(() => {
  setMounted(true);
}, []);
  return (
    <div
      style={{
        marginTop: "16px",
        border: "1px solid #E5E7EB",
        borderRadius: "16px",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleFavorite(id);
        }}
        style={{
          position: "absolute",
          top: "12px",
          right: "12px",
          border: "none",
          background: "transparent",
          fontSize: "24px",
          cursor: "pointer",
          zIndex: 10,
        }}
      >
        {mounted
  ? favorite
    ? "❤️"
    : "🤍"
  : "🤍"}
      </button>

      <Link
        href={`/service/${id}`}
        style={{
          textDecoration: "none",
          color: "inherit",
        }}
      >
        <div
          style={{
            height: "140px",
            background: "#F3F4F6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          Фото услуги
        </div>

        <div
          style={{
            padding: "16px",
          }}
        >
          <h3>{title}</h3>

          <p
            style={{
              color: "#3547B8",
              fontWeight: 700,
            }}
          >
            {price}
          </p>

          <p>{seller}</p>

          <p>⭐ {rating}</p>
        </div>
      </Link>
    </div>
  );
}
