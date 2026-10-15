"use client";

import { useRouter } from "next/navigation";
import type { AdditionalService } from "./AdditionalServicesSelector";

type Props = {
  serviceId: number;
  serviceTitle: string;
  performerId: number;
  performerName: string;
  basePrice: number;
  baseDurationDays: number;
  selectedAdditionalServices: AdditionalService[];
};

type Chat = {
  id: number;
  serviceId: number;
  performerId: number;
  performerName: string;
  serviceTitle: string;
  createdAt: number;
  orderId?: number | null;
};

export default function CreateOrderButton({
  serviceId,
  serviceTitle,
  performerId,
  performerName,
  basePrice,
  baseDurationDays,
  selectedAdditionalServices,
}: Props) {
  const router = useRouter();

  const additionalTotal =
    selectedAdditionalServices.reduce(
      (sum, service) => sum + service.price,
      0
    );

  const additionalDays =
    selectedAdditionalServices.reduce(
      (sum, service) => sum + service.extraDays,
      0
    );

  const totalPrice =
    basePrice + additionalTotal;

  const totalDurationDays =
    baseDurationDays + additionalDays;

  const createOrder = () => {
    try {
      // -----------------------------
      // 1. Загружаем существующие заказы
      // -----------------------------

      const savedOrders =
        localStorage.getItem("studly-orders");

      const orders = savedOrders
        ? JSON.parse(savedOrders)
        : [];

      // -----------------------------
      // 2. Загружаем существующие чаты
      // -----------------------------

      const savedChats =
        localStorage.getItem("studly-chats");

      const chats: Chat[] = savedChats
        ? JSON.parse(savedChats)
        : [];

      // -----------------------------
      // 3. Создаём ID заказа
      // -----------------------------

      const orderId = Date.now();

      // -----------------------------
      // 4. Ищем существующий чат
      //
      // Один чат = один исполнитель + одна услуга
      // -----------------------------

      const existingChatIndex = chats.findIndex(
        (chat) =>
          chat.performerId === performerId &&
          chat.serviceId === serviceId
      );

      let chatId: number;

      if (existingChatIndex !== -1) {
        // -----------------------------
        // Существующий чат
        // -----------------------------

        const existingChat =
          chats[existingChatIndex];

        chatId = existingChat.id;

        chats[existingChatIndex] = {
          ...existingChat,
          orderId,
        };
      } else {
        // -----------------------------
        // Чата ещё нет — создаём его
        // -----------------------------

        chatId = Date.now() + 1;

        chats.push({
          id: chatId,
          serviceId,
          performerId,
          performerName,
          serviceTitle,
          createdAt: Date.now(),
          orderId,
        });
      }

      // -----------------------------
      // 5. Создаём заказ
      // -----------------------------

      const newOrder = {
        id: orderId,
        serviceId,
        serviceTitle,
        performerId,
        performerName,

        basePrice,
        totalPrice,

        baseDurationDays,
        totalDurationDays,

        additionalServices:
          selectedAdditionalServices,

        status: "PENDING",

        createdAt: Date.now(),

        // ВАЖНО:
        // заказ сразу связан с существующим чатом
        chatId,
      };

      // -----------------------------
      // 6. Сохраняем заказ
      // -----------------------------

      orders.push(newOrder);

      localStorage.setItem(
        "studly-orders",
        JSON.stringify(orders)
      );

      // -----------------------------
      // 7. Сохраняем чат
      // -----------------------------

      localStorage.setItem(
        "studly-chats",
        JSON.stringify(chats)
      );

      // -----------------------------
      // 8. Переходим в заказы
      // -----------------------------

      router.push("/orders");
    } catch (error) {
      console.error(
        "Не удалось создать заказ:",
        error
      );
    }
  };

  return (
    <div>
      <div
        style={{
          borderTop: "1px solid #E5E7EB",
          paddingTop: "16px",
          marginBottom: "12px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "6px",
          }}
        >
          <span>Основная услуга</span>

          <strong>
            {basePrice} ₽
          </strong>
        </div>

        {additionalTotal > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "6px",
            }}
          >
            <span>
              Дополнительные услуги
            </span>

            <strong>
              +{additionalTotal} ₽
            </strong>
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "12px",
            fontSize: "18px",
          }}
        >
          <strong>Итого</strong>

          <strong
            style={{
              color: "#3547B8",
            }}
          >
            {totalPrice} ₽
          </strong>
        </div>

        <p
          style={{
            marginTop: "8px",
            marginBottom: "0",
            color: "#6B7280",
            fontSize: "14px",
          }}
        >
          Срок: {totalDurationDays}{" "}
          {totalDurationDays === 1
            ? "день"
            : totalDurationDays < 5
            ? "дня"
            : "дней"}
        </p>
      </div>

      <button
        type="button"
        onClick={createOrder}
        style={{
          width: "100%",
          height: "52px",
          border: "none",
          borderRadius: "12px",
          background: "#3547B8",
          color: "#FFFFFF",
          fontWeight: 600,
          cursor: "pointer",
          marginBottom: "20px",
        }}
      >
        Оплатить {totalPrice} ₽
      </button>
    </div>
  );
}
