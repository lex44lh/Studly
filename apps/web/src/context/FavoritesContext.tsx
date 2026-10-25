"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { useOptionalDemoWorkspace } from "@/features/demo-workspace/Provider";
import { NEXT_SERVICE_ID } from "@/features/demo-workspace/model";
import services from "@/data/services";
import { demoMode } from "@/lib/api/catalog";
const storageKey = demoMode ? "favorites" : "studly-api-favorites";

type FavoritesContextType = {
  favorites: number[];
  isHydrated: boolean;
  toggleFavorite: (id: number) => void;
  isFavorite: (id: number) => boolean;
};

const serviceIds = new Set(services.map((service) => service.id));

function parseFavorites(value: string | null): number[] {
  if (value === null) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return [...new Set(
      parsed.filter(
        (id): id is number =>
          typeof id === "number" &&
          Number.isSafeInteger(id) &&
          id > 0 &&
          (!demoMode || serviceIds.has(id) || id >= NEXT_SERVICE_ID)
      )
    )];
  } catch {
    return [];
  }
}

function readFavorites(): number[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    return parseFavorites(window.localStorage.getItem(storageKey));
  } catch {
    return [];
  }
}

const subscribeToHydration = () => () => {};
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

const FavoritesContext =
  createContext<FavoritesContextType | null>(
    null
  );

export function FavoritesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const workspace = useOptionalDemoWorkspace();
  const [favorites, setFavorites] = useState<number[]>(readFavorites);

  useEffect(() => {
    try {
      const serialized = JSON.stringify(favorites);

      if (window.localStorage.getItem(storageKey) !== serialized) {
        window.localStorage.setItem(storageKey, serialized);
      }
    } catch {
      // Favorites remain available in memory when storage is unavailable.
    }
  }, [favorites]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey && event.key !== null) {
        return;
      }

      const nextFavorites = parseFavorites(event.newValue);
      setFavorites((current) =>
        current.length === nextFavorites.length &&
        current.every((id, index) => id === nextFavorites[index])
          ? current
          : nextFavorites
      );
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const toggleFavorite = (id: number) => {
    if (!Number.isSafeInteger(id) || (demoMode && !serviceIds.has(id) && !workspace?.state?.services.some(service => service.id === id && service.status === "approved"))) {
      return;
    }

    setFavorites((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  };

  const isFavorite = (id: number) =>
    favorites.includes(id);

  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot
  );

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
        isHydrated,
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
