"use client";

import { useFavorites } from "@/context/FavoritesContext";

type Props = {
  serviceId: number;
};

export default function ServiceFavoriteButton({
  serviceId,
}: Props) {
  const {
    toggleFavorite,
    isFavorite,
    isHydrated,
  } = useFavorites();

  if (!isHydrated) {
    return (
      <button
        type="button"
        disabled
        style={{
          border: "none",
          background: "transparent",
          fontSize: "28px",
          cursor: "default",
          color: "#DC2626",
        }}
      >
        🤍
      </button>
    );
  }

  const favorite = isFavorite(serviceId);

  return (
    <button
      type="button"
      onClick={() =>
        toggleFavorite(serviceId)
      }
      style={{
        border: "none",
        background: "transparent",
        fontSize: "28px",
        cursor: "pointer",
        color: "#DC2626",
      }}
    >
      {favorite ? "❤️" : "🤍"}
    </button>
  );
}
