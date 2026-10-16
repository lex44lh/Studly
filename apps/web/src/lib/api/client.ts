export class ApiError extends Error {
  constructor(public readonly status: number, public readonly payload: unknown) {
    super(status === 0 ? "Не удалось связаться с сервером." : `Ошибка API (${status}).`);
  }
}

export async function apiRequest<T>(path: string, options: {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  csrfToken?: string;
} = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1/${path}`, {
      method: options.method ?? "GET", credentials: "same-origin", cache: "no-store",
      signal: options.signal,
      headers: { Accept: "application/json", ...(options.body !== undefined && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
        ...(options.csrfToken ? { "X-CSRFToken": options.csrfToken } : {}) },
      body: options.body instanceof FormData ? options.body : options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (error) {
    if (options.signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
    throw new ApiError(0, null);
  }
  if (response.status === 204) return undefined as T;
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new ApiError(response.ok ? 502 : response.status, null); }
  if (!response.ok) throw new ApiError(response.status, payload);
  return payload as T;
}

// Refresh before every write. Never retry a mutation automatically after a 403/network error.
export async function apiMutation<T>(path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown, signal?: AbortSignal): Promise<T> {
  const token = await apiRequest<{ csrf_token: string }>("auth/csrf/", { signal });
  if (!token || typeof token.csrf_token !== "string" || !token.csrf_token) throw new ApiError(502, null);
  return apiRequest<T>(path, { method, body, signal, csrfToken: token.csrf_token });
}

export function apiErrorMessage(error: unknown): string {
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
export function pagePath(next: string, resource: string): string {
  const url = new URL(next, "http://studly.invalid");
  if (url.pathname !== `/api/v1/${resource}`) throw new ApiError(502, null);
  return resource + url.search;
}
