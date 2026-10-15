"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import BackButton from "@/components/BackButton";
import type { AdditionalService } from "@/components/AdditionalServicesSelector";

type Order = {
  id: number;
  serviceId: number;
  serviceTitle: string;
  performerId: number;
  performerName: string;

  basePrice: number;
  totalPrice: number;

  baseDurationDays: number;
  totalDurationDays: number;

  additionalServices: AdditionalService[];

  status:
    | "PENDING"
    | "IN_PROGRESS"
    | "REVIEW"
    | "COMPLETED";

  createdAt: number;
  chatId: number | null;
};

type Chat = {
  id: number;
  performerId: number;
  performerName: string;
  serviceId: number;
  serviceTitle: string;
  createdAt: number;
  orderId: number | null;
};

export default function OrderPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const id = params.id;

  const [order, setOrder] =
    useState<Order | null>(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    const saved =
      localStorage.getItem("studly-orders");

    if (!saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Finish the browser-only localStorage load after hydration.
      setLoading(false);
      return;
    }

    try {
      const orders: Order[] =
        JSON.parse(saved);

      const foundOrder = orders.find(
        (item) =>
          String(item.id) === String(id)
      );

      setOrder(foundOrder ?? null);
    } catch {
      setOrder(null);
    }

    setLoading(false);
  }, [id]);

  const updateStatus = (
    status: Order["status"]
  ) => {
    if (!order) return;

    const saved =
      localStorage.getItem("studly-orders");

    if (!saved) return;

    const orders: Order[] =
      JSON.parse(saved);

    const updatedOrders =
      orders.map((item) =>
        item.id === order.id
          ? {
              ...item,
              status,
            }
          : item
      );

    localStorage.setItem(
      "studly-orders",
      JSON.stringify(updatedOrders)
    );

    setOrder({
      ...order,
      status,
    });
  };

  const openChat = () => {
    if (!order) return;

    const parseArray = <T,>(
      key: string
    ): T[] => {
      try {
        const value =
          localStorage.getItem(key);

        const parsed: unknown = value
          ? JSON.parse(value)
          : [];

        return Array.isArray(parsed)
          ? (parsed as T[])
          : [];
      } catch {
        return [];
      }
    };

    const chats =
      parseArray<Chat>("studly-chats");

    const orders =
      parseArray<Order>("studly-orders");

    const currentOrder =
      orders.find(
        (item) => item.id === order.id
      ) ?? order;

    const existingChat =
      chats.find(
        (chat) =>
          chat.orderId === currentOrder.id
      ) ??
      chats.find(
        (chat) =>
          currentOrder.chatId !== null &&
          chat.id === currentOrder.chatId
      ) ??
      chats.find(
        (chat) =>
          chat.performerId === currentOrder.performerId &&
          chat.serviceId === currentOrder.serviceId
      );

    const chat: Chat = existingChat
      ? {
          ...existingChat,
          orderId: currentOrder.id,
        }
      : {
          id: Date.now(),
          performerId:
            currentOrder.performerId,
          performerName:
            currentOrder.performerName,
          serviceId:
            currentOrder.serviceId,
          serviceTitle:
            currentOrder.serviceTitle,
          createdAt: Date.now(),
          orderId: currentOrder.id,
        };

    const updatedChats =
      existingChat
        ? chats.map((item) =>
            item.id === chat.id
              ? chat
              : item
          )
        : [...chats, chat];

    const updatedOrders =
      orders.map((item) =>
        item.id === currentOrder.id
          ? {
              ...item,
              chatId: chat.id,
            }
          : item
      );

    localStorage.setItem(
      "studly-chats",
      JSON.stringify(updatedChats)
    );

    localStorage.setItem(
      "studly-orders",
      JSON.stringify(updatedOrders)
    );

    setOrder({
      ...currentOrder,
      chatId: chat.id,
    });

    router.push(
      `/chats/${chat.id}`
    );
  };

  if (loading) {
    return (
      <div>
        <BackButton />

        <p>
          Загрузка заказа...
        </p>
      </div>
    );
  }

  if (!order) {
    return (
      <div>
        <BackButton />

        <h1>
          Заказ не найден
        </h1>

        <p>
          Такой заказ не найден в системе.
        </p>
      </div>
    );
  }

  const statusLabels = {
    PENDING: "🟡 Ожидает",
    IN_PROGRESS: "🔵 В работе",
    REVIEW: "🟣 На рассмотрении",
    COMPLETED: "🟢 Завершён",
  };

  return (
    <div>
      <BackButton />

      <h1>
        {order.serviceTitle}
      </h1>

      <p>
        Исполнитель:{" "}
        {order.performerName}
      </p>

      <div
        style={{
          border: "1px solid #E5E7EB",
          borderRadius: "12px",
          padding: "14px",
          marginTop: "20px",
          marginBottom: "16px",
        }}
      >
        <strong>
          Состав заказа
        </strong>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "12px",
          }}
        >
          <span>
            Основная услуга
          </span>

          <span>
            {order.basePrice} ₽
          </span>
        </div>

        {order.additionalServices?.map(
          (service) => (
            <div
              key={service.id}
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                gap: "12px",
                marginTop: "8px",
                color: "#4B5563",
              }}
            >
              <span>
                {service.title}
              </span>

              <span>
                +{service.price} ₽
              </span>
            </div>
          )
        )}

        <div
          style={{
            borderTop:
              "1px solid #E5E7EB",
            marginTop: "12px",
            paddingTop: "12px",
            display: "flex",
            justifyContent:
              "space-between",
            fontSize: "18px",
          }}
        >
          <strong>
            Итого
          </strong>

          <strong
            style={{
              color: "#3547B8",
            }}
          >
            {order.totalPrice} ₽
          </strong>
        </div>

        <p
          style={{
            marginBottom: "0",
            color: "#6B7280",
            fontSize: "14px",
          }}
        >
          Срок:{" "}
          {order.totalDurationDays}{" "}
          {order.totalDurationDays === 1
            ? "день"
            : order.totalDurationDays <
              5
            ? "дня"
            : "дней"}
        </p>
      </div>

      <p>
        Статус:{" "}
        {statusLabels[order.status]}
      </p>

      <button
        onClick={openChat}
        style={{
          width: "100%",
          height: "52px",
          border: "none",
          borderRadius: "12px",
          background: "#3547B8",
          color: "#FFFFFF",
          fontWeight: 600,
          cursor: "pointer",
          marginTop: "20px",
          marginBottom: "12px",
        }}
      >
        Открыть чат
      </button>

      {order.status === "PENDING" && (
        <button
          onClick={() =>
            updateStatus("IN_PROGRESS")
          }
          style={{
            width: "100%",
            height: "52px",
            border:
              "1px solid #3547B8",
            borderRadius: "12px",
            background: "#FFFFFF",
            color: "#3547B8",
            fontWeight: 600,
            cursor: "pointer",
            marginBottom: "12px",
          }}
        >
          Принять заказ
        </button>
      )}

      {order.status === "IN_PROGRESS" && (
        <button
          onClick={() =>
            updateStatus("REVIEW")
          }
          style={{
            width: "100%",
            height: "52px",
            border:
              "1px solid #3547B8",
            borderRadius: "12px",
            background: "#FFFFFF",
            color: "#3547B8",
            fontWeight: 600,
            cursor: "pointer",
            marginBottom: "12px",
          }}
        >
          Работа выполнена
        </button>
      )}

      {order.status === "REVIEW" && (
        <button
          onClick={() =>
            updateStatus("COMPLETED")
          }
          style={{
            width: "100%",
            height: "52px",
            border: "none",
            borderRadius: "12px",
            background: "#1B8A5A",
            color: "#FFFFFF",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Всё в порядке
        </button>
      )}

      {order.status === "COMPLETED" && (
        <button
          onClick={() => {
            const saved =
              localStorage.getItem(
                "studly-orders"
              );

            if (!saved) return;

            const orders: Order[] =
              JSON.parse(saved);

            const updatedOrders =
              orders.filter(
                (item) =>
                  item.id !== order.id
              );

            localStorage.setItem(
              "studly-orders",
              JSON.stringify(
                updatedOrders
              )
            );

            router.push("/orders");
          }}
          style={{
            width: "100%",
            height: "52px",
            border:
              "1px solid #DC2626",
            borderRadius: "12px",
            background: "#FFFFFF",
            color: "#DC2626",
            fontWeight: 600,
            cursor: "pointer",
            marginTop: "12px",
          }}
        >
          Удалить заказ
        </button>
      )}
    </div>
  );
}
