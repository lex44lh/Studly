"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

type Message = {
  id: number;
  text: string;
  mine: boolean;
  time: string;
};

type Props = {
  chatId: string;
  user: string;
  service: string;
  orderId?: number | null;
};
type Order = {
  id: number;
  serviceTitle: string;
  status:
    | "PENDING"
    | "IN_PROGRESS"
    | "REVIEW"
    | "COMPLETED";
};
export default function ChatWindow({
  chatId,
  user,
  service,
  orderId,
}: Props) {
  const [message, setMessage] = useState("");
  const fileInputRef =
  useRef<HTMLInputElement>(null);

  const [messages, setMessages] =
    useState<Message[]>([]);
    const [order, setOrder] =
  useState<Order | null>(null);

  const [loaded, setLoaded] =
    useState(false);
const messagesEndRef =
  useRef<HTMLDivElement>(null);
  useEffect(() => {
    const saved = localStorage.getItem(
      `studly-chat-messages-${chatId}`
    );

    if (saved) {
      setMessages(JSON.parse(saved));
    } else {
      setMessages([]);
    }

    setLoaded(true);
  }, [chatId]);
useEffect(() => {
  if (!orderId) return;

  const saved =
    localStorage.getItem(
      "studly-orders"
    );

  if (!saved) return;

  const orders =
    JSON.parse(saved);

  const foundOrder =
    orders.find(
      (item: any) =>
        item.id === orderId
    );

  setOrder(foundOrder || null);
}, [orderId]);
  useEffect(() => {
    if (!loaded) return;

    localStorage.setItem(
      `studly-chat-messages-${chatId}`,
      JSON.stringify(messages)
    );
  }, [messages, chatId, loaded]);
useEffect(() => {
  messagesEndRef.current?.scrollIntoView({
    behavior: "smooth",
  });
}, [messages]);
  const sendMessage = () => {
    if (!message.trim()) return;

    const newMessage: Message = {
  id: Date.now(),
  text: message.trim(),
  mine: true,
  time: new Date().toLocaleTimeString(
    "ru-RU",
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  ),
};

    setMessages((prev) => [
      ...prev,
      newMessage,
    ]);

    setMessage("");
  };
const statusLabels = {
  PENDING: "🟡 Ожидает",
  IN_PROGRESS: "🔵 В работе",
  REVIEW: "🟣 На рассмотрении",
  COMPLETED: "🟢 Завершён",
};
  return (
    <div
      style={{
        height: "calc(100vh - 140px)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          borderBottom:
            "1px solid #E5E7EB",
          paddingBottom: "12px",
          marginBottom: "20px",
        }}
      >
        <h2
          style={{
            marginBottom: "4px",
          }}
        >
          {user}
        </h2>

        <p
          style={{
            margin: 0,
            color: "#3547B8",
            fontSize: "14px",
          }}
        >
          {service}
        </p>
      </div>
{order && (
  <div
    style={{
      border: "1px solid #E5E7EB",
      borderRadius: "12px",
      padding: "12px",
      marginBottom: "16px",
      background: "#F9FAFB",
    }}
  >
    <strong>
      📦 {order.serviceTitle}
    </strong>

    <p
      style={{
        marginTop: "8px",
        marginBottom: 0,
      }}
    >
      Статус: {statusLabels[order.status]}
    </p>
  </div>
)}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {messages.length === 0 ? (
  <p
    style={{
      textAlign: "center",
      color: "#9CA3AF",
      marginTop: "40px",
    }}
  >
    Начните переписку
  </p>
) : (
  <>
    {messages.map((msg) => (
      <div
        key={msg.id}
        style={{
          alignSelf: msg.mine
            ? "flex-end"
            : "flex-start",
          background: msg.mine
            ? "#3547B8"
            : "#F3F4F6",
          color: msg.mine
            ? "#FFFFFF"
            : "#111827",
          padding: "12px",
          borderRadius: "12px",
          maxWidth: "80%",
        }}
      >
        <div>{msg.text}</div>

        <div
          style={{
            fontSize: "11px",
            marginTop: "6px",
            opacity: 0.7,
            textAlign: "right",
          }}
        >
          {msg.time}
        </div>
      </div>
    ))}

    <div ref={messagesEndRef} />
  </>
)}
      </div>

      <div
        style={{
          display: "flex",
          gap: "8px",
          borderTop:
            "1px solid #E5E7EB",
          paddingTop: "12px",
          marginTop: "12px",
        }}
      >
        <input
          value={message}
          onChange={(e) =>
            setMessage(e.target.value)
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              sendMessage();
            }
          }}
          placeholder="Введите сообщение..."
          style={{
            flex: 1,
            height: "48px",
            border:
              "1px solid #E5E7EB",
            borderRadius: "12px",
            padding: "0 12px",
            outline: "none",
          }}
        />
<button
  type="button"
  onClick={() =>
    fileInputRef.current?.click()
  }
  style={{
    width: "48px",
    border: "1px solid #E5E7EB",
    borderRadius: "12px",
    background: "#FFFFFF",
    cursor: "pointer",
    fontSize: "20px",
  }}
>
  📎
</button>
<input
  ref={fileInputRef}
  type="file"
  hidden
  onChange={(e) => {
    const file =
      e.target.files?.[0];

    if (!file) return;

    const newMessage = {
      id: Date.now(),
      text: `📎 ${file.name}`,
      mine: true,
      time: new Date().toLocaleTimeString(
        "ru-RU",
        {
          hour: "2-digit",
          minute: "2-digit",
        }
      ),
    };

    setMessages((prev) => [
      ...prev,
      newMessage,
    ]);
  }}
/>
        <button
  type="button"
  onClick={sendMessage}
  disabled={!message.trim()}
          style={{
            width: "60px",
            border: "none",
            borderRadius: "12px",
            background: "#3547B8",
            color: "#FFFFFF",
            cursor:
  message.trim()
    ? "pointer"
    : "not-allowed",

opacity:
  message.trim()
    ? 1
    : 0.5,
          }}
        >
          ➤
        </button>
      </div>
    </div>
  );
}
