"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import BackButton from "@/components/BackButton";
import { Icon } from "@/components/studly/Icon";
import { useDemoWorkspace } from "./Provider";
import { parsePrice, quoteMoney } from "./domain";
import { AssetPreview } from "./ui";
import { moderationLabels, rubles, statusLabels, type Actor, type DemoOrder, type DemoService, type MoneySnapshot, type Purchase, type ServiceFormDraft, type ServiceInput } from "./model";
import styles from "./commerce.module.css";

const date = (at: number) => new Date(at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const newActionId = () => crypto.randomUUID();

function Heading({ title, children }: { title: string; children?: ReactNode }) {
  return <header className={styles.intro}><p className={styles.eyebrow}>STUDLY · Демо-кампус</p><h1>{title}</h1>{children && <p>{children}</p>}</header>;
}

function Feedback() {
  const { error, notice } = useDemoWorkspace();
  return <>{error && <p role="alert" className={styles.error}>{error}</p>}{notice && <p role="status" className={styles.success}>{notice}</p>}</>;
}

function Unavailable() {
  const { ready, state, error, retry } = useDemoWorkspace();
  return <div className={`${styles.page} ${styles.narrow}`}><BackButton /><section className={`${styles.panel} ${styles.empty}`}>
    {error && !state ? <><h1>Не удалось открыть демо-кампус</h1><p role="alert">{error}</p><button type="button" className={styles.secondary} onClick={retry}>Повторить загрузку</button></> : !ready ? <><h1>Открываем демо-кампус…</h1><p role="status" aria-busy="true">Восстанавливаем локальные данные.</p></> : <><h1>Познакомимся?</h1><p className={styles.muted}>Завершите демонстрационную регистрацию, чтобы сохранять услуги, заказы и диалоги в этом браузере.</p><Link href="/register/roles" className={styles.primary}>Начать демо-регистрацию</Link></>}
  </section></div>;
}

function Missing({ title, text }: { title: string; text: string }) {
  return <div className={styles.page}><BackButton /><section className={`${styles.panel} ${styles.empty}`}><Icon name="book" /><h1>{title}</h1><p className={styles.muted}>{text}</p><div className={styles.actions}><Link href="/profile" className={styles.secondary}>В кабинет</Link></div></section></div>;
}

function Money({ money, extras, days }: { money: MoneySnapshot; extras?: DemoOrder["selectedExtras"]; days?: number }) {
  return <><dl className={styles.money}>
    <div><dt>Основная услуга</dt><dd>{rubles(money.base)}</dd></div>
    {extras?.map(extra => <div key={extra.id}><dt>{extra.title}</dt><dd>+{rubles(extra.price)}</dd></div>)}
    {!extras && money.extras > 0 && <div><dt>Дополнительные услуги</dt><dd>{rubles(money.extras)}</dd></div>}
    <div><dt>Промежуточная сумма</dt><dd>{rubles(money.subtotal)}</dd></div>
    <div><dt>Комиссия STUDLY · 5%</dt><dd>{rubles(money.fee)}</dd></div>
    <div className={styles.total}><dt>Итого</dt><dd>{rubles(money.total)}</dd></div>
  </dl>{days != null && <p className={styles.duration}><Icon name="clock" />Срок выполнения: {days} дн.</p>}</>;
}

function Counterpart({ checked, onChange, name, role }: { checked: boolean; onChange: (value: boolean) => void; name: string; role: "customer" | "performer" }) {
  const { busy } = useDemoWorkspace();
  return <aside className={styles.counterpart} aria-label="Симуляция второй стороны">
    <label className={styles.check}><input type="checkbox" disabled={busy} checked={checked} onChange={event => onChange(event.target.checked)} /><span>Симулировать вторую сторону</span></label>
    <p>{checked ? `Сейчас действия выполняются от имени демо-участника «${name}» (${role === "performer" ? "исполнитель" : "заказчик"}).` : "Отдельный инструмент проверки диалога и заказа. Другой человек не подключён."} Режим Вашего аккаунта и реальные права не меняются.</p>
  </aside>;
}

export function OrderList() {
  const { state, ready } = useDemoWorkspace();
  if (!ready || !state?.account) return <Unavailable />;
  const account = state.account;
  const performer = account.activeRole === "performer";
  const orders = state.orders.filter(order => performer ? order.performerId === account.id : order.customerId === account.id).slice().sort((a, b) => b.createdAt - a.createdAt);
  return <div className={styles.page}><BackButton /><Heading title={performer ? "Заказы у меня" : "Мои заказы"}>{performer ? "Задачи, в которых Вы указаны исполнителем." : "Условия, переписка и ход работы по Вашим демо-заказам."}</Heading><Feedback />
    <p className={styles.note}>Активный режим: {performer ? "исполнитель" : "заказчик"}. <Link href="/profile">Изменить режим в кабинете</Link>. Все суммы и платежи здесь — локальная симуляция.</p>
    {orders.length ? <ul className={styles.list}>{orders.map(order => <li key={order.id}><Link href={`/orders/${order.id}`} className={styles.card}><div className={styles.row}><div><h2>{order.serviceTitle}</h2><p>{performer ? `Заказчик: ${order.customerName}` : `Исполнитель: ${order.performerName}`}</p></div><strong>{rubles(order.money.total)}</strong></div><div className={styles.row}><span className={styles.badge}>{statusLabels[order.status]}</span><time className={styles.date}>{date(order.createdAt)}</time></div></Link></li>)}</ul> : <section className={`${styles.panel} ${styles.empty}`}><h2>Заказов пока нет</h2><p className={styles.muted}>{performer ? "Здесь появятся заказы на Ваши услуги. Публикация доступна после модерации." : "Выберите услугу и пройдите явно обозначенную симуляцию оформления."}</p><Link href={performer ? "/create-service" : "/search"} className={styles.secondary}>{performer ? "Мои услуги" : "Открыть каталог"}</Link></section>}
  </div>;
}

export function OrderDetail({ id }: { id: string }) { return <OrderDetailBody key={id} id={id} />; }

function OrderDetailBody({ id }: { id: string }) {
  const { state, ready, run, busy } = useDemoWorkspace();
  const [asOther, setAsOther] = useState(false);
  const [result, setResult] = useState("");
  const [remarks, setRemarks] = useState("");
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  if (!ready || !state?.account) return <Unavailable />;
  const account = state.account;
  const order = state.orders.find(item => item.id === id);
  if (!order) return <Missing title="Заказ не найден" text="В локальном демо-кампусе нет такого заказа." />;
  if (![order.customerId, order.performerId].includes(account.id)) return <Missing title="Нет доступа к заказу" text="Этот заказ принадлежит другим демо-участникам." />;
  const counterpartRole = order.customerId === account.id ? "performer" : "customer";
  const counterpartId = counterpartRole === "performer" ? order.performerId : order.customerId;
  const counterpartName = counterpartRole === "performer" ? order.performerName : order.customerName;
  const canSimulate = counterpartId !== account.id;
  const actor: Actor = asOther && canSimulate ? { id: counterpartId, role: counterpartRole } : { id: account.id, role: account.activeRole };
  const customer = actor.id === order.customerId && actor.role === "customer";
  const performer = actor.id === order.performerId && actor.role === "performer";
  const savedReview = state.reviews.find(item => item.orderId === order.id);
  async function act(command: Parameters<typeof run>[0], after?: () => void) {
    try { await run(command, { actor }); after?.(); } catch { /* The provider exposes a readable error and leaves inputs intact. */ }
  }
  return <div className={styles.page}><BackButton /><Heading title={order.serviceTitle}>Заказ от {date(order.createdAt)} · Локальная симуляция без списания денег.</Heading><Feedback />
    {canSimulate && <Counterpart checked={asOther} onChange={setAsOther} name={counterpartName} role={counterpartRole} />}
    <div className={styles.grid}><div className={styles.stack}>
      <section className={styles.panel}><h2>Условия услуги</h2><p className={styles.result}>{order.serviceDescription}</p><h3>Состав работы</h3><ul>{order.serviceIncluded.map((item, index) => <li key={index}>{item}</li>)}</ul><p className={styles.small}>Условия сохранены при оформлении заказа и не меняются вместе с услугой.</p></section>
      <section className={styles.panel}><h2>Ход работы</h2><span className={styles.badge}>{statusLabels[order.status]}</span><p className={styles.muted}>Заказчик: {order.customerName}<br />Исполнитель: {order.performerName}</p>
        {!customer && !performer && <p className={styles.note}>Для действий выберите соответствующий режим в кабинете. Переключение режима не меняет участников заказа.</p>}
        {performer && !order.arbitration && order.status === "PENDING" && <div className={styles.actions}><button type="button" disabled={busy} className={styles.primary} onClick={() => void act({ type: "order.accept", id, revision: order.revision })}>Принять демо-заказ</button></div>}
        {order.result && <><h3>Результат работы</h3><div className={styles.result}>{order.result}</div></>}
        {order.remarks && <><h3>Замечания заказчика</h3><div className={styles.result}>{order.remarks}</div><p className={styles.note}>Работа остаётся на проверке. Исполнитель может передать исправленный результат.</p></>}
        {performer && !order.arbitration && (order.status === "IN_PROGRESS" || (order.status === "REVIEW" && !!order.remarks)) && <form className={styles.stack} onSubmit={event => { event.preventDefault(); void act({ type: "order.result", id, revision: order.revision, text: result }, () => setResult("")); }}>
          <label className={styles.field}>{order.remarks ? "Исправленный результат" : "Результат работы"}<textarea className={styles.textarea} value={result} disabled={busy} onChange={event => setResult(event.target.value)} maxLength={10000} required placeholder="Опишите результат или добавьте ссылку на выполненную работу" /></label>
          <button type="submit" disabled={busy || !result.trim()} className={styles.primary}>{order.remarks ? "Передать исправленный результат" : "Передать на проверку"}</button>
        </form>}
        {customer && !order.arbitration && order.status === "REVIEW" && !order.remarks && <>
          <div className={styles.actions}><button type="button" disabled={busy || !order.result.trim()} className={styles.primary} onClick={() => void act({ type: "order.complete", id, revision: order.revision })}>Всё в порядке</button></div>
          <form className={styles.stack} onSubmit={event => { event.preventDefault(); void act({ type: "order.remarks", id, revision: order.revision, text: remarks }, () => setRemarks("")); }}>
            <label className={styles.field}>Есть замечания<textarea className={styles.textarea} value={remarks} disabled={busy} onChange={event => setRemarks(event.target.value)} maxLength={10000} required placeholder="Объясните, что требуется исправить" /></label>
            <button type="submit" className={styles.secondary} disabled={busy || !remarks.trim()}>Передать замечания</button>
          </form>
        </>}
        <div className={styles.actions}><Link href={`/chats/${order.conversationId}`} className={styles.secondary}><Icon name="chat" />Открыть связанный чат</Link></div>
      </section>
      <section className={styles.panel}><h2>История заказа</h2><ol className={styles.events}>{order.events.map(event => <li key={event.id}><time>{date(event.at)}</time>{event.text}</li>)}</ol></section>
      <section className={styles.panel}><h2>Арбитраж</h2><p className={styles.muted}>{order.arbitration ? "В записи есть отметка об арбитраже. Отзыв для этого заказа недоступен." : "Замечания можно обсудить в связанном чате. Правила арбитража, сроки и решения пока не подключены."}</p><button type="button" disabled className={styles.secondary}>Арбитраж пока недоступен</button></section>
    </div><aside className={styles.stack}>
      <section className={styles.panel}><h2>Стоимость заказа</h2><Money money={order.money} extras={order.selectedExtras} days={order.days} /><p className={styles.note}>Снимок условий на момент оформления. Симуляция оплаты завершена; реальные деньги не списывались.</p></section>
      <section className={styles.panel}><h2>Отзыв</h2>
        {order.arbitration ? <p className={styles.note}>После арбитража отзыв запрещён.</p> : savedReview ? <><p className={styles.badge}>Отзыв уже оставлен · {savedReview.rating} из 5</p>{savedReview.text && <p className={styles.result}>{savedReview.text}</p>}<p className={styles.muted}>Один отзыв на заказ. Изменить или удалить его нельзя.</p></> : order.status !== "COMPLETED" ? <p className={styles.muted}>Оставить отзыв можно только после завершения заказа.</p> : !customer ? <p className={styles.muted}>Отзыв оставляет заказчик в своём режиме.</p> : <form onSubmit={event => { event.preventDefault(); void act({ type: "review", orderId: id, rating, text: review }); }}>
          <fieldset className={styles.stars} disabled={busy}><legend>Оцените работу от 1 до 5</legend>{[1, 2, 3, 4, 5].map(value => <label key={value} className={styles.star}><input type="radio" name="order-rating" value={value} checked={rating === value} onChange={() => setRating(value)} /><span aria-hidden="true">{value} ★</span><span className="sr-only">{value} из 5</span></label>)}</fieldset>
          <label className={styles.field}>Комментарий, необязательно<textarea className={styles.textarea} value={review} disabled={busy} onChange={event => setReview(event.target.value)} maxLength={2000} /></label>
          <p className={styles.muted}>Отзыв публикуется один раз. После отправки его нельзя изменить или удалить.</p><button type="submit" disabled={busy || !rating} className={styles.primary}>Оставить демо-отзыв</button>
        </form>}
      </section>
    </aside></div>
  </div>;
}

export function ChatList() {
  const { state, ready } = useDemoWorkspace();
  if (!ready || !state?.account) return <Unavailable />;
  const account = state.account;
  const conversations = state.conversations.filter(item => item.participants.includes(account.id)).map(conversation => {
    const messages = state.messages.filter(message => message.conversationId === conversation.id).slice().sort((a, b) => a.at - b.at);
    return { conversation, last: messages.at(-1) };
  }).sort((a, b) => (b.last?.at ?? b.conversation.createdAt) - (a.last?.at ?? a.conversation.createdAt));
  return <div className={`${styles.page} ${styles.narrow}`}><BackButton /><Heading title="Чаты">Одна общая переписка для каждого заказа, доступная его участникам.</Heading><Feedback />
    {conversations.length ? <ul className={styles.list}>{conversations.map(({ conversation, last }) => <li key={conversation.id}><Link href={`/chats/${conversation.id}`} className={styles.card}><div className={styles.row}><h2>{conversation.participants.filter(id => id !== account.id).map(id => conversation.participantNames[id]).join(", ") || "Диалог"}</h2><time className={styles.date}>{date(last?.at ?? conversation.createdAt)}</time></div><p>{conversation.title}</p><p className={styles.previewLine}>{last ? `${last.senderName}: ${last.text}` : "Напишите первое сообщение"}</p><span className={styles.badge}>{conversation.orderId ? "Связан с заказом" : "Обсуждение услуги"}</span></Link></li>)}</ul> : <section className={`${styles.panel} ${styles.empty}`}><h2>Пока нет диалогов</h2><p className={styles.muted}>Обсудите услугу с исполнителем или откройте чат из заказа.</p><Link href="/search" className={styles.secondary}>Открыть каталог</Link></section>}
  </div>;
}

export function ChatDetail({ id }: { id: string }) { return <ChatDetailBody key={id} id={id} />; }

function ChatDetailBody({ id }: { id: string }) {
  const { state, ready, run, busy } = useDemoWorkspace();
  const [asOther, setAsOther] = useState(false);
  const [text, setText] = useState("");
  const sending = useRef(false);
  const intent = useRef<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const messages = state?.messages.filter(message => message.conversationId === id).slice().sort((a, b) => a.at - b.at) ?? [];
  const lastId = messages.at(-1)?.id;
  useEffect(() => { bottom.current?.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }); }, [lastId]);
  if (!ready || !state?.account) return <Unavailable />;
  const account = state.account;
  const conversation = state.conversations.find(item => item.id === id);
  if (!conversation) return <Missing title="Чат не найден" text="Такого диалога нет в Вашем локальном демо-кампусе." />;
  if (!conversation.participants.includes(account.id)) return <Missing title="Нет доступа к переписке" text="Доступ к этому диалогу есть только у его участников." />;
  const order = state.orders.find(item => item.id === conversation.orderId);
  const other = conversation.participants.find(participant => participant !== account.id);
  const otherRole = order?.customerId === other ? "customer" : "performer";
  const actor: Actor = asOther && other ? { id: other, role: otherRole } : { id: account.id, role: account.activeRole };
  async function send(event: FormEvent) {
    event.preventDefault();
    if (sending.current || busy || !text.trim()) return;
    sending.current = true;
    intent.current ??= newActionId();
    try { await run({ type: "message", conversationId: id, text }, { actor, actionId: intent.current }); setText(""); intent.current = null; }
    catch { /* Retain the same intent and text for a safe explicit retry. */ }
    finally { sending.current = false; }
  }
  return <div className={`${styles.page} ${styles.narrow}`}><BackButton /><Feedback />
    {other && <Counterpart checked={asOther} onChange={value => { setAsOther(value); setText(""); intent.current = null; }} name={conversation.participantNames[other]} role={otherRole} />}
    <section className={styles.chat} aria-label="Демонстрационная переписка">
      <header className={styles.chatHead}><h1>{conversation.title}</h1><p>{conversation.participants.map(participant => conversation.participantNames[participant]).join(" · ")}</p>{order && <div className={styles.actions}><Link href={`/orders/${order.id}`} className={styles.secondary}>Заказ · {statusLabels[order.status]}</Link></div>}</header>
      <div className={styles.messages} role="log" aria-label="Сообщения" aria-live="polite" aria-relevant="additions text">
        {messages.length ? messages.map(message => <div className={`${styles.bubble}${message.senderId === actor.id ? ` ${styles.mine}` : ""}`} key={message.id}><small>{message.senderName}</small><div>{message.text}</div><time>{date(message.at)}</time></div>) : <div className={styles.empty}><Icon name="chat" /><p className={styles.muted}>Начните обсуждение. Сообщения видны только в этой локальной симуляции.</p></div>}<div ref={bottom} />
      </div>
      <form className={styles.composer} onSubmit={event => void send(event)}><label className="sr-only" htmlFor="workspace-message">Сообщение от {conversation.participantNames[actor.id]}</label><input id="workspace-message" className={styles.input} disabled={busy} value={text} onChange={event => { setText(event.target.value); intent.current = null; }} placeholder="Сообщение…" maxLength={4000} autoComplete="off" /><button type="submit" className={styles.primary} disabled={busy || !text.trim()} aria-label="Отправить демо-сообщение"><Icon name="arrow" /></button></form>
    </section><p className={styles.note}>Демо: сообщения сохраняются в этом браузере. Другому человеку они не отправляются. Передача файлов пока недоступна.</p>
  </div>;
}

