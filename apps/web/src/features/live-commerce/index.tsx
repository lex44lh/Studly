"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { ApiError, apiErrorMessage, requestKey } from "@/lib/api/client";
import { money } from "@/lib/api/catalog";
import { commerceClient, mergeMessages, type Conversation, type Message, type MoneySnapshot, type OrderAction, type OrderV2, type QuoteExtra, type QuoteV2 } from "@/lib/api/commerce";
import { LiveAccess, LiveState, useLiveResource } from "@/features/live/shared";
import { allowedOrderActions, outcomeUnknown, purchaseStorageKey, readPurchaseIntent, savePurchaseIntent, type OrderRole } from "./protocol";
import { useWrite } from "./useWrite";
import styles from "./commerce.module.css";

const statuses = { pending_acceptance: "Ожидает согласия исполнителя", awaiting_payment: "Ожидает оплаты", cancelled: "Отменён заказчиком", declined: "Исполнитель отказался" };
const actions: Record<OrderAction, string> = { accept: "Принять заказ", cancel: "Отменить заказ", decline: "Отказаться от заказа" };
const eventLabels: Record<string, string> = { created: "Заказ создан", accepted: "Заказ принят", cancelled: "Заказ отменён", declined: "Исполнитель отказался", accept: "Заказ принят", cancel: "Заказ отменён", decline: "Исполнитель отказался" };
const storageWarning = "Браузер не сохранил ключ повторного запроса. До уточнения результата не перезагружайте страницу; проверьте список заказов. На этой странице повтор сохранит прежний ключ.";
const date = (value: string) => new Date(value).toLocaleString("ru-RU");
function useViewer() { const { state } = useAuth(); return state.status === "authenticated" ? state.user!.id : null; }
function Frame({ title, children }: { title: string; children: ReactNode }) {
  return <div className={styles.page}><header className={styles.intro}><p className={styles.eyebrow}>Мой кампус · Live</p><h1>{title}</h1></header>{children}</div>;
}
function WriteError({ error, unknown }: { error: unknown; unknown: boolean }) {
  if (!error) return null;
  return <div className={styles.error} role="alert">{apiErrorMessage(error)}{unknown && <p>Результат запроса неизвестен. Проверьте серверное состояние или повторите это же действие с сохранённым ключом. Новый запрос автоматически не отправляется.</p>}</div>;
}
function Snapshot({ value }: { value: MoneySnapshot }) {
  return <><dl className={styles.money}>
    <div><dt>Основная услуга</dt><dd>{money(value.base_price_amount, value.currency)}</dd></div>
    {value.selected_extras.map(extra => <div key={extra.id}><dt>{extra.title} · +{extra.extra_days} дн.</dt><dd>{money(extra.price_amount, value.currency)}</dd></div>)}
    <div><dt>Услуга с дополнениями</dt><dd>{money(value.price_amount, value.currency)}</dd></div>
    <div><dt>Комиссия STUDLY · {value.buyer_fee_percent}%</dt><dd>{money(value.buyer_fee_amount, value.currency)}</dd></div>
    <div className={styles.total}><dt>Итого</dt><dd>{money(value.total_amount, value.currency)}</dd></div>
  </dl><p className={styles.muted}>Срок: {value.duration_days} дн. · Тариф: {value.tariff_code}. Суммы и срок рассчитаны сервером.</p></>;
}

