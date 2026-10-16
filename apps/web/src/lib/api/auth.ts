import { ApiError, apiRequest } from "./client";

export type SessionUser = { id: number; display_name: string; telegram_username: string };
export type AuthOptions = { telegram_mini_app: boolean; telegram_website: boolean };
type UserResponse = { user: SessionUser };

function readUser(value: UserResponse): UserResponse {
  if (!value?.user || !Number.isSafeInteger(value.user.id) || value.user.id <= 0 ||
      typeof value.user.display_name !== "string" || typeof value.user.telegram_username !== "string") {
    throw new ApiError(502, null);
  }
  return value;
}

async function csrf(signal?: AbortSignal) {
  const response = await apiRequest<{ csrf_token: string }>("auth/csrf/", { signal });
  if (!response || typeof response.csrf_token !== "string" || !response.csrf_token) throw new ApiError(502, null);
  return response.csrf_token;
}

export const authClient = {
  async options(signal?: AbortSignal) {
    const value = await apiRequest<AuthOptions>("auth/options/", { signal });
    if (!value || typeof value.telegram_mini_app !== "boolean" || typeof value.telegram_website !== "boolean") throw new ApiError(502, null);
    return value;
  },
  me: async (signal?: AbortSignal) => readUser(await apiRequest<UserResponse>("auth/me/", { signal })),
  async login(initData: string, signal?: AbortSignal) {
    const csrf_token = await csrf(signal);
    return readUser(await apiRequest<UserResponse>("auth/telegram/mini-app/", {
      method: "POST", body: { init_data: initData }, csrfToken: csrf_token, signal,
    }));
  },
  async logout(signal?: AbortSignal) {
    // Fetch on every mutation: Django rotates CSRF after login.
    const csrf_token = await csrf(signal);
    return apiRequest<void>("auth/logout/", { method: "POST", csrfToken: csrf_token, signal });
  },
};

export function getTelegramInitData(): string {
  if (typeof window === "undefined") return "";
  const sdk = (window as Window & { Telegram?: { WebApp?: { initData?: unknown } } }).Telegram?.WebApp;
  return typeof sdk?.initData === "string" ? sdk.initData : "";
}
