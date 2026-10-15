"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdditionalService } from "./AdditionalServicesSelector";

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

const statusLabels: Record<
  Order["status"],
  string
> = {
  PENDING: "🟡 Ожидает",
  IN_PROGRESS: "🔵 В работе",
  REVIEW: "🟣 На рассмотрении",
  COMPLETED: "🟢 Завершён",
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
      behavior: "smooth",
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
    <div
      style={{
        height:
          "calc(100vh - 140px)",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      {/* Верхняя панель */}
      <div
        style={{
          borderBottom:
            "1px solid #E5E7EB",
          marginBottom: "12px",
          flexShrink: 0,
        }}
      >
        {/* Основная строка */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent:
              "space-between",
            gap: "8px",
            paddingBottom: "10px",
          }}
        >
          <div
            style={{
              minWidth: 0,
              flex: 1,
            }}
          >
            <h2
              style={{
                margin: 0,
                marginBottom: "4px",
                fontSize: "18px",
                lineHeight: 1.2,
              }}
            >
              {service}
            </h2>

            {order ? (
              <p
                style={{
                  margin: 0,
                  color: "#3547B8",
                  fontSize: "14px",
                }}
              >
                {statusLabels[
                  order.status
                ]}
              </p>
            ) : (
              <p
                style={{
                  margin: 0,
                  color: "#6B7280",
                  fontSize: "13px",
                }}
              >
                Чат с {user}
              </p>
            )}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              flexShrink: 0,
            }}
          >
            {order && (
              <button
                type="button"
                onClick={() =>
                  setDetailsOpen(
                    (prev) => !prev
                  )
                }
                style={{
                  border: "none",
                  background:
                    "transparent",
                  color: "#3547B8",
                  fontWeight: 600,
                  cursor: "pointer",
                  padding:
                    "8px 4px",
                  whiteSpace:
                    "nowrap",
                }}
              >
                Подробнее{" "}
                {detailsOpen
                  ? "⌃"
                  : "⌄"}
              </button>
            )}

            <button
              type="button"
              onClick={deleteChat}
              aria-label="Удалить чат"
              title="Удалить чат"
              style={{
                width: "36px",
                height: "36px",
                border: "none",
                borderRadius: "8px",
                background:
                  "transparent",
                color: "#6B7280",
                cursor: "pointer",
                fontSize: "18px",
                flexShrink: 0,
              }}
            >
              🗑️
            </button>
          </div>
        </div>

        {/* Раскрытая информация о заказе */}
        {order && detailsOpen && (
          <div
            style={{
              paddingBottom: "12px",
            }}
          >
            {/* Сумма и срок */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "1fr 1fr",
                gap: "8px",
                marginBottom: "14px",
              }}
            >
              <div
                style={{
                  padding: "10px",
                  borderRadius: "10px",
                  background:
                    "#F9FAFB",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    color: "#6B7280",
                    marginBottom: "3px",
                  }}
                >
                  Сумма
                </div>

                <strong>
                  {totalPrice} ₽
                </strong>
              </div>

              <div
                style={{
                  padding: "10px",
                  borderRadius: "10px",
                  background:
                    "#F9FAFB",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    color: "#6B7280",
                    marginBottom: "3px",
                  }}
                >
                  Срок
                </div>

                <strong>
                  {totalDurationDays !=
                  null
                    ? `${totalDurationDays} ${
                        totalDurationDays ===
                        1
                          ? "день"
                          : totalDurationDays <
                            5
                          ? "дня"
                          : "дней"
                      }`
                    : "—"}
                </strong>
              </div>
            </div>

            {/* Дополнительные услуги */}
            {canBuyAdditionalServices && (
              <div>
                <h3
                  style={{
                    margin: "0 0 8px",
                    fontSize: "15px",
                  }}
                >
                  Дополнительные услуги
                </h3>

                {availableAdditionalServices.map(
                  (additionalService) => {
                    const alreadyAdded =
                      (
                        order.additionalServices ??
                        []
                      ).some(
                        (item) =>
                          item.id ===
                          additionalService.id
                      );

                    return (
                      <div
                        key={
                          additionalService.id
                        }
                        style={{
                          display: "flex",
                          alignItems:
                            "center",
                          justifyContent:
                            "space-between",
                          gap: "10px",
                          padding:
                            "9px 0",
                          borderTop:
                            "1px solid #E5E7EB",
                        }}
                      >
                        <div
                          style={{
                            minWidth: 0,
                            flex: 1,
                          }}
                        >
                          <div
                            style={{
                              fontSize:
                                "14px",
                              fontWeight: 600,
                            }}
                          >
                            {
                              additionalService.title
                            }
                          </div>

                          <div
                            style={{
                              marginTop:
                                "2px",
                              fontSize:
                                "12px",
                              color:
                                "#6B7280",
                            }}
                          >
                            {additionalService.extraDays >
                            0
                              ? `+${additionalService.extraDays} ${
                                  additionalService.extraDays ===
                                  1
                                    ? "день"
                                    : "дня"
                                } к сроку`
                              : "Без изменения срока"}
                          </div>
                        </div>

                        {alreadyAdded ? (
                          <span
                            style={{
                              color:
                                "#1B8A5A",
                              fontSize:
                                "13px",
                              fontWeight: 600,
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            ✓ Заказано
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              startAdditionalServicePayment(
                                additionalService
                              )
                            }
                            style={{
                              border: "none",
                              borderRadius:
                                "8px",
                              padding:
                                "7px 10px",
                              background:
                                "#3547B8",
                              color:
                                "#FFFFFF",
                              fontSize:
                                "13px",
                              fontWeight: 600,
                              cursor:
                                "pointer",
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            Заказать ·{" "}
                            {
                              additionalService.price
                            }{" "}
                            ₽
                          </button>
                        )}
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Сообщения */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          display: "flex",
          flexDirection:
            "column",
          gap: "12px",
          paddingBottom: "4px",
        }}
      >
        {messages.length === 0 ? (
          <p
            style={{
              textAlign: "center",
              color: "#9CA3AF",
              marginTop: "40px",
            }}
          >
            Начните переписку
          </p>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  alignSelf:
                    msg.mine
                      ? "flex-end"
                      : "flex-start",
                  background:
                    msg.mine
                      ? "#3547B8"
                      : "#F3F4F6",
                  color:
                    msg.mine
                      ? "#FFFFFF"
                      : "#111827",
                  padding: "12px",
                  borderRadius:
                    "12px",
                  maxWidth: "80%",
                  wordBreak:
                    "break-word",
                }}
              >
                <div>
                  {msg.text}
                </div>

                <div
                  style={{
                    fontSize: "11px",
                    marginTop: "6px",
                    opacity: 0.7,
                    textAlign: "right",
                  }}
                >
                  {msg.time}
                </div>
              </div>
            ))}

            <div
              ref={messagesEndRef}
            />
          </>
        )}
      </div>

      {/* Поле сообщения */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          borderTop:
            "1px solid #E5E7EB",
          paddingTop: "12px",
          marginTop: "12px",
          flexShrink: 0,
        }}
      >
        <input
          value={message}
          onChange={(e) =>
            setMessage(
              e.target.value
            )
          }
          onKeyDown={(e) => {
            if (
              e.key === "Enter"
            ) {
              sendMessage();
            }
          }}
          placeholder="Введите сообщение..."
          style={{
            flex: 1,
            minWidth: 0,
            height: "48px",
            border:
              "1px solid #E5E7EB",
            borderRadius: "12px",
            padding: "0 12px",
            outline: "none",
          }}
        />

        <button
          type="button"
          onClick={() =>
            fileInputRef.current?.click()
          }
          style={{
            width: "48px",
            border:
              "1px solid #E5E7EB",
            borderRadius: "12px",
            background:
              "#FFFFFF",
            cursor: "pointer",
            fontSize: "20px",
            flexShrink: 0,
          }}
          aria-label="Прикрепить файл"
          title="Прикрепить файл"
        >
          📎
        </button>

        <input
          ref={fileInputRef}
          type="file"
          hidden
          onChange={(e) => {
            const file =
              e.target.files?.[0];

            if (!file) return;

            const newMessage: Message =
              {
                id: Date.now(),
                text: `📎 ${file.name}`,
                mine: true,
                time: new Date().toLocaleTimeString(
                  "ru-RU",
                  {
                    hour: "2-digit",
                    minute: "2-digit",
                  }
                ),
              };

            setMessages(
              (prev) => [
                ...prev,
                newMessage,
              ]
            );

            e.target.value = "";
          }}
        />

        <button
          type="button"
          onClick={sendMessage}
          disabled={!message.trim()}
          style={{
            width: "60px",
            border: "none",
            borderRadius: "12px",
            background:
              "#3547B8",
            color: "#FFFFFF",
            cursor:
              message.trim()
                ? "pointer"
                : "not-allowed",
            opacity:
              message.trim()
                ? 1
                : 0.5,
            flexShrink: 0,
          }}
        >
          ➤
        </button>
      </div>
    </div>
  );
}