function useCheckoutIntent(fingerprint: string) {
  const [saved, setSaved] = useState<{ fingerprint: string; id: string } | null>(null);
  const [failure, setFailure] = useState("");
  function create(renew = false) {
    try {
      const key = `studly-demo-checkout-intent:${fingerprint}`;
      let value = renew ? null : sessionStorage.getItem(key);
      if (!value) { value = newActionId(); sessionStorage.setItem(key, value); }
      setSaved({ fingerprint, id: value }); setFailure("");
    } catch { setSaved(null); setFailure("Не удалось сохранить идентификатор оформления. Разрешите локальное хранилище и повторите попытку."); }
  }
  useEffect(() => {
    // The stable identifier is loaded only in the browser and survives reload.
    try {
      const key = `studly-demo-checkout-intent:${fingerprint}`;
      let value = sessionStorage.getItem(key);
      if (!value) { value = newActionId(); sessionStorage.setItem(key, value); }
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Restore the browser-only idempotency token after hydration.
      setSaved({ fingerprint, id: value }); setFailure("");
    } catch { setSaved(null); setFailure("Не удалось сохранить идентификатор оформления. Разрешите локальное хранилище и повторите попытку."); }
  }, [fingerprint]);
  return { intent: saved?.fingerprint === fingerprint ? saved.id : null, failure, renew: () => create(true), retry: () => create() };
}

