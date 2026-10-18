"use client";
import { demoMode } from "@/lib/data-mode";

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
      demoMode ? localStorage.getItem("studly-chats") : null;

    if (!saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Finish the browser-only localStorage load after hydration.
      setLoading(false);
      return;
    }

    try {
      const parsed: unknown = JSON.parse(saved);
      const chats: Chat[] = Array.isArray(parsed)
        ? parsed as Chat[]
        : [];

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
