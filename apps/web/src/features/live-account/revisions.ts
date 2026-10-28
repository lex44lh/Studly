import { accountClient } from "@/lib/api/account";

export type OwnRevisionChain = { resolve: (base: number) => number; confirm: (from: number, to: number) => void };

/** Only positively confirmed own touches form edges. Reads never fill gaps left by other writers. */
export function createOwnRevisionChain(): OwnRevisionChain {
  const edges = new Map<number, number>();
  return {
    resolve(base) { let current = base; while (edges.has(current)) current = edges.get(current)!; return current; },
    confirm(from, to) {
      if (!Number.isSafeInteger(from) || from < 1 || !Number.isSafeInteger(to) || to < from || to > from + 1 ||
          (edges.has(from) && edges.get(from) !== to)) throw new Error("Неподтверждённый переход редакции профиля.");
      if (to > from) edges.set(from, to);
    },
  };
}

export class OwnRevisionUnconfirmedError extends Error {
  constructor() { super("Сервер принял изменения, но их текущая редакция не подтверждена. Несохранённый ввод сохранён. Проверьте актуальные данные перед новыми действиями."); }
}

/** An ACK is not a current snapshot (especially on receipt replay). Never adopt an arbitrary GET revision. */
export async function confirmOwnRevision(chain: OwnRevisionChain, actor: number, from: number, expected: number, signal: AbortSignal) {
  try {
    const observed = await accountClient.moderation(signal);
    if (signal.aborted || observed.user_id !== actor || observed.revision !== expected) throw new OwnRevisionUnconfirmedError();
    chain.confirm(from, expected);
  } catch { throw new OwnRevisionUnconfirmedError(); }
}
