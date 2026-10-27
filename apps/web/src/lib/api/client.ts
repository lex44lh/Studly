import { assertWriteIdentity, identitySignal, IdentityChangedError, verifyWriteIdentity } from "./session";

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly payload: unknown) {
    super(status === 0 ? "Не удалось связаться с сервером." : `Ошибка API (${status}).`);
  }
}

export async function apiRequest<T>(path: string, options: {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  version?: 1 | 2;
  body?: unknown;
  signal?: AbortSignal;
  csrfToken?: string;
} = {}): Promise<T> {
  // Paths are resource-relative. Never let DTO pagination or asset URLs select an origin.
  if (!path || path.startsWith("/") || /[\\\x00-\x1f#]/.test(path) || /[%:]/.test(path.split("?", 1)[0]) ||
      path.split("?", 1)[0].split("/").some(part => part === "." || part === "..")) {
    throw new ApiError(502, null);
  }
  let response: Response;
  const mutation = options.method && options.method !== "GET";
  if (mutation && path !== "auth/telegram/mini-app/") assertWriteIdentity(options.signal);
  const signal = identitySignal(options.signal);
  try {
    response = await fetch(`/api/v${options.version ?? 1}/${path}`, {
      method: options.method ?? "GET", credentials: "same-origin", cache: "no-store",
      redirect: "error",
      signal,
      headers: { Accept: "application/json", ...(options.body !== undefined && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
        ...(options.csrfToken ? { "X-CSRFToken": options.csrfToken } : {}) },
      body: options.body instanceof FormData ? options.body : options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (error) {
    if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
    throw new ApiError(0, null);
  }
  signal?.throwIfAborted();
  if (mutation && path !== "auth/telegram/mini-app/") assertWriteIdentity(options.signal);
  if (response.status === 204) return undefined as T;
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new ApiError(response.ok ? 502 : response.status, null); }
  signal?.throwIfAborted();
  if (!response.ok) throw new ApiError(response.status, payload);
  return payload as T;
}

// Refresh before every write. Never retry a mutation automatically after a 403/network error.
export async function apiMutation<T>(path: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown, signal?: AbortSignal, version: 1 | 2 = 1): Promise<T> {
  await verifyWriteIdentity(signal);
  const token = await apiRequest<{ csrf_token: string }>("auth/csrf/", { signal });
  if (!token || typeof token.csrf_token !== "string" || !token.csrf_token) throw new ApiError(502, null);
  // Session cookies may change while obtaining CSRF. This remains a client fence, not an atomic server guard.
  await verifyWriteIdentity(signal);
  return apiRequest<T>(path, { method, body, signal, csrfToken: token.csrf_token, version });
}

export function apiErrorMessage(error: unknown): string {
  if (error instanceof IdentityChangedError) return error.message;
  if (!(error instanceof ApiError)) return "Не удалось выполнить запрос. Повторите попытку.";
  if (error.status === 0) return "Не удалось связаться с сервером. Проверьте соединение.";
  if (error.status === 401) return "Сессия истекла. Выполните вход заново.";
  if (error.status === 403) return "Сессия, CSRF или права доступа не подтверждены. Проверьте вход и повторите действие.";
  if (error.status === 404) return "Запись не найдена или больше недоступна.";
  if (error.status === 409) return "Данные изменились. Обновите их перед повторным действием.";
  if (error.status === 400) return "Проверьте введённые данные.";
  return "Сервер временно недоступен. Повторите попытку позже.";
}

// DRF may return an internal host in next. Keep cookies on our origin and constrain the path.
export function pagePath(next: string, resource: string, version: 1 | 2 = 1): string {
  let url: URL;
  try { url = new URL(next, "http://studly.invalid"); } catch { throw new ApiError(502, null); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.hash ||
      url.pathname !== `/api/v${version}/${resource}`) throw new ApiError(502, null);
  return resource + url.search;
}

/** One key per explicit user intention; callers retain it across an unknown outcome. */
export function requestKey(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const value = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}
