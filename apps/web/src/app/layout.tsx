import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import AppShell from "@/components/AppShell";

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export const metadata: Metadata = {
  title: "STUDLY",
  description: "Student Services Marketplace",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>
        <AuthProvider><AppShell>{children}</AppShell></AuthProvider>
      </body>
    </html>
  );
}
