"use client";
import { demoMode } from "@/lib/data-mode";

import BackButton from "@/components/BackButton";
import { Icon } from "@/components/studly/Icon";
import "@/components/studly/activity.css";

type NotificationItem = {
  id: number;
  title: string;
  text: string;
  time: string;
  unread: boolean;
};

const notifications: NotificationItem[] = [
  {
    id: 1,
    title: "Заказ принят",
    text: "Исполнитель принял Ваш заказ и приступил к работе.",
    time: "Сегодня, 14:32",
    unread: true,
  },
  {
    id: 2,
    title: "Работа выполнена",
    text: "Исполнитель отправил результат по Вашему заказу.",
    time: "Вчера, 18:20",
    unread: false,
  },
  {
    id: 3,
    title: "Дополнительная услуга",
    text: "В заказ добавлена дополнительная услуга.",
    time: "Вчера, 16:05",
    unread: false,
  },
];

export default function NotificationsPage() {
  const visibleNotifications = demoMode ? notifications : [];
  return (
    <div className="activity-page activity-page--narrow">
      <BackButton />
      <header className="activity-header"><div><p className="activity-kicker">События кампуса</p><h1>Уведомления</h1><p className="activity-intro">Важные обновления о Ваших заказах.</p></div></header>
      {visibleNotifications.length === 0 ? (
        <div className="activity-empty"><span className="activity-empty-icon"><Icon name="bell" /></span><h2>Пока тихо</h2><p>У Вас пока нет уведомлений. Новые события появятся здесь.</p></div>
      ) : (
        <div className="activity-list">
          {visibleNotifications.map((notification) => (
            <article key={notification.id} className={`activity-card activity-notification${notification.unread ? " is-unread" : ""}`}>
              <span className="activity-notification-icon"><Icon name={notification.id === 3 ? "book" : "bell"} /></span>
              <div className="activity-card-main">
                <div className="activity-row"><h2>{notification.title}{notification.unread && <><span className="activity-unread-dot" aria-hidden="true" /><span className="sr-only">, непрочитано</span></>}</h2><time className="activity-timestamp">{notification.time}</time></div>
                <p>{notification.text}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
