"use client";

import { useRouter } from "next/navigation";

type Props = {
  serviceId: number;
  performerId: number;
  performerName: string;
  serviceTitle: string;
};

export default function StartChatButton({
  serviceId,
  performerId,
  performerName,
  serviceTitle,
}: Props) {
  const router = useRouter();

  const startChat = () => {
    const saved =
      localStorage.getItem("studly-chats");

    const chats = saved
      ? JSON.parse(saved)
      : [];

    // Один чат = один исполнитель + одна услуга
    const existingChat = chats.find(
      (chat: any) =>
        chat.performerId === performerId &&
        chat.serviceId === serviceId
    );

    if (existingChat) {
      router.push(
        `/chats/${existingChat.id}`
      );
      return;
    }

    const newChat = {
      id: Date.now(),
      serviceId,
      performerId,
      performerName,
      serviceTitle,
      createdAt: Date.now(),
    };

    chats.push(newChat);

    localStorage.setItem(
      "studly-chats",
      JSON.stringify(chats)
    );

    router.push(
      `/chats/${newChat.id}`
    );
  };

  return (
    <button
      type="button"
      onClick={startChat}
      style={{
        width: "100%",
        height: "52px",
        border: "none",
        borderRadius: "12px",
        background: "#3547B8",
        color: "#FFFFFF",
        fontWeight: 600,
        cursor: "pointer",
        marginBottom: "50px",
      }}
    >
      Начать чат
    </button>
  );
}