export function DemoCheckout({ purchase }: { purchase: Purchase }) { return <CheckoutBody purchase={purchase} />; }

export function IncomingDemoOrder({ purchase }: { purchase: Purchase }) {
  const { state, busy } = useDemoWorkspace();
  const [enabled, setEnabled] = useState(false);
  const account = state?.account;
  const service = state?.services.find(item => item.id === purchase.serviceId && item.performerId === account?.id && item.status === "approved");
  if (!account || !service || purchase.performerId !== account.id || account.moderation !== "approved") return null;
  return <section className={styles.incoming} aria-label="Симуляция входящего заказа">
    <h3>Попробуйте входящий заказ</h3>
    <p className={styles.muted}>Отдельный тестовый заказчик может оформить демо-заказ на Вашу одобренную услугу. Реальный пользователь не подключается, Ваш аккаунт остаётся исполнителем.</p>
    {account.activeRole !== "performer" ? <p className={styles.note}>Переключитесь в режим исполнителя в <Link href="/profile">кабинете</Link>.</p> : <>
      <label className={styles.check}><input type="checkbox" disabled={busy} checked={enabled} onChange={event => setEnabled(event.target.checked)} /><span>Включить тестового участника «Демо-заказчик»</span></label>
      {enabled && <CheckoutBody purchase={purchase} incoming />}
    </>}
  </section>;
}

