"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdditionalService } from "./AdditionalServicesSelector";
import { DemoOrderStatus, demoPerformerName } from "./studly/DemoOrderPresentation";
import { Icon } from "./studly/Icon";
import "./studly/activity.css";

type Message = {
  id: number;
  text: string;
  mine: boolean;
  time: string;
};

type Props = {
  chatId: string;
  user: string;
  service: string;
  orderId?: number | null;
};

type Order = {
  id: number;
  serviceTitle: string;
  status:
    | "PENDING"
    | "IN_PROGRESS"
    | "REVIEW"
    | "COMPLETED";

  basePrice?: number;
  totalPrice?: number;

  baseDurationDays?: number;
  totalDurationDays?: number;

  additionalServices?: AdditionalService[];
};

/*
 * Пока это mock-данные для MVP.
 * Позже список будет приходить из услуги / backend.
 */
const availableAdditionalServices: AdditionalService[] = [
  {
    id: "urgent",
    title: "Срочное выполнение",
    price: 300,
    extraDays: 0,
  },
  {
    id: "call",
    title: "Созвон и объяснение",
    price: 500,
    extraDays: 0,
  },
  {
    id: "report",
    title: "Подробный отчёт",
    price: 400,
    extraDays: 1,
  },
];

export default function ChatWindow({
  chatId,
  user,
  service,
  orderId,
}: Props) {
  const router = useRouter();
  const performerName = demoPerformerName(user);

  const [message, setMessage] = useState("");

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const messagesEndRef =
    useRef<HTMLDivElement>(null);

  const [messages, setMessages] =
    useState<Message[]>([]);

  const [order, setOrder] =
    useState<Order | null>(null);

  const [loaded, setLoaded] =
    useState(false);

  const [detailsOpen, setDetailsOpen] =
    useState(false);

  /*
   * Загрузка сообщений
   */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(
        `studly-chat-messages-${chatId}`
      );

      const parsed: unknown = saved
        ? JSON.parse(saved)
        : [];

      // eslint-disable-next-line react-hooks/set-state-in-effect -- Load messages persisted in localStorage after hydration.
      setMessages(
        Array.isArray(parsed)
          ? (parsed as Message[])
          : []
      );
    } catch {
      setMessages([]);
    }

    setLoaded(true);
  }, [chatId]);

  /*
   * Загрузка заказа
   */
  useEffect(() => {
    if (orderId == null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Clear order details when this chat has no linked order.
      setOrder(null);
      return;
    }

    try {
      const saved = localStorage.getItem(
        "studly-orders"
      );

      const parsed: unknown = saved
        ? JSON.parse(saved)
        : [];

      const orders = Array.isArray(parsed)
        ? (parsed as Order[])
        : [];

      const foundOrder = orders.find(
        (item) =>
          String(item.id) === String(orderId)
      );

      setOrder(foundOrder ?? null);
    } catch {
      setOrder(null);
    }
  }, [orderId]);

  /*
   * Сохранение сообщений
   */
  useEffect(() => {
    if (!loaded) return;

    localStorage.setItem(
      `studly-chat-messages-${chatId}`,
      JSON.stringify(messages)
    );
  }, [messages, chatId, loaded]);

  /*
   * Автопрокрутка к последнему сообщению
   */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  }, [messages]);

  /*
   * Отправка сообщения
   */
  const sendMessage = () => {
    const trimmedMessage =
      message.trim();

    if (!trimmedMessage) return;

    const newMessage: Message = {
      id: Date.now(),
      text: trimmedMessage,
      mine: true,
      time: new Date().toLocaleTimeString(
        "ru-RU",
        {
          hour: "2-digit",
          minute: "2-digit",
        }
      ),
    };

    setMessages((prev) => [
      ...prev,
      newMessage,
    ]);

    setMessage("");
  };

  /*
   * Переход к оплате дополнительной услуги.
   *
   * ВАЖНО:
   * Здесь заказ ещё НЕ изменяется.
   * Изменение произойдёт только после успешной оплаты
   * на странице additional-payment.
   */
  const startAdditionalServicePayment = (
    additionalService: AdditionalService
  ) => {
    if (!order) return;

    const alreadyAdded =
      (order.additionalServices ?? []).some(
        (item) =>
          item.id === additionalService.id
      );

    if (alreadyAdded) return;

    const paymentUrl =
      `/orders/${order.id}/additional-payment` +
      `?chatId=${encodeURIComponent(chatId)}` +
      `&serviceId=${encodeURIComponent(
        additionalService.id
      )}`;

    router.push(paymentUrl);
  };

  /*
   * Удаление чата.
   *
   * Заказ при этом НЕ удаляется.
   */
  const deleteChat = () => {
    /*
     * Предзаказный чат:
     * заказа ещё нет.
     */
    if (!order) {
      const confirmed = window.confirm(
        "Удалить этот чат из истории?"
      );

      if (!confirmed) return;
    }

    /*
     * Заказ ожидает принятия.
     */
    if (order?.status === "PENDING") {
      const confirmed = window.confirm(
        "⚠️ У Вас есть активный заказ.\n\n" +
          "Если удалить чат, заказ и финансовая история НЕ будут удалены, " +
          "но чат исчезнет из списка чатов.\n\n" +
          "Вы уверены, что хотите удалить чат?"
      );

      if (!confirmed) return;
    }

    /*
     * Заказ находится в работе.
     */
    if (order?.status === "IN_PROGRESS") {
      const confirmed = window.confirm(
        "⚠️ У Вас есть заказ в процессе.\n\n" +
          "Если удалить чат, заказ и финансовая история сохранятся, " +
          "но чат исчезнет из списка чатов.\n\n" +
          "Вы уверены, что хотите удалить чат?"
      );

      if (!confirmed) return;
    }

    /*
     * Работа выполнена, но заказ ещё не подтверждён.
     */
    if (order?.status === "REVIEW") {
      const confirmed = window.confirm(
        "⚠️ Работа уже выполнена, но заказ ещё не подтверждён.\n\n" +
          "Если Вы удалите чат, внести замечания по работе " +
          "через этот чат больше не получится.\n\n" +
          "Заказ и финансовая история при этом сохранятся.\n\n" +
          "Вы уверены, что хотите удалить чат?"
      );

      if (!confirmed) return;
    }

    /*
     * Завершённый заказ.
     */
    if (order?.status === "COMPLETED") {
      const confirmed = window.confirm(
        "Удалить этот чат из истории?\n\n" +
          "Завершённый заказ и финансовая история сохранятся."
      );

      if (!confirmed) return;
    }

    try {
      /*
       * Удаляем только сам чат.
       */
      const savedChats =
        localStorage.getItem(
          "studly-chats"
        );

      const parsedChats: unknown =
        savedChats
          ? JSON.parse(savedChats)
          : [];

      const chats = Array.isArray(
        parsedChats
      )
        ? parsedChats
        : [];

      const updatedChats = chats.filter(
        (item) =>
          String(
            (item as { id?: number }).id
          ) !== String(chatId)
      );

      localStorage.setItem(
        "studly-chats",
        JSON.stringify(updatedChats)
      );

      /*
       * Удаляем сообщения чата.
       *
       * Сам заказ НЕ трогаем.
       */
      localStorage.removeItem(
        `studly-chat-messages-${chatId}`
      );

      router.push("/chats");
    } catch {
      window.alert(
        "Не удалось удалить чат. Попробуйте ещё раз."
      );
    }
  };

  const totalPrice =
    order?.totalPrice ??
    order?.basePrice ??
    0;

  const totalDurationDays =
    order?.totalDurationDays ??
    order?.baseDurationDays ??
    null;

  const canBuyAdditionalServices =
    order != null &&
    (order.status === "PENDING" ||
      order.status === "IN_PROGRESS");

  return (
    <section className="activity-chat" aria-label={`Переписка с ${performerName}`}>
      <header className="activity-chat-heading">
        <div className="activity-row">
          <div className="activity-card-main">
            <h1>{performerName}</h1>
            <p>{service}</p>
          </div>
          <div className="activity-chat-tools">
            {order && <button type="button" onClick={() => setDetailsOpen((prev) => !prev)} className="secondary-btn" aria-expanded={detailsOpen} aria-controls="chat-order-details">{detailsOpen ? "Скрыть" : "Подробнее"}<Icon name="book" /></button>}
            <button type="button" onClick={deleteChat} aria-label="Удалить чат" title="Удалить чат" className="activity-delete"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5" /></svg></button>
          </div>
        </div>
        {order && <div className="activity-card-meta"><DemoOrderStatus status={order.status} /><span>Заказ № {order.id}</span></div>}
      </header>
      {order && detailsOpen && (
        <div className="activity-chat-details" id="chat-order-details">
          <div className="activity-chat-stats">
            <div className="activity-chat-stat"><small>Сумма</small><strong>{totalPrice} ₽</strong></div>
            <div className="activity-chat-stat"><small>Срок</small><strong>{totalDurationDays != null ? `${totalDurationDays} ${totalDurationDays === 1 ? "день" : totalDurationDays < 5 ? "дня" : "дней"}` : "—"}</strong></div>
          </div>
          {canBuyAdditionalServices && (
            <div>
              <h2>Дополнительные услуги</h2>
              {availableAdditionalServices.map((additionalService) => {
                const alreadyAdded = (order.additionalServices ?? []).some((item) => item.id === additionalService.id);
                return <div key={additionalService.id} className="activity-addon">
                  <div><strong>{additionalService.title}</strong><small>{additionalService.extraDays > 0 ? `+${additionalService.extraDays} ${additionalService.extraDays === 1 ? "день" : additionalService.extraDays < 5 ? "дня" : "дней"}` : "Без изменения срока"}</small></div>
                  {alreadyAdded ? <span className="activity-addon-added">Уже добавлено</span> : <button type="button" onClick={() => startAdditionalServicePayment(additionalService)} className="primary-btn">Заказать · {additionalService.price} ₽</button>}
                </div>;
              })}
            </div>
          )}
        </div>
      )}
      <div className="activity-messages" role="log" aria-label="Сообщения" aria-live="polite" aria-relevant="additions text">
        {messages.length === 0 ? (
          <div className="activity-message-empty"><Icon name="chat" /><strong>Начните переписку</strong><p>Обсудите задачу и детали работы.</p></div>
        ) : (
          <>{messages.map((msg) => <div key={msg.id} className={`activity-bubble${msg.mine ? " is-mine" : ""}`}><div>{msg.text}</div><time>{msg.time}</time></div>)}<div ref={messagesEndRef} /></>
        )}
      </div>
      <div className="activity-composer">
        <label className="sr-only" htmlFor="chat-message">Сообщение</label>
        <input id="chat-message" value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { sendMessage(); } }} placeholder="Сообщение…" className="activity-message-input" autoComplete="off" />
        <button type="button" onClick={() => fileInputRef.current?.click()} className="activity-attach" aria-label="Прикрепить файл" title="Прикрепить файл"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 12 6-6a3.5 3.5 0 0 1 5 5l-8 8a5 5 0 0 1-7-7l8-8M8 12l5-5a1.5 1.5 0 0 1 2 2l-6 6" /></svg></button>
        <input ref={fileInputRef} type="file" hidden onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const newMessage: Message = {
            id: Date.now(),
            text: `📎 ${file.name}`,
            mine: true,
            time: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
          };
          setMessages((prev) => [...prev, newMessage]);
          e.target.value = "";
        }} />
        <button type="button" onClick={sendMessage} disabled={!message.trim()} className="primary-btn" aria-label="Отправить сообщение" title="Отправить сообщение"><Icon name="arrow" /></button>
      </div>
    </section>
  );
}
