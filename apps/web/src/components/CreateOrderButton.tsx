"use client";

import { useRouter } from "next/navigation";

type Props = {
  serviceId: number;
  serviceTitle: string;
  performerId: number;
  performerName: string;
};

export default function CreateOrderButton({
  serviceId,
  serviceTitle,
  performerId,
  performerName,
}: Props) {
  const router = useRouter();

  const createOrder = () => {
    const saved =
      localStorage.getItem("studly-orders");

    const orders = saved
      ? JSON.parse(saved)
      : [];

    const newOrder = {
  id: Date.now(),
  serviceId,
  serviceTitle,
  performerId,
  performerName,
  status: "PENDING",
  createdAt: Date.now(),
  chatId: null,
};

    orders.push(newOrder);

    localStorage.setItem(
      "studly-orders",
      JSON.stringify(orders)
    );

    router.push("/orders");
  };

  return (
    <button
      onClick={createOrder}
      style={{
        width: "100%",
        height: "52px",
        border: "none",
        borderRadius: "12px",
        background: "#3547B8",
        color: "#FFFFFF",
        fontWeight: 600,
        cursor: "pointer",
        marginBottom: "20px",
      }}
    >
      Оплатить
    </button>
  );
}