export function LiveQuote(props: { serviceId: string; extras: QuoteExtra[]; onLockChange?: (locked: boolean) => void }) {
  return <LiveAccess><QuoteContent {...props} /></LiveAccess>;
}
function QuoteContent({ serviceId, extras, onLockChange }: { serviceId: string; extras: QuoteExtra[]; onLockChange?: (locked: boolean) => void }) {
  const viewer = useViewer()!;
  const selectedIds = extras.map(extra => extra.id).sort();
  const signature = `${serviceId}:${selectedIds.join(",")}`;
  const storageKey = purchaseStorageKey(viewer, serviceId, selectedIds);
  const quoteWrite = useWrite(`quote:${viewer}:${signature}`);
  const orderWrite = useWrite(`purchase:${viewer}:${serviceId}`);
  const [quote, setQuote] = useState<{ signature: string; value: QuoteV2; requestKey?: string } | null>(null);
  const [consent, setConsent] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderV2 | null>(null);
  const [notice, setNotice] = useState("");
  const [restoring, setRestoring] = useState(true);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [restoredAttempted, setRestoredAttempted] = useState(false);
  const quoteCurrent = quote?.signature === signature ? quote : null;
  const unresolved = orderWrite.busy || orderWrite.unknown || restoredAttempted;
  // Opaque purchase IDs survive reload. GET restores the actual server snapshot;
  // consent is always fresh and no POST is replayed during restoration.
  useEffect(() => {
    const controller = new AbortController();
    const saved = readPurchaseIntent(storageKey);
    if (saved) {
      Promise.resolve().then(() => {
        if (controller.signal.aborted) return undefined;
        setRestoredAttempted(saved.attempted);
        return commerceClient.quoteDetail(saved.quoteId, controller.signal);
      }).then(value => {
        if (!value) return;
        if (!controller.signal.aborted && value.service_id === Number(serviceId) && value.selected_extras.map(x => x.id).sort().join(",") === selectedIds.join(",")) {
          setQuote({ signature, value, requestKey: saved.requestKey });
          setRestoredAttempted(saved.attempted);
          setNotice("Восстановлен предыдущий расчёт. Проверьте свои заказы перед повтором; повтор использует прежний ключ. Просмотрите условия и подтвердите согласие заново.");
        }
      }).catch(error => { if (!controller.signal.aborted) setNotice(apiErrorMessage(error)); }).finally(() => { if (!controller.signal.aborted) setRestoring(false); });
    } else {
      // Deferred state update keeps initial render free of side effects.
      queueMicrotask(() => { if (!controller.signal.aborted) setRestoring(false); });
    }
    return () => controller.abort();
    // The exact selected-ID signature owns this restoration, independent of array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, signature, serviceId, restoreAttempt]);
  useEffect(() => { onLockChange?.(unresolved); return () => onLockChange?.(false); }, [onLockChange, unresolved]);

  async function calculate() {
    if (unresolved || quoteWrite.busy) return;
    setConsent(null); setNotice("");
    const result = await quoteWrite.run(signature, (_key, signal) => commerceClient.quote(serviceId, selectedIds, signal));
    if (result?.ok) {
      const key = requestKey();
      setQuote({ signature, value: result.value, requestKey: key });
      if (!savePurchaseIntent(storageKey, { quoteId: result.value.quote_id, requestKey: key, attempted: false })) setNotice(storageWarning);
    }
  }
  async function purchase() {
    if (!quoteCurrent || consent !== quoteCurrent.value.quote_id || orderWrite.busy || order) return;
    const value = quoteCurrent.value;
    const result = await orderWrite.run(value.quote_id, (key, signal) => {
      if (!savePurchaseIntent(storageKey, { quoteId: value.quote_id, requestKey: key, attempted: true })) setNotice(storageWarning);
      return commerceClient.purchase(value.quote_id, key, signal);
    }, quoteCurrent.requestKey);
    if (result?.ok) { setOrder(result.value); setConsent(null); setRestoredAttempted(false); savePurchaseIntent(storageKey, null); }
    else if (result && result.error instanceof ApiError && result.error.status === 409) {
      setQuote(null); setConsent(null); setRestoredAttempted(false); savePurchaseIntent(storageKey, null);
      setNotice("Условия изменились или по этому расчёту уже создан заказ. Проверьте список заказов. Для нового заказа запросите новый расчёт, просмотрите его и подтвердите новое согласие.");
    }
    else if (result && !outcomeUnknown(result.error)) {
      setRestoredAttempted(false);
      if (quoteCurrent.requestKey) savePurchaseIntent(storageKey, { quoteId: value.quote_id, requestKey: quoteCurrent.requestKey, attempted: false });
    }
  }
  if (order) return <div role="status"><p>Заказ №{order.id} сохранён сервером. {statuses[order.status]}.</p><Link className={styles.primary} href={`/orders/${order.id}`}>Открыть заказ</Link></div>;
  return <div className={styles.checkout}>
    <p className={styles.muted}>Выбранные дополнения: {extras.length ? extras.map(x => x.title).join(", ") : "нет"}. Сначала получите сохранённый расчёт сервера.</p>
    <button className={styles.secondary} type="button" disabled={restoring || quoteWrite.busy || unresolved} onClick={() => { void calculate(); }}>{quoteWrite.busy ? "Получаем расчёт…" : quoteCurrent ? "Обновить расчёт" : "Получить расчёт"}</button>
    {!quoteCurrent && restoredAttempted && <button className={styles.secondary} type="button" disabled={orderWrite.busy} onClick={() => setRestoreAttempt(value => value + 1)}>Повторить чтение сохранённого расчёта</button>}
    {notice && <p className={styles.note} role="status">{notice}</p>}
    <WriteError error={quoteWrite.error} unknown={quoteWrite.unknown} />
    {quoteCurrent && <div className={styles.stack}><h3>{quoteCurrent.value.title}</h3><p>{quoteCurrent.value.description}</p>
      <ul>{quoteCurrent.value.included.map((item, index) => <li key={index}>{item}</li>)}</ul><Snapshot value={quoteCurrent.value} />
      <label className={styles.check}><input type="checkbox" checked={consent === quoteCurrent.value.quote_id} disabled={orderWrite.busy} onChange={event => setConsent(event.target.checked ? quoteCurrent.value.quote_id : null)} /><span>Я просмотрел состав, срок и итоговую сумму этого расчёта и согласен создать неоплаченный заказ.</span></label>
      <button type="button" className={styles.primary} disabled={consent !== quoteCurrent.value.quote_id || orderWrite.busy} onClick={() => { void purchase(); }}>{orderWrite.busy ? "Создаём заказ…" : orderWrite.unknown ? "Повторить создание с прежним ключом" : "Создать заказ"}</button>
    </div>}
    <WriteError error={orderWrite.error} unknown={orderWrite.unknown} />
    {(orderWrite.unknown || quote?.requestKey) && <Link className={styles.secondary} href="/orders">Проверить мои заказы</Link>}
    <p className={styles.note}>Оплата сейчас недоступна. Создание заказа не списывает деньги и не подтверждает оплату.</p>
  </div>;
}

export function LiveDiscussion({ serviceId }: { serviceId: string }) {
  return <LiveAccess><DiscussionContent key={serviceId} serviceId={serviceId} /></LiveAccess>;
}
function DiscussionContent({ serviceId }: { serviceId: string }) {
  const write = useWrite(`discussion:${serviceId}`);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  return <div>{conversation ? <Link className={styles.primary} href={`/chats/${conversation.id}`}>Открыть обсуждение услуги</Link> : <button className={styles.secondary} type="button" disabled={write.busy} onClick={() => { void write.run(serviceId, (key, signal) => commerceClient.discussion(serviceId, key, signal)).then(result => { if (result?.ok) setConversation(result.value); }); }}>{write.busy ? "Открываем…" : "Обсудить до заказа"}</button>}<WriteError error={write.error} unknown={write.unknown} /><p className={styles.muted}>Обсуждение услуги и чат каждого созданного заказа — отдельные переписки.</p></div>;
}

export function LiveOrders({ initialRole = "all" }: { initialRole?: OrderRole }) { return <LiveAccess><OrdersContent initialRole={initialRole} /></LiveAccess>; }
function OrdersContent({ initialRole }: { initialRole: OrderRole }) {
  const viewer = useViewer()!;
  const [role, setRole] = useState<OrderRole>(initialRole);
  const [cursor, setCursor] = useState<{ role: string; url: string } | null>(null);
  const next = cursor?.role === role ? cursor.url : undefined;
  const load = useCallback((signal: AbortSignal) => commerceClient.orders(role, next, signal), [role, next]);
  const { data, error, loading, reload } = useLiveResource(`orders:${viewer}:${role}:${next ?? ""}`, load);
  const rows = data?.results.filter(order => order.buyer.id === viewer || order.performer.id === viewer);
  return <Frame title="Мои заказы"><div className={styles.actions}><label className={styles.field}>Показать заказы<select className={styles.select} value={role} onChange={event => setRole(event.target.value as typeof role)}><option value="all">Все мои заказы</option><option value="customer">Как заказчик</option><option value="performer">Как исполнитель</option></select></label><button className={styles.secondary} type="button" onClick={reload}>Обновить</button></div>
    <p className={styles.note}>Показаны настоящие неоплаченные заказы Django. Переключение списка не меняет аккаунт и права.</p>
    {!data ? <LiveState error={error} loading={loading} retry={reload} /> : <><ul className={styles.list}>{rows?.map(order => <li key={order.id}><Link className={styles.card} href={`/orders/${order.id}`}><div className={styles.row}><h2>{order.title}</h2><span className={styles.badge}>{statuses[order.status]}</span></div><p>№{order.id} · {order.buyer.id === viewer ? `Исполнитель: ${order.performer.name}` : `Заказчик: ${order.buyer.name}`}</p><strong>{money(order.total_amount, order.currency)}</strong></Link></li>)}</ul>{!rows?.length && <p className={styles.empty}>Заказов пока нет.</p>}<Pagination next={data.next} previous={data.previous} select={url => setCursor({ role, url })} /></>}
  </Frame>;
}
function Pagination({ next, previous, select }: { next: string | null; previous: string | null; select: (url: string) => void }) {
  return <nav className={styles.actions} aria-label="Страницы результатов">{previous && <button className={styles.secondary} type="button" onClick={() => select(previous)}>Предыдущая страница</button>}{next && <button className={styles.secondary} type="button" onClick={() => select(next)}>Следующая страница</button>}</nav>;
}
export function LiveOrderDetail({ id }: { id: string }) { return <LiveAccess><OrderContent key={id} id={id} /></LiveAccess>; }
function OrderContent({ id }: { id: string }) {
  const viewer = useViewer()!;
  const load = useCallback((signal: AbortSignal) => commerceClient.order(id, signal), [id]);
  const { data, error, loading, reload } = useLiveResource(`order:${id}`, load);
  const [updated, setUpdated] = useState<OrderV2 | null>(null);
  const [confirmation, setConfirmation] = useState<{ action: OrderAction; revision: number } | null>(null);
  const write = useWrite(`order:${id}`);
  const value = updated && data && updated.revision >= data.revision ? updated : data;
  function refresh() { if (!write.busy) { setUpdated(null); if (!write.unknown) setConfirmation(null); reload(); } }
  if (!value) return <Frame title="Заказ"><LiveState error={error} loading={loading} retry={refresh} /></Frame>;
  if (value.buyer.id !== viewer && value.performer.id !== viewer) return <Frame title="Заказ"><p role="alert">Нет доступа к заказу.</p></Frame>;
  const order = value;
  const allowed = allowedOrderActions(order, viewer) as OrderAction[];
  async function change(action: OrderAction) {
    if (!confirmation || confirmation.action !== action || (!write.unknown && (confirmation.revision !== order.revision || !allowed.includes(action)))) return;
    const revision = confirmation.revision;
    const result = await write.run(`${action}:${revision}`, (key, signal) => commerceClient.orderAction(order.id, action, revision, key, signal));
    if (result?.ok) { setUpdated(result.value); setConfirmation(null); }
    else if (result && result.error instanceof ApiError && result.error.status === 409) setConfirmation(null);
  }
  return <Frame title={`Заказ №${order.id}`}><div className={styles.grid}><div className={styles.stack}><section className={styles.panel}><span className={styles.badge}>{statuses[order.status]}</span><h2>{order.title}</h2><p>{order.description}</p><ul>{order.included.map((item, index) => <li key={index}>{item}</li>)}</ul><p className={styles.muted}>Заказчик: {order.buyer.name} · Исполнитель: {order.performer.name}</p><p className={styles.muted}>Сохранённые условия · версия {order.revision} · {date(order.created_at)}</p><OrderChat id={order.id} /></section><OrderEvents id={order.id} revision={order.revision} /></div>
    <aside className={styles.panel}><h2>Стоимость заказа</h2><Snapshot value={order} /><p className={styles.note}>Статус оплаты: не оплачен. Платежи, результаты, завершение, отзывы, возвраты и выплаты ещё не подключены в Backend.</p><button className={styles.secondary} type="button" disabled>Оплата недоступна</button>
      <div className={styles.actions}>{allowed.map(action => <button type="button" className={styles.secondary} disabled={write.busy || write.unknown} key={action} onClick={() => setConfirmation({ action, revision: order.revision })}>{actions[action]}</button>)}</div>
      {confirmation && (write.unknown || (allowed.includes(confirmation.action) && confirmation.revision === order.revision)) && <div className={styles.note}><p>Подтвердите: {actions[confirmation.action].toLowerCase()} (версия {confirmation.revision}).</p><button type="button" className={styles.primary} disabled={write.busy} onClick={() => { void change(confirmation.action); }}>{write.unknown ? "Повторить с прежним ключом" : "Подтвердить действие"}</button></div>}
      <WriteError error={write.error} unknown={write.unknown} /><button className={styles.secondary} type="button" disabled={write.busy} onClick={refresh}>Обновить заказ</button><p className={styles.muted}>После конфликта версий обновите заказ и подтвердите действие заново.</p>
    </aside></div></Frame>;
}
function OrderChat({ id }: { id: number }) {
  const load = useCallback((signal: AbortSignal) => commerceClient.orderConversation(id, signal), [id]);
  const { data, error, loading, reload } = useLiveResource(`order-conversation:${id}`, load);
  return data ? <Link className={styles.primary} href={`/chats/${data.id}`}>Перейти в чат заказа</Link> : <LiveState error={error} loading={loading} retry={reload} />;
}
function OrderEvents({ id, revision }: { id: number; revision: number }) {
  const [cursor, setCursor] = useState<string | undefined>();
  const load = useCallback((signal: AbortSignal) => commerceClient.events(id, cursor, signal), [id, cursor]);
  const { data, error, loading, reload } = useLiveResource(`order-events:${id}:${revision}:${cursor ?? ""}`, load);
  return <section className={styles.panel}><h2>История заказа</h2>{!data ? <LiveState error={error} loading={loading} retry={reload} /> : <><ul className={styles.events}>{data.results.map(event => <li key={event.id}><time dateTime={event.created_at}>{date(event.created_at)}</time>{eventLabels[event.action] ?? event.action} · версия {event.revision}</li>)}</ul>{!data.results.length && <p className={styles.muted}>События для этого заказа не зарегистрированы.</p>}<Pagination next={data.next} previous={data.previous} select={setCursor} /></>}</section>;
}

export function LiveConversations() { return <LiveAccess><ConversationsContent /></LiveAccess>; }
function ConversationsContent() {
  const viewer = useViewer()!;
  const [cursor, setCursor] = useState<string | undefined>();
  const load = useCallback((signal: AbortSignal) => commerceClient.conversations(cursor, signal), [cursor]);
  const { data, error, loading, reload } = useLiveResource(`conversations:${cursor ?? ""}`, load);
  const rows = data?.results.filter(row => row.participant_ids.includes(viewer));
  return <Frame title="Сообщения"><p className={styles.note}>Обсуждения до заказа и чаты заказов сохраняются отдельно. Доступ есть только у участников.</p><button className={styles.secondary} type="button" onClick={reload}>Обновить список</button>{!data ? <LiveState error={error} loading={loading} retry={reload} /> : <><ul className={styles.list}>{rows?.map(row => <li key={row.id}><Link className={styles.card} href={`/chats/${row.id}`}><h2>{row.title}</h2><span className={styles.badge}>{row.kind === "order" ? `Заказ №${row.order_id}` : "Обсуждение услуги"}</span></Link></li>)}</ul>{!rows?.length && <p className={styles.empty}>Переписок пока нет.</p>}<Pagination next={data.next} previous={data.previous} select={setCursor} /></>}</Frame>;
}
export function LiveConversation({ id }: { id: string }) { return <LiveAccess><ConversationContent key={id} id={id} /></LiveAccess>; }
function ConversationContent({ id }: { id: string }) {
  const viewer = useViewer()!;
  const load = useCallback((signal: AbortSignal) => commerceClient.conversation(id, signal), [id]);
  const { data, error, loading, reload } = useLiveResource(`conversation:${id}`, load);
  if (!data) return <Frame title="Переписка"><LiveState error={error} loading={loading} retry={reload} /></Frame>;
  if (!data.participant_ids.includes(viewer)) return <Frame title="Переписка"><p role="alert">Нет доступа к переписке.</p></Frame>;
  return <Frame title={data.title}><p className={styles.note}>{data.kind === "order" ? <>Чат заказа №{data.order_id}. <Link href={`/orders/${data.order_id}`}>Открыть заказ</Link></> : <>Обсуждение услуги до заказа. <Link href={`/service/${data.service_id}`}>Открыть услугу</Link></>}</p><MessageStream conversation={data} viewer={viewer} /></Frame>;
}
function MessageStream({ conversation, viewer }: { conversation: Conversation; viewer: number }) {
  const id = conversation.id;
  const load = useCallback((signal: AbortSignal) => commerceClient.messages(id, undefined, signal), [id]);
  const { data, error, loading, reload } = useLiveResource(`messages:${id}`, load);
  const [added, setAdded] = useState<{ rows: Message[]; next: string | null } | null>(null);
  const [text, setText] = useState("");
  const write = useWrite(`message:${id}`), paging = useWrite(`message-pages:${id}`);
  const generation = useRef(0);
  const rows = mergeMessages(data?.results ?? [], added?.rows ?? [], id, viewer);
  const next = added ? added.next : data?.next;
  async function more() {
    if (!next || paging.busy) return;
    const currentGeneration = generation.current;
    const result = await paging.run(next, (_key, signal) => commerceClient.messages(id, next, signal));
    if (result?.ok && currentGeneration === generation.current) setAdded(previous => ({ rows: mergeMessages(previous?.rows ?? [], result.value.results, id, viewer), next: result.value.next }));
  }
  async function send() {
    if (!text.trim() || text.length > 4000 || write.busy) return;
    const result = await write.run(`${id}:${text}`, (key, signal) => commerceClient.send(id, key, text, signal));
    if (result?.ok) { setAdded(previous => ({ rows: mergeMessages(previous?.rows ?? [], [result.value], id, viewer), next: previous ? previous.next : data?.next ?? null })); setText(""); }
  }
  function refresh() { generation.current++; setAdded(null); reload(); }
  return <div className={styles.stack}><section className={styles.panel} aria-label="Сообщения"><div className={styles.row}><h2>Переписка</h2><button className={styles.secondary} type="button" disabled={paging.busy} onClick={refresh}>Обновить сообщения</button></div><p className={styles.muted}>«Сохранено» означает запись на сервере, а не прочтение адресатом. Обновляйте переписку вручную; уведомления и вложения пока недоступны.</p>
    {!data ? <LiveState error={error} loading={loading} retry={refresh} /> : <><ol className={styles.list}>{rows.map(message => <li className={`${styles.bubble} ${message.sender_id === viewer ? styles.mine : ""}`} key={message.id}><p>{message.text}</p><small>{message.sender_id === viewer ? "Вы" : "Участник"} · {message.status === "held" ? "Удержано" : "Сохранено"} · №{message.sequence}</small><time dateTime={message.created_at}>{date(message.created_at)}</time>{message.status === "held" && message.sender_id === viewer && <><p className={styles.note}>{message.warning} Категории: {message.categories.join(", ")}. Правила: {message.rules_version}.</p><HeldAppeal message={message} /></>}</li>)}</ol>{!rows.length && <p className={styles.empty}>Сообщений пока нет.</p>}{next && <button className={styles.secondary} type="button" disabled={paging.busy} onClick={() => { void more(); }}>Загрузить следующие сообщения</button>}<WriteError error={paging.error} unknown={false} /></>}
    </section><form className={styles.panel} onSubmit={event => { event.preventDefault(); void send(); }}><label className={styles.field}>Сообщение<textarea className={styles.textarea} maxLength={4000} value={text} disabled={write.busy || write.unknown} onChange={event => setText(event.target.value)} /></label><p className={styles.muted}>{text.length}/4000. Контакты и призывы к внешней оплате проверяются сервером до выдачи адресату.</p><button className={styles.primary} type="submit" disabled={!data || !text.trim() || write.busy}>{write.busy ? "Сохраняем…" : write.unknown ? "Повторить отправку с прежним ключом" : "Отправить"}</button><WriteError error={write.error} unknown={write.unknown} /></form></div>;
}
function HeldAppeal({ message }: { message: Message }) {
  const [opened, setOpened] = useState(false);
  return opened ? <AppealForm message={message} /> : <button className={styles.secondary} type="button" onClick={() => setOpened(true)}>Посмотреть случай и обжаловать</button>;
}
function AppealForm({ message }: { message: Message }) {
  const id = message.security_case_id!;
  const load = useCallback((signal: AbortSignal) => commerceClient.securityCase(id, signal), [id]);
  const { data, error, loading, reload } = useLiveResource(`security-appeal:${id}`, load);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<typeof data>(undefined);
  const write = useWrite(`security-appeal:${id}`);
  const value = result ?? data;
  if (!value) return <LiveState error={error} loading={loading} retry={reload} />;
  if (value.message_id !== message.id || value.conversation_id !== message.conversation_id) return <p role="alert">Случай не соответствует сообщению.</p>;
  if (value.appealed || value.decision) return <p className={styles.note}>{value.appealed ? "Обжалование сохранено." : "Рассмотрение завершено."}{value.decision && ` Решение: ${value.decision === "release" ? "разрешить выдачу сообщения" : "оставить удержанным"}. ${value.decision_reason}`}</p>;
  return <form onSubmit={event => { event.preventDefault(); if (!reason.trim()) return; void write.run(`${value.revision}:${reason}`, (key, signal) => commerceClient.appeal(id, value.revision, key, reason, signal)).then(response => { if (response?.ok) setResult(response.value); }); }}><label className={styles.field}>Причина обжалования<textarea className={styles.textarea} value={reason} maxLength={2000} disabled={write.busy || write.unknown} onChange={event => setReason(event.target.value)} /></label><button className={styles.secondary} type="submit" disabled={!reason.trim() || write.busy}>{write.unknown ? "Повторить обжалование с прежним ключом" : "Отправить обжалование"}</button><WriteError error={write.error} unknown={write.unknown} /><button className={styles.secondary} type="button" disabled={write.busy} onClick={reload}>Обновить состояние случая</button></form>;
}
