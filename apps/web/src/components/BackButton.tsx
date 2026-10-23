"use client";

import { useRouter } from "next/navigation";
import { Icon } from "./studly/Icon";

export default function BackButton() {
  const router = useRouter();
  return <button type="button" className="page-back" onClick={() => router.back()}><Icon name="arrow" />Назад</button>;
}