function CheckoutBody({ purchase, incoming = false }: { purchase: Purchase; incoming?: boolean }) {
  const { state, ready, run, busy } = useDemoWorkspace();
  const router = useRouter();
  const [confirmedFor, setConfirmedFor] = useState("");
  const submitting = useRef(false);
  const actorId = incoming ? "demo-guest-customer" : state?.account?.id ?? "anonymous";
  const fingerprint = JSON.stringify([state?.account?.id ?? "anonymous", actorId, purchase.serviceId, purchase.revision ?? 0, purchase.performerId, purchase.performerName, purchase.title, purchase.base, purchase.days, purchase.extras.map(extra => [extra.id, extra.title, extra.price, extra.extraDays]).sort((a, b) => String(a[0]).localeCompare(String(b[0])))]);
  const confirmed = confirmedFor === fingerprint;
  const { intent, failure, renew, retry } = useCheckoutIntent(fingerprint);
  let money: MoneySnapshot | null = null;
  try { money = quoteMoney(purchase.base, purchase.extras.reduce((sum, extra) => sum + extra.price, 0)); } catch { /* Invalid amounts cannot be submitted. */ }
  const priorOrder = intent && state?.applied[intent]?.entityId;
  const account = state?.account;
  async function purchaseOrder() {
    if (!confirmed || !intent || !money || submitting.current || busy) return;
    submitting.current = true;
    try { const orderId = await run({ type: "purchase", purchase, simulated: true }, { actionId: intent, ...(incoming ? { actor: { id: "demo-guest-customer", role: "customer" as const } } : {}) }); if (orderId) router.push(`/orders/${orderId}`); }
    catch { /* Keep the intent stable so an explicit retry cannot duplicate the order. */ }
    finally { submitting.current = false; }
  }
  return <div className={styles.checkout}>
    {money ? <Money money={money} extras={purchase.extras} days={purchase.days + purchase.extras.reduce((sum, extra) => sum + extra.extraDays, 0)} /> : <p role="alert" className={styles.error}>Не удалось рассчитать стоимость. Оформление недоступно.</p>}
    {!ready ? <p role="status">Восстанавливаем демо-кампус…</p> : !account ? <div className={styles.actions}><Link href="/register/roles" className={styles.secondary}>Завершить демо-регистрацию</Link></div> : incoming && (purchase.performerId !== account.id || account.activeRole !== "performer") ? <p className={styles.note}>Симуляция входящего заказа доступна исполнителю собственной услуги.</p> : !incoming && purchase.performerId === account.id ? <p className={styles.note}>Это Ваша услуга. Оформить заказ у самого себя нельзя. <Link href="/create-service">Управлять услугами</Link></p> : !incoming && account.activeRole !== "customer" ? <p className={styles.note}>Для оформления выберите режим заказчика в <Link href="/profile">кабинете</Link>.</p> : priorOrder ? <>
      <p role="status" className={styles.success}>Этот демо-заказ уже создан. Повторная оплата не выполняется.</p><div className={styles.actions}><Link href={`/orders/${priorOrder}`} className={styles.primary}>Открыть заказ</Link><button type="button" className={styles.secondary} disabled={busy} onClick={() => { setConfirmedFor(""); renew(); }}>Новый заказ</button></div>
    </> : <>
      <label className={styles.check}><input type="checkbox" disabled={busy} checked={confirmed} onChange={event => setConfirmedFor(event.target.checked ? fingerprint : "")} /><span>Симуляция оплаты, реальные деньги не списываются</span></label>
      <button type="button" className={`${styles.primary} ${styles.full}`} disabled={!confirmed || !intent || !money || busy} onClick={() => void purchaseOrder()}>{busy ? "Сохраняем демо-заказ…" : "Симулировать оплату и создать заказ"}</button>
    </>}
    {failure && <div className={styles.error} role="alert">{failure}<button type="button" className={styles.secondary} onClick={retry}>Повторить</button></div>}<Feedback />
  </div>;
}

