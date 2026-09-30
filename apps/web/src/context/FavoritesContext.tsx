"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

type FavoritesContextType = {
  favorites: number[];
  toggleFavorite: (id: number) => void;
  isFavorite: (id: number) => boolean;
};

const FavoritesContext =
  createContext<FavoritesContextType | null>(
    null
  );

export function FavoritesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [favorites, setFavorites] =
  useState<number[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    const saved =
      localStorage.getItem("favorites");

    return saved
      ? JSON.parse(saved)
      : [];
  });

useEffect(() => {
  localStorage.setItem(
    "favorites",
    JSON.stringify(favorites)
  );
}, [favorites]);

  const toggleFavorite = (id: number) => {
    setFavorites((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id]
    );
  };

  const isFavorite = (id: number) =>
    favorites.includes(id);

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
        toggleFavorite,
        isFavorite,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context =
    useContext(FavoritesContext);

  if (!context) {
    throw new Error(
      "FavoritesProvider not found"
    );
  }

  return context;
}
