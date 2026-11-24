import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmailAuthScreen } from "@/features/email-auth/EmailAuthScreen";
import { emailAuthUiEnabled } from "@/lib/data-mode";

export const metadata: Metadata = { title: "Вход в STUDLY", robots: { index: false, follow: false } };

export default function EmailAuthPage() {
  if (!emailAuthUiEnabled) notFound();
  return <EmailAuthScreen />;
}
