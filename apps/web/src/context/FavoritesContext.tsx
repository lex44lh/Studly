"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useOptionalDemoWorkspace } from "@/features/demo-workspace/Provider";
import { NEXT_SERVICE_ID } from "@/features/demo-workspace/model";
import services from "@/data/services";
import { demoMode } from "@/lib/api/catalog";
import type { Service } from "@/lib/api/catalog";
import { favoritesClient } from "@/lib/api/services";
import { useAuth } from "@/context/AuthContext";
const storageKey = "favorites";

type FavoritesContextType = {
  favorites: number[];
  isHydrated: boolean;
  toggleFavorite: (id: number) => void;
  isFavorite: (id: number) => boolean;
  serverServices?: Service[];
  error?: unknown;
  pendingIds?: number[];
  refresh?: () => void;
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

function DemoFavoritesProvider({
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

function ServerFavoritesProvider({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  const authenticated = state.status === "authenticated";
  const [snapshot, setSnapshot] = useState<{ services?: Service[]; error?: unknown; attempt?: number }>({});
  const [attempt, setAttempt] = useState(0);
  const [pendingIds, setPendingIds] = useState<number[]>([]);
  const inFlight = useRef(new Set<number>());
  const lifetime = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    if (authenticated) {
      favoritesClient.all(controller.signal).then(serverServices => {
        if (!controller.signal.aborted) setSnapshot({ services: serverServices, attempt });
      }).catch(error => {
        if (!controller.signal.aborted) setSnapshot({ error, attempt });
      });
    }
    return () => { controller.abort(); lifetime.current = null; };
  }, [authenticated, attempt]);
  const favorites = snapshot.services?.map(service => service.id) ?? [];
  const toggleFavorite = (id: number) => {
    const controller = lifetime.current;
    if (!authenticated || !snapshot.services || snapshot.attempt !== attempt || !controller || controller.signal.aborted || inFlight.current.size || !Number.isSafeInteger(id) || id < 1) return;
    inFlight.current.add(id);
    setPendingIds([...inFlight.current]);
    const remove = favorites.includes(id);
    void (remove ? favoritesClient.remove(id, controller.signal) : favoritesClient.add(id, controller.signal))
      .then(() => favoritesClient.all(controller.signal))
      .then(serverServices => { if (!controller.signal.aborted) setSnapshot({ services: serverServices, attempt }); })
      .catch(error => { if (!controller.signal.aborted) setSnapshot(previous => ({ ...previous, error })); })
      .finally(() => {
        inFlight.current.delete(id);
        if (!controller.signal.aborted) setPendingIds([...inFlight.current]);
      });
  };
  return <FavoritesContext.Provider value={{ favorites, isHydrated: authenticated && Boolean(snapshot.services) && snapshot.attempt === attempt && !pendingIds.length, toggleFavorite,
    isFavorite: id => favorites.includes(id), serverServices: snapshot.services, error: snapshot.error, pendingIds,
    refresh: () => { if (!inFlight.current.size) setAttempt(value => value + 1); } }}>{children}</FavoritesContext.Provider>;
}

function LiveFavoritesProvider({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  // Remount immediately on logout/session refresh/account switch, so private
  // membership and pending writes cannot cross an authentication boundary.
  return <ServerFavoritesProvider key={`${state.status}:${state.user?.id ?? "guest"}`}>{children}</ServerFavoritesProvider>;
}

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  return demoMode ? <DemoFavoritesProvider>{children}</DemoFavoritesProvider> : <LiveFavoritesProvider>{children}</LiveFavoritesProvider>;
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
