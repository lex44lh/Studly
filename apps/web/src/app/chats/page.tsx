"use client";
import { useOptionalDemoWorkspace } from "@/features/demo-workspace/Provider";
import { ChatsRoute } from "@/features/demo-workspace/Routing";
import { demoMode } from "@/lib/data-mode";

import BackButton from "@/components/BackButton";
import { demoPerformerInitial, demoPerformerName } from "@/components/studly/DemoOrderPresentation";
import { Icon } from "@/components/studly/Icon";
import "@/components/studly/activity.css";
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
  const workspace = useOptionalDemoWorkspace();
  const canonical = workspace !== null;
  const [chats, setChats] = useState<ChatWithLastMessage[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const loadChats = () => {
      const saved = demoMode && !canonical ? localStorage.getItem("studly-chats") : null;

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
  }, [canonical]);

  if (workspace) return <ChatsRoute/>;

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
    <div className="activity-page activity-page--narrow">
      <BackButton />
      <header className="activity-header">
        <div><p className="activity-kicker">На связи</p><h1>Чаты</h1><p className="activity-intro">Обсуждайте детали и возвращайтесь к договорённостям.</p></div>
        {chats.length > 0 && <div className="activity-count" aria-label={`Всего чатов: ${chats.length}`}>{chats.length}<small>диалогов</small></div>}
      </header>
      {!loaded ? (
        <div className="activity-empty" role="status" aria-busy="true"><span className="activity-empty-icon"><Icon name="chat" /></span><h2>Загрузка чатов…</h2><p>Собираем Ваши диалоги.</p></div>
      ) : chats.length === 0 ? (
        <div className="activity-empty"><span className="activity-empty-icon"><Icon name="chat" /></span><h2>Пока нет чатов</h2><p>Начните общение на странице услуги. Все диалоги появятся здесь.</p></div>
      ) : (
        <div className="activity-list activity-chat-list">
          {chats.map((chat) => (
            <Link key={chat.id} href={`/chats/${chat.id}`} className="activity-card activity-card-link">
              <span className="activity-avatar" aria-hidden="true">{demoPerformerInitial(chat.performerName)}</span>
              <div className="activity-card-main">
                <div className="activity-row"><h2>{demoPerformerName(chat.performerName)}</h2><time className="activity-timestamp">{formatTime(chat.lastMessageTime)}</time></div>
                <p className="activity-chat-service">{chat.serviceTitle}</p>
                <p className="activity-chat-preview">{chat.lastMessage}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
