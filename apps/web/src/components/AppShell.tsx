"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FavoritesProvider } from "@/context/FavoritesContext";
import { useState } from "react";
import BottomNav from "./BottomNav";
import Sidebar from "./Sidebar";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  if (pathname === "/welcome" || pathname === "/register" || pathname.startsWith("/register/")) {
    return <>{children}</>;
  }

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

        <FavoritesProvider>
          <main
            style={{
              flex: 1,
              padding: "16px",
            }}
          >
            {children}
          </main>
        </FavoritesProvider>

        <BottomNav />
      </div>
    </>
  );
}
