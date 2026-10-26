"use client";
import { useOptionalDemoWorkspace } from "@/features/demo-workspace/Provider";
import { OrderRoute } from "@/features/demo-workspace/Routing";
import { demoMode } from "@/lib/data-mode";
import { LiveOrderDetail } from "@/features/live-commerce";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import BackButton from "@/components/BackButton";
import { DemoOrderStatus, demoPerformerName, demoPerformerInitial } from "@/components/studly/DemoOrderPresentation";
import { Icon } from "@/components/studly/Icon";
import "@/components/studly/activity.css";
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
  return demoMode ? <DemoOrderPage /> : <LiveOrderDetail id={params.id} />;
}
function DemoOrderPage() {
  const workspace = useOptionalDemoWorkspace();
  const canonical = workspace !== null;
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const id = params.id;

  const [order, setOrder] =
    useState<Order | null>(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    const saved =
      demoMode && !canonical ? localStorage.getItem("studly-orders") : null;

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
  }, [id, canonical]);

  const updateStatus = (
    status: Order["status"]
  ) => {
    if (!order) return;

    const saved =
      demoMode && !canonical ? localStorage.getItem("studly-orders") : null;

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

  if (workspace) return <OrderRoute id={String(id)}/>;

  if (loading) {
    return <div className="activity-page"><BackButton /><div className="activity-empty" role="status" aria-busy="true"><span className="activity-empty-icon"><Icon name="book" /></span><h1>Загрузка заказа…</h1><p>Открываем состав и ход работы.</p></div></div>;
  }

  if (!order) {
    return <div className="activity-page"><BackButton /><div className="activity-empty"><span className="activity-empty-icon"><Icon name="book" /></span><h1>Заказ не найден</h1><p>Такой заказ не найден в системе.</p></div></div>;
  }

  return (
    <div className="activity-page">
      <BackButton />
      <header className="activity-header">
        <div><p className="activity-kicker">Заказ № {order.id}</p><h1>{order.serviceTitle}</h1><div className="activity-person"><span className="activity-avatar" aria-hidden="true">{demoPerformerInitial(order.performerName)}</span><div><small>Исполнитель</small><strong>{demoPerformerName(order.performerName)}</strong></div></div></div>
      </header>
      <div className="activity-order-layout">
        <section className="activity-panel" aria-labelledby="order-composition-title">
          <h2 id="order-composition-title">Состав заказа</h2>
          <div className="activity-line-item"><span>Основная услуга</span><strong>{order.basePrice} ₽</strong></div>
          {order.additionalServices?.map((service) => <div key={service.id} className="activity-line-item"><span>{service.title}</span><span>+{service.price} ₽</span></div>)}
          <div className="activity-line-item activity-line-item--total"><strong>Итого</strong><strong>{order.totalPrice} ₽</strong></div>
          <p className="activity-duration"><Icon name="clock" />Срок: {order.totalDurationDays} {order.totalDurationDays === 1 ? "день" : order.totalDurationDays < 5 ? "дня" : "дней"}</p>
        </section>
        <section className="activity-panel" aria-labelledby="order-progress-title">
          <h2 id="order-progress-title">Ход работы</h2>
          <DemoOrderStatus status={order.status} />
          <div className="activity-action-stack">
            <button type="button" onClick={openChat} className="primary-btn"><Icon name="chat" />Открыть чат</button>
            {order.status === "PENDING" && <button type="button" onClick={() => updateStatus("IN_PROGRESS")} className="secondary-btn">Принять заказ</button>}
            {order.status === "IN_PROGRESS" && <button type="button" onClick={() => updateStatus("REVIEW")} className="secondary-btn">Работа выполнена</button>}
            {order.status === "REVIEW" && <button type="button" onClick={() => updateStatus("COMPLETED")} className="secondary-btn">Всё в порядке</button>}
            {order.status === "COMPLETED" && <button type="button" onClick={() => {
              const saved = localStorage.getItem("studly-orders");
              if (!saved) return;
              const orders: Order[] = JSON.parse(saved);
              const updatedOrders = orders.filter((item) => item.id !== order.id);
              localStorage.setItem("studly-orders", JSON.stringify(updatedOrders));
              router.push("/orders");
            }} className="activity-danger">Удалить заказ</button>}
          </div>
          {demoMode && <p className="activity-note">Локальный демо-пример. Изменения сохраняются в этом браузере, реальные платежи не выполняются.</p>}
        </section>
      </div>
    </div>
  );
}