type EditableExtra = { id: string; title: string; price: string; extraDays: string };
type FormDraft = ServiceFormDraft;
function fromService(service?: DemoService): FormDraft {
  const decimal = (value: number) => `${Math.floor(value / 100)}.${String(value % 100).padStart(2, "0")}`;
  return service ? { title: service.title, category: service.category, description: service.description, included: service.included.join("\n"), price: decimal(service.price), days: String(service.days), extras: service.extras.map(extra => ({ ...extra, price: decimal(extra.price), extraDays: String(extra.extraDays) })), exampleIds: service.exampleIds } : { title: "", category: "", description: "", included: "", price: "", days: "", extras: [], exampleIds: [] };
}
function readInput(form: FormDraft): ServiceInput {
  const price = parsePrice(form.price.replace(",", "."));
  const days = Number(form.days);
  if (typeof price !== "number" || !Number.isSafeInteger(price) || price < 1) throw new Error("Укажите положительную цену с точностью до копеек.");
  if (!form.days.trim() || !Number.isSafeInteger(days) || days < 1) throw new Error("Укажите срок целым положительным числом дней.");
  if (!form.title.trim() || !form.category.trim() || !form.description.trim() || !form.included.trim()) throw new Error("Заполните название, категорию, описание и состав услуги.");
  if (!form.exampleIds.length) throw new Error("Выберите хотя бы один пример из Вашего одобренного портфолио.");
  const extras = form.extras.map((extra, index) => {
    const value = parsePrice(extra.price.replace(",", "."));
    const extraDays = Number(extra.extraDays);
    if (!extra.title.trim() || typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || !extra.extraDays.trim() || !Number.isSafeInteger(extraDays) || extraDays < 0) throw new Error(`Проверьте дополнение ${index + 1}: нужны название, неотрицательная цена и целое число дополнительных дней.`);
    return { id: extra.id, title: extra.title.trim(), price: value, extraDays };
  });
  return { title: form.title.trim(), category: form.category.trim(), description: form.description.trim(), included: form.included.split("\n").map(item => item.trim()).filter(Boolean), price, days, extras, exampleIds: form.exampleIds };
}

