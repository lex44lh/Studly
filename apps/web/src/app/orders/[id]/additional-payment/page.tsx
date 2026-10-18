"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

type AdditionalService = {
  id: string;
  title: string;
  price: number;
  extraDays: number;
};

type Order = {
  id: number;
  totalPrice: number;
  totalDurationDays: number;
  additionalServices?: AdditionalService[];
};

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

export default function AdditionalPaymentPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const orderId = Number(params.id);
  const chatId =
    searchParams.get("chatId");

  const serviceId =
    searchParams.get("serviceId");

  const [paying, setPaying] =
    useState(false);

  const additionalService =
    availableAdditionalServices.find(
      (service) =>
        service.id === serviceId
    );

  if (!additionalService) {
    return (
      <div
        style={{
          padding: "20px",
        }}
      >
        <h1>
          Дополнительная услуга не найдена
        </h1>

        <button
          type="button"
          onClick={() => router.back()}
          style={{
            width: "100%",
            height: "48px",
            border: "none",
            borderRadius: "12px",
            background: "#3547B8",
            color: "#FFFFFF",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Вернуться
        </button>
      </div>
    );
  }

  const paymentAvailable = false;
  const pay = () => {
    if (!paymentAvailable) return;
    if (paying) return;

    setPaying(true);

    try {
      const savedOrders =
        localStorage.getItem(
          "studly-orders"
        );

      const orders: Order[] = savedOrders
        ? JSON.parse(savedOrders)
        : [];

      const order =
        orders.find(
          (item) =>
            item.id === orderId
        );

      if (!order) {
        window.alert(
          "Заказ не найден."
        );

        setPaying(false);
        return;
      }

      const existingServices =
        order.additionalServices ?? [];

      const alreadyAdded =
        existingServices.some(
          (item) =>
            item.id ===
            additionalService.id
        );

      if (alreadyAdded) {
        router.push(
          chatId
            ? `/chats/${chatId}`
            : `/orders/${orderId}`
        );

        return;
      }

      /*
       * MOCK PAYMENT
       *
       * В будущем здесь будет
       * реальная платёжная система.
       *
       * Пока считаем оплату успешной.
       */

      const updatedOrder: Order = {
        ...order,

        additionalServices: [
          ...existingServices,
          additionalService,
        ],

        totalPrice:
          order.totalPrice +
          additionalService.price,

        totalDurationDays:
          order.totalDurationDays +
          additionalService.extraDays,
      };

      const updatedOrders =
        orders.map((item) =>
          item.id === order.id
            ? updatedOrder
            : item
        );

      localStorage.setItem(
        "studly-orders",
        JSON.stringify(updatedOrders)
      );

      if (chatId) {
        const messagesKey =
          `studly-chat-messages-${chatId}`;

        const savedMessages =
          localStorage.getItem(
            messagesKey
          );

        const messages =
          savedMessages
            ? JSON.parse(savedMessages)
            : [];

        const newMessage = {
          id: Date.now(),
          text:
            `📦 Дополнительная услуга заказана: ` +
            `${additionalService.title} — ` +
            `${additionalService.price} ₽`,
          mine: true,
          time:
            new Date().toLocaleTimeString(
              "ru-RU",
              {
                hour: "2-digit",
                minute: "2-digit",
              }
            ),
        };

        localStorage.setItem(
          messagesKey,
          JSON.stringify([
            ...messages,
            newMessage,
          ])
        );
      }

      router.push(
        chatId
          ? `/chats/${chatId}`
          : `/orders/${orderId}`
      );
    } catch {
      setPaying(false);

      window.alert(
        "Не удалось выполнить оплату. " +
          "Попробуйте ещё раз."
      );
    }
  };

  return (
    <div
      style={{
        maxWidth: "520px",
        margin: "0 auto",
      }}
    >
      <h1
        style={{
          fontSize: "24px",
          marginBottom: "20px",
        }}
      >
        Оплата дополнительной услуги
      </h1>

      <div
        style={{
          border: "1px solid #E5E7EB",
          borderRadius: "14px",
          padding: "16px",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            fontSize: "18px",
            fontWeight: 600,
            marginBottom: "8px",
          }}
        >
          {additionalService.title}
        </div>

        <div
          style={{
            color: "#6B7280",
            fontSize: "14px",
          }}
        >
          Срок:{" "}
          {additionalService.extraDays > 0
            ? `+${additionalService.extraDays} день`
            : "без изменения"}
        </div>
      </div>

      <div
        style={{
          borderTop:
            "1px solid #E5E7EB",
          paddingTop: "16px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            marginBottom: "10px",
          }}
        >
          <span>
            Дополнительная услуга
          </span>

          <strong>
            {additionalService.price} ₽
          </strong>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            fontSize: "18px",
          }}
        >
          <strong>
            Итого к оплате
          </strong>

          <strong
            style={{
              color: "#3547B8",
            }}
          >
            {additionalService.price} ₽
          </strong>
        </div>
      </div>

      <button
        type="button"
        onClick={pay}
        disabled={!paymentAvailable || paying}
        style={{
          width: "100%",
          height: "52px",
          border: "none",
          borderRadius: "12px",
          background: "#3547B8",
          color: "#FFFFFF",
          fontWeight: 600,
          cursor: paying
            ? "not-allowed"
            : "pointer",
          opacity: paying ? 0.7 : 1,
        }}
      >
        {paying
          ? "Обработка оплаты..."
          : "Оплата отключена в предпросмотре"}
      </button>

      <button
        type="button"
        onClick={() => router.back()}
        disabled={paying}
        style={{
          width: "100%",
          height: "48px",
          border: "1px solid #E5E7EB",
          borderRadius: "12px",
          background: "#FFFFFF",
          color: "#374151",
          fontWeight: 600,
          cursor: paying
            ? "not-allowed"
            : "pointer",
          marginTop: "10px",
        }}
      >
        Отмена
      </button>
    </div>
  );
}
