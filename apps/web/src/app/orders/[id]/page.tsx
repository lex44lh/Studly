"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import BackButton from "@/components/BackButton";

type Order = {
  id: number;
  serviceId: number;
  serviceTitle: string;
  performerId: number;
  performerName: string;
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
      setLoading(false);
      return;
    }

    const orders: Order[] =
      JSON.parse(saved);

    const foundOrder = orders.find(
      (item) =>
        String(item.id) === String(id)
    );

    setOrder(foundOrder ?? null);
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

    const saved =
      localStorage.getItem("studly-chats");

    const chats: Chat[] = saved
      ? JSON.parse(saved)
      : [];

    const existingChat =
  chats.find(
    (chat) =>
      chat.orderId === order.id
  );

    if (existingChat) {
      router.push(
        `/chats/${existingChat.id}`
      );
      return;
    }

    const newChat: Chat = {
  id: Date.now(),
  performerId: order.performerId,
  performerName: order.performerName,
  serviceId: order.serviceId,
  serviceTitle: order.serviceTitle,
  createdAt: Date.now(),
  orderId: order.id,
};

    chats.push(newChat);
const savedOrders =
  localStorage.getItem(
    "studly-orders"
  );

if (savedOrders) {
  const orders: Order[] =
    JSON.parse(savedOrders);

  const updatedOrders =
    orders.map((item) =>
      item.id === order.id
        ? {
            ...item,
            chatId: newChat.id,
          }
        : item
    );

  localStorage.setItem(
    "studly-orders",
    JSON.stringify(updatedOrders)
  );
}
    localStorage.setItem(
      "studly-chats",
      JSON.stringify(chats)
    );

    router.push(
      `/chats/${newChat.id}`
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
    border: "1px solid #3547B8",
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
    border: "1px solid #3547B8",
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
        localStorage.getItem("studly-orders");

      if (!saved) return;

      const orders: Order[] =
        JSON.parse(saved);

      const updatedOrders =
        orders.filter(
          (item) => item.id !== order.id
        );

      localStorage.setItem(
        "studly-orders",
        JSON.stringify(updatedOrders)
      );

      router.push("/orders");
    }}
    style={{
      width: "100%",
      height: "52px",
      border: "1px solid #DC2626",
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