export function ServiceComposer({ id }: { id?: number } = {}) {
  const { state, ready, busy } = useDemoWorkspace();
  const router = useRouter();
  const [selected, setSelected] = useState<number | null | undefined>(id);
  if (!ready || !state?.account) return <Unavailable />;
  const account = state.account;
  if (!account.roles.includes("performer") || account.activeRole !== "performer") return <Missing title="Нужен режим исполнителя" text="Выберите предусмотренную Вашим аккаунтом роль исполнителя в кабинете." />;
  if (account.moderation !== "approved") return <Missing title="Сначала подготовьте профиль" text="Создание услуг доступно после добавления обязательных примеров работ и одобрения демо-профиля." />;
  const own = state.services.filter(service => service.performerId === account.id);
  const currentId = selected === undefined ? state.composerDrafts?.new ? null : own.find(service => service.status === "draft" || service.status === "changes" || service.status === "rejected")?.id ?? null : selected;
  const service = own.find(item => item.id === currentId);
  if (currentId != null && !service) return <Missing title="Услуга не найдена" text="В Вашем кабинете нет услуги с таким идентификатором." />;
  function select(serviceId: number | null) {
    setSelected(serviceId);
    router.push(serviceId == null ? "/create-service" : `/create-service?edit=${serviceId}`);
  }
  return <div className={styles.page}><BackButton /><Heading title="Мои услуги">Черновик → предпросмотр → демонстрационная модерация → публикация.</Heading><Feedback />
    <div className={styles.serviceList} aria-label="Выбор собственной услуги"><button type="button" disabled={busy} aria-pressed={currentId == null} onClick={() => select(null)}>Новая услуга{state.composerDrafts?.new ? " · есть сохранённая форма" : ""}</button>{own.map(item => <button type="button" disabled={busy} key={item.id} aria-pressed={currentId === item.id} onClick={() => select(item.id)}>{item.title || "Черновик"} · {moderationLabels[item.status]}</button>)}</div>
    <ServiceComposerBody key={service?.id ?? "new"} service={service} onSaved={select} />
  </div>;
}

