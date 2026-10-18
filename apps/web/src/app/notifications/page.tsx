"use client";
import { demoMode } from "@/lib/data-mode";

import BackButton from "@/components/BackButton";

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
    <div>
      <BackButton />

      <h1
        style={{
          marginTop: "16px",
          marginBottom: "20px",
        }}
      >
        Уведомления
      </h1>

      {visibleNotifications.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding:
              "60px 20px",
            color: "#6B7280",
          }}
        >
          <div
            style={{
              fontSize: "40px",
              marginBottom:
                "12px",
            }}
          >
            🔔
          </div>

          <p
            style={{
              margin: 0,
            }}
          >
            У Вас пока нет
            уведомлений
          </p>
        </div>
      ) : (
        <div>
          {visibleNotifications.map(
            (notification) => (
              <div
                key={
                  notification.id
                }
                style={{
                  borderBottom:
                    "1px solid #E5E7EB",
                  padding:
                    "16px 4px",
                  display: "flex",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius:
                      "50%",
                    background:
                      notification.unread
                        ? "#3547B8"
                        : "transparent",
                    marginTop:
                      "6px",
                    flexShrink: 0,
                  }}
                />

                <div
                  style={{
                    flex: 1,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      gap: "12px",
                    }}
                  >
                    <strong>
                      {
                        notification.title
                      }
                    </strong>

                    <span
                      style={{
                        fontSize:
                          "12px",
                        color:
                          "#9CA3AF",
                        whiteSpace:
                          "nowrap",
                      }}
                    >
                      {
                        notification.time
                      }
                    </span>
                  </div>

                  <p
                    style={{
                      margin:
                        "6px 0 0",
                      color:
                        "#6B7280",
                      fontSize:
                        "14px",
                      lineHeight:
                        1.4,
                    }}
                  >
                    {
                      notification.text
                    }
                  </p>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
