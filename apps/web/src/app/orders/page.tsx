"use client";
import { useOptionalDemoWorkspace } from "@/features/demo-workspace/Provider";
import { OrdersRoute } from "@/features/demo-workspace/Routing";
import { demoMode } from "@/lib/data-mode";
import { LiveOrders } from "@/features/live-commerce";
import { initialOrderRole } from "@/features/live-commerce/protocol";
import { LiveState } from "@/features/live/shared";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BackButton from "@/components/BackButton";
import { DemoOrderStatus, demoPerformerName } from "@/components/studly/DemoOrderPresentation";
import { Icon } from "@/components/studly/Icon";
import "@/components/studly/activity.css";

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

export default function OrdersPage() { return demoMode ? <DemoOrdersPage /> : <Suspense fallback={<LiveState loading />}><LiveOrdersQuery /></Suspense>; }
function LiveOrdersQuery() {
  const parameters = useSearchParams();
  const role = initialOrderRole(parameters.get("role"));
  return <LiveOrders key={role} initialRole={role} />;
}
function DemoOrdersPage() {
  const workspace = useOptionalDemoWorkspace();
  const canonical = workspace !== null;
  const router = useRouter();

  const [orders, setOrders] =
    useState<Order[]>([]);

  useEffect(() => {
    const saved =
      demoMode && !canonical ? localStorage.getItem("studly-orders") : null;

    if (saved) {
      try {
        const parsed: unknown = JSON.parse(saved);

        // eslint-disable-next-line react-hooks/set-state-in-effect -- Load browser-persisted orders after hydration.
        setOrders(Array.isArray(parsed) ? parsed as Order[] : []);
      } catch {
        // Ignore malformed local order data instead of breaking the page.
      }
    }
  }, [canonical]);

  if (workspace) return <OrdersRoute/>;

  return (
    <div className="activity-page">
      <BackButton />
      <header className="activity-header">
        <div><p className="activity-kicker">Мой кампус</p><h1>Заказы</h1><p className="activity-intro">Услуги, сроки и ход работы — в одном месте.</p></div>
        {orders.length > 0 && <div className="activity-count" aria-label={`Всего заказов: ${orders.length}`}>{orders.length}<small>всего</small></div>}
      </header>
      {orders.length === 0 ? (
        <div className="activity-empty"><span className="activity-empty-icon"><Icon name="book" /></span><h2>Пока нет заказов</h2><p>Здесь появятся Ваши заказы и информация о ходе работы.</p></div>
      ) : (
        <div className="activity-list">
          {orders.map((order) => (
            <button key={order.id} type="button" className="activity-card activity-card-link" onClick={() => router.push(`/orders/${order.id}`)}>
              <div className="activity-row">
                <div className="activity-card-main">
                  <h2>{order.serviceTitle}</h2>
                  <p>Исполнитель: {demoPerformerName(order.performerName)}</p>
                  <div className="activity-card-meta"><DemoOrderStatus status={order.status} /><span>Заказ № {order.id}</span></div>
                </div>
                <span className="activity-card-arrow"><Icon name="arrow" /></span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