function ServiceComposerBody({ service, onSaved }: { service?: DemoService; onSaved: (id: number) => void }) {
  const { state, run, busy } = useDemoWorkspace();
  const formKey = service ? String(service.id) : "new";
  const buffer = state?.composerDrafts?.[formKey];
  const bufferMatches = !!buffer && buffer.serviceRevision === (service?.revision ?? null);
  const [form, setForm] = useState<FormDraft>(() => bufferMatches ? structuredClone(buffer!.form) : fromService(service));
  const [formRevision, setFormRevision] = useState<number | null>(() => buffer?.revision ?? null);
  const [serviceRevision, setServiceRevision] = useState<number | null>(() => service?.revision ?? null);
  const [partialInfo, setPartialInfo] = useState(() => bufferMatches ? "Незавершённая форма восстановлена из этого браузера. Заполните обязательные поля и сохраните готовый черновик перед модерацией." : "");
  const [validation, setValidation] = useState("");
  const [preview, setPreview] = useState(false);
  const [dirty, setDirty] = useState(false);
  const saving = useRef(false);
  const account = state!.account!;
  const readonly = service?.status === "pending" || service?.status === "approved";
  const externalChange = formRevision !== (buffer?.revision ?? null) || serviceRevision !== (service?.revision ?? null);
  const patch = (value: Partial<FormDraft>) => { setForm(current => ({ ...current, ...value })); setDirty(true); setValidation(""); setPartialInfo(""); };
  function restoreCurrent() {
    setForm(bufferMatches ? structuredClone(buffer!.form) : fromService(service));
    setFormRevision(buffer?.revision ?? null); setServiceRevision(service?.revision ?? null);
    setDirty(false); setValidation(""); setPartialInfo(bufferMatches ? "Сохранённая незавершённая форма восстановлена. Дополните поля перед отправкой на модерацию." : "");
  }
  async function save() {
    if (readonly || busy || saving.current) return;
    saving.current = true;
    try {
      let input: ServiceInput;
      try { input = readInput(form); }
      catch (error) {
        try {
          await run({ type: "service.form", key: formKey, revision: formRevision, serviceRevision, form });
          setFormRevision((formRevision ?? 0) + 1); setDirty(false); setValidation("");
          setPartialInfo(`Незаполненная форма сохранена и восстановится после перезагрузки. ${error instanceof Error ? error.message : "Дополните обязательные поля."} Она ещё не отправлена на модерацию.`);
        } catch { /* A stale buffer is preserved for both tabs; provider explains the conflict. */ }
        return;
      }
      try {
        const result = await run({ type: "service.save", id: service?.id, revision: serviceRevision ?? undefined, formRevision, input });
        setDirty(false); setFormRevision(null); setServiceRevision((serviceRevision ?? 0) + 1); setValidation(""); setPartialInfo(""); if (result) onSaved(Number(result));
      } catch { /* Provider feedback reports persistence/domain errors without duplicating the alert. */ }
    } finally { saving.current = false; }
  }
  async function submit() {
    if (!service || dirty || buffer || externalChange || readonly || busy || saving.current) return;
    saving.current = true;
    try { await run({ type: "service.submit", id: service.id }, { expectedRevision: state!.revision }); } catch { /* Provider feedback preserves the draft. */ }
    finally { saving.current = false; }
  }
  const changeExtra = (id: string, patchValue: Partial<EditableExtra>) => patch({ extras: form.extras.map(extra => extra.id === id ? { ...extra, ...patchValue } : extra) });
  return <div className={styles.grid}><section className={styles.panel} aria-labelledby="composer-title"><h2 id="composer-title">{service ? "Данные услуги" : "Новый черновик"}</h2>
    {service && <p className={styles.badge}>{moderationLabels[service.status]}</p>}{service?.reason && <p className={styles.note}>Причина проверки: {service.reason}</p>}
    {buffer && !bufferMatches && <p className={styles.note}>Сохранённая незавершённая форма относится к другой редакции услуги и не подставлялась поверх актуальных данных.</p>}
    {externalChange && <div className={styles.error} role="alert">Сохранённая форма или услуга изменилась в другой вкладке. Ваши текущие поля не заменены. Для восстановления актуальной версии сначала сохраните нужный текст отдельно.<div className={styles.actions}><button type="button" disabled={busy} className={styles.secondary} onClick={restoreCurrent}>Загрузить сохранённую версию</button></div></div>}
    {readonly && <p className={styles.note}>{service?.status === "pending" ? "Услуга ожидает проверки. Во время модерации редактирование недоступно." : <>Услуга одобрена и доступна в демо-каталоге. Изменение опубликованной услуги пока недоступно. <Link href={`/service/${service.id}`}>Открыть страницу услуги</Link>.</>}</p>}
    <fieldset disabled={busy || readonly} className={styles.stack} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <label className={styles.field}>Название услуги<input className={styles.input} value={form.title} onChange={event => patch({ title: event.target.value })} maxLength={200} required /></label>
      <label className={styles.field}>Категория<select className={styles.select} value={form.category} onChange={event => patch({ category: event.target.value })} required><option value="">Выберите категорию</option>{["Помощь с заданиями", "Помощь с курсовыми", "Репетиторство", "Программирование", "Инженерная графика", "Презентации", "Рефераты и отчёты", "Видеомонтаж"].map(category => <option key={category}>{category}</option>)}</select></label>
      <label className={styles.field}>Описание<textarea className={styles.textarea} value={form.description} onChange={event => patch({ description: event.target.value })} maxLength={10000} required /></label>
      <label className={styles.field}>Что входит в услугу<textarea className={styles.textarea} value={form.included} onChange={event => patch({ included: event.target.value })} placeholder="Каждый пункт с новой строки" required /></label>
      <div className={styles.two}><label className={styles.field}>Цена, ₽<input className={styles.input} type="text" inputMode="decimal" value={form.price} onChange={event => patch({ price: event.target.value })} placeholder="1000,00" required /></label><label className={styles.field}>Срок, дней<input className={styles.input} type="number" min="1" step="1" value={form.days} onChange={event => patch({ days: event.target.value })} required /></label></div>
      <fieldset className={styles.exampleList}><legend>Примеры работ из Вашего портфолио</legend>{account.examples.length ? account.examples.map(example => <label key={example.id} className={styles.check}><input type="checkbox" checked={form.exampleIds.includes(example.id)} onChange={event => patch({ exampleIds: event.target.checked ? [...form.exampleIds, example.id] : form.exampleIds.filter(id => id !== example.id) })} /><span>{example.title}</span></label>) : <p className={styles.muted}>Добавьте обязательные примеры работ в кабинете.</p>}</fieldset>
      <h3>Дополнительные услуги</h3>{form.extras.map((extra, index) => <div className={styles.extra} key={extra.id}><label className={styles.field}>Название дополнения {index + 1}<input className={styles.input} value={extra.title} onChange={event => changeExtra(extra.id, { title: event.target.value })} /></label><div className={styles.two}><label className={styles.field}>Цена, ₽<input className={styles.input} inputMode="decimal" value={extra.price} onChange={event => changeExtra(extra.id, { price: event.target.value })} /></label><label className={styles.field}>Дополнительные дни<input type="number" min="0" step="1" className={styles.input} value={extra.extraDays} onChange={event => changeExtra(extra.id, { extraDays: event.target.value })} /></label></div><button type="button" className={styles.secondary} onClick={() => patch({ extras: form.extras.filter(item => item.id !== extra.id) })}>Удалить дополнение {index + 1}</button></div>)}
      <button type="button" className={styles.secondary} onClick={() => patch({ extras: [...form.extras, { id: newActionId(), title: "", price: "0", extraDays: "0" }] })}>Добавить дополнение</button>
    </fieldset>
    {validation && <p role="alert" className={styles.error} id="composer-validation">{validation}</p>}
    {partialInfo && <p role="status" className={styles.note}>{partialInfo}</p>}
    <div className={styles.actions}><button type="button" className={styles.secondary} onClick={() => setPreview(value => !value)} aria-expanded={preview} aria-controls="composer-preview">{preview ? "Скрыть предпросмотр" : "Предпросмотр"}</button>{!readonly && <button type="button" className={styles.primary} disabled={busy} onClick={() => void save()}>{busy ? "Сохраняем…" : "Сохранить черновик"}</button>}</div>
    <p className={styles.small}>{dirty ? "Есть несохранённые изменения. Сохраните черновик перед выходом." : buffer ? "Незавершённая форма сохранена в этом браузере." : service ? "Черновик сохранён в этом браузере." : "Заполните данные и сохраните черновик для продолжения после перезагрузки."}</p>
  </section><aside className={styles.stack}><section className={styles.panel}><h2>Отправка на проверку</h2><p className={styles.muted}>На модерацию отправляется сохранённая версия. Только одобренная услуга появляется в демонстрационном каталоге.</p><button type="button" className={`${styles.primary} ${styles.full}`} disabled={busy || readonly || dirty || !!buffer || externalChange || !service} onClick={() => void submit()}>Отправить на демо-модерацию</button>{(dirty || buffer) && <p className={styles.note}>Дополните обязательные поля и сохраните готовый черновик перед модерацией.</p>}<p className={styles.note}>Это локальная демонстрация. Реальная публикация и серверная модерация не выполняются.</p></section>
    {preview && <section className={styles.panel} id="composer-preview" aria-label="Предпросмотр услуги"><p className={styles.eyebrow}>Предпросмотр</p><h2>{form.title || "Название услуги"}</h2><p className={styles.muted}>{form.category || "Категория не выбрана"}</p><p className={styles.result}>{form.description || "Описание услуги"}</p><h3>Что входит</h3><ul>{form.included.split("\n").filter(Boolean).map((line, index) => <li key={index}>{line}</li>)}</ul><p>{form.price || "—"} ₽ · {form.days || "—"} дн.</p><h3>Примеры работ</h3>{account.examples.filter(example => form.exampleIds.includes(example.id)).map(example => <AssetPreview key={example.id} example={example} />)}{!form.exampleIds.length && <p className={styles.muted}>Примеры пока не выбраны.</p>}<p className={styles.small}>Дополнений: {form.extras.length}.</p></section>}
  </aside></div>;
}
