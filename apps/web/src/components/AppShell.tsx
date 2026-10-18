"use client";

import Link from "next/link";
import { demoMode } from "@/lib/api/catalog";
import { usePathname } from "next/navigation";
import { FavoritesProvider } from "@/context/FavoritesContext";
import { useState } from "react";
import BottomNav from "./BottomNav";
import Sidebar from "./Sidebar";
import { CampusShell } from "./studly/CampusShell";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return <FavoritesProvider><AppShellContent>{children}</AppShellContent></FavoritesProvider>;
}

function AppShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const legacyPreview = !demoMode && ["/orders", "/chats", "/create-service", "/notifications"]
    .some(path => pathname === path || pathname.startsWith(`${path}/`));
  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  if (pathname === "/welcome" || pathname === "/register" || pathname.startsWith("/register/")) {
    return <>{children}</>;
  }

  if (pathname === "/search") return <CampusShell>{children}</CampusShell>;

  return (
    <>
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() =>
          setSidebarOpen(false)
        }
      />

      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          style={{
            height: "60px",
            background: "#FFFFFF",
            borderBottom:
              "1px solid #E5E7EB",
            display: "flex",
            alignItems: "center",
            justifyContent:
              "space-between",
            padding: "0 16px",
          }}
        >
          <button
            type="button"
            onClick={() =>
              setSidebarOpen(true)
            }
            style={{
              border: "none",
              background:
                "transparent",
              fontSize: "22px",
              cursor: "pointer",
            }}
          >
            ☰
          </button>

          <span
            style={{
              fontWeight: 700,
              color: "#3547B8",
              fontSize: "20px",
            }}
          >
            STUDLY
          </span>

          <Link
            href="/notifications"
            aria-label="Уведомления"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent:
                "center",
              width: "40px",
              height: "40px",
              textDecoration:
                "none",
              borderRadius: "10px",
            }}
          >
            <span
              style={{
                fontSize: "20px",
              }}
            >
              🔔
            </span>
          </Link>
        </header>

          <main
            style={{
              flex: 1,
              padding: "16px",
            }}
          >
            {demoMode && <p role="note">Демонстрационный режим · Данные не являются реальными</p>}
            {legacyPreview ? <>
              <p role="note">Серверные данные этого раздела ещё не подключены. Интерфейс сохранён; действия отключены. Для просмотра демонстрационных данных используйте явно выбранный DEMO-режим.</p>
              <fieldset disabled style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>{children}</fieldset>
            </> : children}
          </main>

        <BottomNav />
      </div>
    </>
  );
}
