"use client";
import { demoMode } from "@/lib/data-mode";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BackButton from "@/components/BackButton";

type Order = {
  id: number;
  serviceId: number;
  serviceTitle: string;
  performerName: string;
  status:
    | "PENDING"
    | "IN_PROGRESS"
    | "REVIEW"
    | "COMPLETED";
  createdAt: number;
};

export default function OrdersPage() {
  const router = useRouter();

  const [orders, setOrders] =
    useState<Order[]>([]);

  useEffect(() => {
    const saved =
      demoMode ? localStorage.getItem("studly-orders") : null;

    if (saved) {
      try {
        const parsed: unknown = JSON.parse(saved);

        // eslint-disable-next-line react-hooks/set-state-in-effect -- Load browser-persisted orders after hydration.
        setOrders(Array.isArray(parsed) ? parsed as Order[] : []);
      } catch {
        // Ignore malformed local order data instead of breaking the page.
      }
    }
  }, []);

  return (
    <div>
      <BackButton />

      <h1>Заказы</h1>

      {orders.length === 0 ? (
        <p>У Вас пока нет заказов</p>
      ) : (
        orders.map((order) => (
          <div
            key={order.id}
            onClick={() =>
              router.push(
                `/orders/${order.id}`
              )
            }
            style={{
              border: "1px solid #E5E7EB",
              borderRadius: "16px",
              padding: "16px",
              marginBottom: "12px",
              cursor: "pointer",
              background: "#FFFFFF",
            }}
          >
            <h3>{order.serviceTitle}</h3>

            <p>
              Исполнитель:{" "}
              {order.performerName}
            </p>

            <p>
              Статус:{" "}
              {order.status === "PENDING" &&
                "🟡 Ожидает"}

              {order.status ===
                "IN_PROGRESS" &&
                "🔵 В работе"}

              {order.status === "REVIEW" &&
                "🟣 На рассмотрении"}

              {order.status ===
                "COMPLETED" &&
                "🟢 Завершён"}
            </p>
          </div>
        ))
      )}
    </div>
  );
}
