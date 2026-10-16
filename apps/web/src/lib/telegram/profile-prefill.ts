import type { ProfilePrefill } from "../../types/registration";

// Display hints only. This module does not expose identity, tokens or auth state.
export function getTelegramProfilePrefill(): ProfilePrefill {
  if (typeof window === "undefined") return {};
  const telegram = (window as Window & { Telegram?: { WebApp?: {
    initDataUnsafe?: { user?: { first_name?: unknown; last_name?: unknown; photo_url?: unknown } };
  } } }).Telegram;
  const user = telegram?.WebApp?.initDataUnsafe?.user;
  if (!user) return {};
  const displayName = [user.first_name, user.last_name]
    .filter((value): value is string => typeof value === "string")
    .join(" ").trim();
  let avatarUrl: string | undefined;
  if (typeof user.photo_url === "string") {
    try {
      const url = new URL(user.photo_url);
      if (url.protocol === "https:" && !url.username && !url.password) avatarUrl = url.href;
    } catch { /* Invalid optional photo must not prevent manual entry. */ }
  }
  return { displayName, avatarUrl };
}
