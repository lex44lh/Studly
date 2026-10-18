"use client";
import { demoMode } from "@/lib/data-mode";

import BackButton from "@/components/BackButton";
import Link from "next/link";
import { useEffect, useState } from "react";

type Chat = {
  id: number;
  performerId: number;
  performerName: string;
  serviceTitle: string;
  createdAt: number;
};

type Message = {
  id: number;
  text: string;
  mine: boolean;
};

type ChatWithLastMessage = Chat & {
  lastMessage: string;
  lastMessageTime: number;
};

export default function ChatsPage() {
  const [chats, setChats] = useState<ChatWithLastMessage[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const loadChats = () => {
      const saved = demoMode ? localStorage.getItem("studly-chats") : null;

      if (!saved) {
        setChats([]);
        setLoaded(true);
        return;
      }

      try {
        const storedChats: Chat[] = JSON.parse(saved);

        const chatsWithMessages =
          storedChats.map((chat) => {
            const messagesKey =
              `studly-chat-messages-${chat.id}`;

            const savedMessages =
              localStorage.getItem(messagesKey);

            let messages: Message[] = [];

            if (savedMessages) {
              try {
                messages = JSON.parse(savedMessages);
              } catch {
                messages = [];
              }
            }

            const lastMessage =
              messages.length > 0
                ? messages[messages.length - 1]
                : null;

            return {
              ...chat,
              lastMessage:
                lastMessage?.text ??
                "Напишите первое сообщение",
              lastMessageTime:
                lastMessage?.id ??
                chat.createdAt,
            };
          });

        chatsWithMessages.sort(
          (a, b) =>
            b.lastMessageTime -
            a.lastMessageTime
        );

        setChats(chatsWithMessages);
      } catch {
        setChats([]);
      }

      setLoaded(true);
    };

    loadChats();
  }, []);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);

    const now = new Date();

    const sameDay =
      date.toDateString() ===
      now.toDateString();

    if (sameDay) {
      return date.toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    return date.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
    });
  };

  return (
    <div>
      <BackButton />

      <h1>Чаты</h1>

      {!loaded ? (
        <p>Загрузка...</p>
      ) : chats.length === 0 ? (
        <p
          style={{
            color: "#6B7280",
            marginTop: "24px",
          }}
        >
          У Вас пока нет чатов
        </p>
      ) : (
        chats.map((chat) => (
          <Link
            key={chat.id}
            href={`/chats/${chat.id}`}
            style={{
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div
              style={{
                border: "1px solid #E5E7EB",
                borderRadius: "16px",
                padding: "16px",
                marginBottom: "12px",
                display: "flex",
                gap: "12px",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  background: "#E5E7EB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                  flexShrink: 0,
                }}
              >
                👤
              </div>

              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <strong>
                    {chat.performerName}
                  </strong>

                  <span
                    style={{
                      fontSize: "12px",
                      color: "#9CA3AF",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatTime(
                      chat.lastMessageTime
                    )}
                  </span>
                </div>

                <p
                  style={{
                    margin: "4px 0",
                    fontSize: "13px",
                    color: "#3547B8",
                  }}
                >
                  {chat.serviceTitle}
                </p>

                <p
                  style={{
                    margin: 0,
                    fontSize: "14px",
                    color: "#6B7280",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {chat.lastMessage}
                </p>
              </div>
            </div>
          </Link>
        ))
      )}
    </div>
  );
}
