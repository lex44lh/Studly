import { ApiError } from "@/lib/api/client";

export type EmailAction = { kind: "verify" | "reset"; token: string } | { kind: "invalid" } | null;

export function parseEmailAction(hash: string): EmailAction {
  if (!hash) return null;
  const params = new URLSearchParams(hash.slice(1));
  const actions = params.getAll("action");
  const tokens = params.getAll("token");
  if (!actions.length && !tokens.length) return null;
  const [kind] = actions;
  const [token] = tokens;
  if (actions.length !== 1 || tokens.length !== 1 || !token || token.length > 200 ||
      (kind !== "verify" && kind !== "reset")) return { kind: "invalid" };
  return { kind, token };
}

export function emailAuthError(error: unknown) {
  if (!(error instanceof ApiError)) return "Действие не удалось. Проверьте подключение и попробуйте снова.";
  const code = (error.payload as { code?: string } | null)?.code;
  if (code === "invalid_email_token") return "Ссылка недействительна или устарела. Запросите новое письмо.";
  if (error.status === 401) return "Не удалось войти. Проверьте почту или логин и пароль.";
  if (error.status === 403) return "Сессию не удалось подтвердить. Повторите действие.";
  if (error.status === 429) return "Слишком много попыток. Попробуйте позже.";
  if (error.status === 503) return "Вход по почте временно недоступен.";
  if (code === "invalid_password") return "Выберите пароль из 12–128 символов. Избегайте распространённых паролей, одних цифр и совпадений с почтой или логином.";
  const fields = error.payload as { username?: unknown; email?: unknown } | null;
  if (error.status === 400 && fields?.username) return "Проверьте логин. Он должен быть доступен и содержать от 3 до 32 допустимых символов.";
  if (error.status === 400 && fields?.email) return "Укажите действительный адрес электронной почты.";
  if (code === "invalid_registration") return "Не удалось подтвердить регистрацию. Проверьте данные или запросите новое письмо.";
  if (error.status === 0 || error.status >= 500) return "Результат не подтверждён. Проверьте почту или попробуйте войти перед повторной отправкой.";
  return "Проверьте введённые данные и повторите действие.";
}
