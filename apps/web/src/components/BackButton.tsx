"use client";

import { useRouter } from "next/navigation";

export default function BackButton() {
  const router = useRouter();

  return (
    <div
      onClick={() => router.back()}
      style={{
        marginBottom: "16px",
        cursor: "pointer",
        fontWeight: 500,
      }}
    >
      ← Назад
    </div>
  );
}
