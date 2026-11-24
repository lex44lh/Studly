import { ApiError, apiMutation, apiRequest } from "./client";

export type SessionUser = { id: number; display_name: string; telegram_username: string };
export type AuthOptions = {
  telegram_mini_app: boolean;
  telegram_website: boolean;
  email_login?: boolean;
  email_registration?: boolean;
  email_linking?: boolean;
};
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
  emailRegister: (email: string, signal: AbortSignal) => emailPost<{ detail: string }>("register", { email }, signal),
  emailVerify: async (body: { token: string; username: string; password: string }, signal: AbortSignal) =>
    readUser(await emailPost<UserResponse>("verify", body, signal)),
  emailLogin: async (body: { identifier: string; password: string }, signal: AbortSignal) =>
    readUser(await emailPost<UserResponse>("login", body, signal)),
  emailResetRequest: (email: string, signal: AbortSignal) => emailPost<{ detail: string }>("reset/request", { email }, signal),
  emailResetConfirm: (body: { token: string; password: string }, signal: AbortSignal) => emailPost<void>("reset/confirm", body, signal),
  async confirmEmailSession(expectedUserId: number, signal: AbortSignal) {
    await csrf(signal);
    const { user } = await authClient.me(signal);
    if (user.id !== expectedUserId) throw new ApiError(409, null);
  },
  async logout(signal?: AbortSignal) {
    return apiMutation<void>("auth/logout/", "POST", undefined, signal);
  },
};

async function emailPost<T>(path: "register" | "verify" | "login" | "reset/request" | "reset/confirm", body: object, signal: AbortSignal) {
  const csrfToken = await csrf(signal);
  return apiRequest<T>(`auth/email/${path}/`, { method: "POST", body, csrfToken, signal });
}

export function getTelegramInitData(): string {
  if (typeof window === "undefined") return "";
  const sdk = (window as Window & { Telegram?: { WebApp?: { initData?: unknown } } }).Telegram?.WebApp;
  return typeof sdk?.initData === "string" ? sdk.initData : "";
}
