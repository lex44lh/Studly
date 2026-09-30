"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BottomNav() {
  const pathname = usePathname();

  const items = [
    { href: "/", icon: "🏠", label: "Главная" },
    { href: "/search", icon: "🔍", label: "Поиск" },
    { href: "/favorites", icon: "❤️", label: "Избранное" },
    { href: "/chats", icon: "💬", label: "Чаты" },
    { href: "/profile", icon: "👤", label: "Профиль" },
  ];

  return (
    <nav
      style={{
        height: "70px",
        background: "#FFFFFF",
        borderTop: "1px solid #E5E7EB",
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        position: "sticky",
        bottom: 0,
      }}
    >
      {items.map((item) => {
        const active = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              textDecoration: "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              color: active ? "#3547B8" : "#9CA3AF",
              fontSize: "12px",
            }}
          >
            <span style={{ fontSize: "20px" }}>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
