/** Browser identity leases fence old forms; only Backend can atomically bind a write to its actor. */
export type IdentityLease = Readonly<{ actorId: number; epoch: number }>;
export const identityChangedMessage = "Аккаунт изменился или сессия больше не подтверждена. Несохранённые данные прежнего аккаунта удалены. Повторите проверку входа.";
export class IdentityChangedError extends Error {
  constructor() { super(identityChangedMessage); this.name = "IdentityChangedError"; }
}
type Guard = { readActor: (signal: AbortSignal) => Promise<number | null>; onInvalidated: () => void };
let guard: Guard | null = null;
let actor: number | null = null;
let epoch = 0;
let lifetime = new AbortController();
const bindings = new WeakMap<AbortSignal, IdentityLease | null>();

export function configureIdentityGuard(value: Guard): () => void {
  guard = value;
  return () => { if (guard === value) { guard = null; confirmIdentity(null); } };
}
export function confirmIdentity(value: number | null): number {
  if (value !== actor || lifetime.signal.aborted) {
    lifetime.abort(); lifetime = new AbortController(); epoch += 1; actor = value;
  }
  return epoch;
}
export function invalidateIdentity(): void {
  lifetime.abort(); actor = null; epoch += 1;
  guard?.onInvalidated();
}
export function captureIdentity(expectedActor: number | null): IdentityLease | null {
  return expectedActor !== null && (!guard || (actor === expectedActor && !lifetime.signal.aborted))
    ? Object.freeze({ actorId: expectedActor, epoch }) : null;
}
function valid(lease: IdentityLease | null | undefined): boolean {
  return !!lease && actor === lease.actorId && epoch === lease.epoch && !lifetime.signal.aborted;
}
export function createIdentityController(lease: IdentityLease | null): AbortController {
  const controller = new AbortController(); bindings.set(controller.signal, lease);
  if (guard && !valid(lease)) controller.abort(new IdentityChangedError());
  return controller;
}
export function identitySignal(signal?: AbortSignal): AbortSignal | undefined {
  if (!guard || !signal || !bindings.has(signal)) return signal;
  return valid(bindings.get(signal)) ? AbortSignal.any([signal, lifetime.signal]) : AbortSignal.abort(new IdentityChangedError());
}
export function assertWriteIdentity(signal?: AbortSignal): void {
  if (guard && (!signal || signal.aborted || !valid(bindings.get(signal)))) throw new IdentityChangedError();
}
export async function verifyWriteIdentity(signal?: AbortSignal): Promise<void> {
  if (!guard) return; // Transport-only consumers have no mounted private UI/session coordinator.
  assertWriteIdentity(signal);
  const lease = bindings.get(signal!)!;
  const currentGuard = guard;
  try {
    const found = await currentGuard.readActor(identitySignal(signal)!);
    assertWriteIdentity(signal);
    if (found !== lease.actorId) throw new IdentityChangedError();
  } catch (error) {
    if (!signal?.aborted && guard === currentGuard) invalidateIdentity();
    throw error instanceof IdentityChangedError ? error : new IdentityChangedError();
  }
}
