"use client";
import { useFavorites } from "@/context/FavoritesContext";
import { useAuth } from "@/context/AuthContext";
import { apiErrorMessage } from "@/lib/api/client";
import { demoMode } from "@/lib/data-mode";

export default function LiveFavoriteFeedback() {
  const { error, refresh } = useFavorites();
  const { state } = useAuth();
  if (demoMode) return null;
  if (state.status === "anonymous") return <p className="catalog-notice">Войдите через Telegram, чтобы сохранять услуги в избранное.</p>;
  return error ? <div className="catalog-notice" role="alert"><p>Избранное: {apiErrorMessage(error)}</p>
    <button type="button" className="reset-btn" onClick={refresh}>Обновить избранное</button></div> : null;
}
