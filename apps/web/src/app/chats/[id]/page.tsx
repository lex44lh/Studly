"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import BackButton from "@/components/BackButton";
import ChatWindow from "@/components/ChatWindow";

type Chat = {
  id: number;
  performerId: number;
  performerName: string;
  serviceId: number;
  serviceTitle: string;
  createdAt: number;
  orderId?: number | null;
};

export default function ChatPage() {
  const params = useParams();

  const chatId = String(params.id);

  const [chat, setChat] =
    useState<Chat | null>(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    const saved =
      localStorage.getItem("studly-chats");

    if (!saved) {
      setLoading(false);
      return;
    }

    try {
      const chats: Chat[] =
        JSON.parse(saved);

      const foundChat = chats.find(
        (item) =>
          String(item.id) === chatId
      );

      setChat(foundChat ?? null);
    } catch {
      setChat(null);
    }

    setLoading(false);
  }, [chatId]);

  if (loading) {
    return (
      <div>
        <BackButton />
        <p>Загрузка...</p>
      </div>
    );
  }

  if (!chat) {
    return (
      <div>
        <BackButton />

        <h1>Чат не найден</h1>

        <p>
          Этот чат больше не существует.
        </p>
      </div>
    );
  }

  return (
    <div>
      <BackButton />

      <ChatWindow
        chatId={String(chat.id)}
        user={chat.performerName}
        service={chat.serviceTitle}
        orderId={
          chat.orderId ?? null
        }
      />
    </div>
  );
}
