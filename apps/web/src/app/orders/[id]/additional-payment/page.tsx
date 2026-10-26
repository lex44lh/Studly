"use client";
import { demoMode } from "@/lib/data-mode";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import BackButton from "@/components/BackButton";
import { Icon } from "@/components/studly/Icon";
import "@/components/studly/activity.css";

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
  return demoMode ? <DemoAdditionalPaymentPage /> : <div className="activity-page"><BackButton /><header className="activity-header"><h1>Дополнительная оплата</h1></header><section className="activity-panel"><h2>Оплата пока недоступна</h2><p>Сервер не поддерживает оплату дополнений к существующему заказу. Финансовые операции не выполняются.</p></section></div>;
}
function DemoAdditionalPaymentPage() {
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
    return <div className="activity-page activity-page--narrow"><BackButton /><div className="activity-empty"><span className="activity-empty-icon"><Icon name="book" /></span><h1>Дополнительная услуга не найдена</h1><button type="button" onClick={() => router.back()} className="primary-btn">Вернуться</button></div></div>;
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
    <div className="activity-page activity-page--narrow">
      <BackButton />
      <header className="activity-header"><div><p className="activity-kicker">Детали заказа</p><h1>Дополнительная услуга</h1><p className="activity-intro">Проверьте стоимость и изменение срока.</p></div></header>
      <section className="activity-panel" aria-labelledby="additional-service-title">
        <h2 id="additional-service-title">{additionalService.title}</h2>
        <p className="activity-duration"><Icon name="clock" />Срок: {additionalService.extraDays > 0 ? `+${additionalService.extraDays} день` : "без изменения"}</p>
        <div className="activity-line-item"><span>Дополнительная услуга</span><strong>{additionalService.price} ₽</strong></div>
        <div className="activity-line-item activity-line-item--total"><strong>Итого к оплате</strong><strong>{additionalService.price} ₽</strong></div>
        <p className="activity-note" role="note">Оплата в предпросмотре отключена. Деньги не списываются, состав заказа не изменяется.</p>
        <div className="activity-action-stack">
          <button type="button" onClick={pay} disabled={!paymentAvailable || paying} className="primary-btn">{paying ? "Обработка оплаты..." : "Оплата отключена в предпросмотре"}</button>
          <button type="button" onClick={() => router.back()} disabled={paying} className="secondary-btn">Отмена</button>
        </div>
      </section>
    </div>
  );
}
