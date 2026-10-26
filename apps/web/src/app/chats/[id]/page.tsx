"use client";
import { useOptionalDemoWorkspace } from "@/features/demo-workspace/Provider";
import { ChatRoute } from "@/features/demo-workspace/Routing";
import { demoMode } from "@/lib/data-mode";
import { LiveConversation } from "@/features/live-commerce";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import BackButton from "@/components/BackButton";
import ChatWindow from "@/components/ChatWindow";
import { Icon } from "@/components/studly/Icon";
import "@/components/studly/activity.css";

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
  const params = useParams<{ id: string }>();
  return demoMode ? <DemoChatPage /> : <LiveConversation id={params.id} />;
}
function DemoChatPage() {
  const workspace = useOptionalDemoWorkspace();
  const canonical = workspace !== null;
  const params = useParams();

  const chatId = String(params.id);

  const [chat, setChat] =
    useState<Chat | null>(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    const saved =
      demoMode && !canonical ? localStorage.getItem("studly-chats") : null;

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
  }, [chatId, canonical]);

  if (workspace) return <ChatRoute id={chatId}/>;

  if (loading) {
    return <div className="activity-page activity-page--chat"><BackButton /><div className="activity-empty" role="status" aria-busy="true"><span className="activity-empty-icon"><Icon name="chat" /></span><h1>Загрузка чата…</h1><p>Открываем Ваш диалог.</p></div></div>;
  }

  if (!chat) {
    return <div className="activity-page activity-page--chat"><BackButton /><div className="activity-empty"><span className="activity-empty-icon"><Icon name="chat" /></span><h1>Чат не найден</h1><p>Этот чат больше не существует.</p></div></div>;
  }

  return (
    <div className="activity-page activity-page--chat">
      <BackButton />
      <ChatWindow chatId={String(chat.id)} user={chat.performerName} service={chat.serviceTitle} orderId={chat.orderId ?? null} />
    </div>
  );
}
