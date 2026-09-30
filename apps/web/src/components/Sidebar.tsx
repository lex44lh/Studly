"use client";

import Link from "next/link";

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function Sidebar({
  isOpen,
  onClose,
}: SidebarProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Затемнение */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.35)",
          zIndex: 1000,
        }}
      />

      {/* Боковое меню */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "280px",
          height: "100vh",
          background: "#FFFFFF",
          zIndex: 1001,
          padding: "20px",
          overflowY: "auto",
          boxShadow: "2px 0 10px rgba(0,0,0,0.15)",
        }}
      >
        <h2>Категории</h2>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            marginTop: "20px",
          }}
        >
          <Link
            href="/category/homework"
            onClick={onClose}
            style={{
              textDecoration: "none",
              color: "#111827",
            }}
          >
            📚 Помощь с заданиями
          </Link>

          <Link
            href="/category/courseworks"
            onClick={onClose}
            style={{
              textDecoration: "none",
              color: "#111827",
            }}
          >
            🎓 Помощь с курсовыми
          </Link>

          <Link
            href="/category/tutoring"
            onClick={onClose}
            style={{
              textDecoration: "none",
              color: "#111827",
            }}
          >
            👨‍🏫 Репетиторство
          </Link>

          <Link
            href="/category/programming"
            onClick={onClose}
            style={{
              textDecoration: "none",
              color: "#111827",
            }}
          >
            💻 Программирование
          </Link>

          <Link
            href="/category/engineering"
            onClick={onClose}
            style={{
              textDecoration: "none",
              color: "#111827",
            }}
          >
            📐 Инженерная графика
          </Link>

          <Link
            href="/category/presentations"
            onClick={onClose}
            style={{
              textDecoration: "none",
              color: "#111827",
            }}
          >
            📊 Презентации
          </Link>

          <Link
            href="/category/reports"
            onClick={onClose}
            style={{
              textDecoration: "none",
              color: "#111827",
            }}
          >
            📝 Рефераты и отчёты
          </Link>

          <Link
            href="/category/video"
            onClick={onClose}
            style={{
              textDecoration: "none",
              color: "#111827",
            }}
          >
            🎬 Видеомонтаж
          </Link>

        </div>
                <hr style={{ margin: "24px 0" }} />
<Link
  href="/orders"
  onClick={onClose}
  style={{
    textDecoration: "none",
    color: "inherit",
  }}
>
  📦 Заказы
</Link>

        <hr style={{ margin: "24px 0" }} />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <Link
  href="/support"
  onClick={onClose}
  style={{
    textDecoration: "none",
    color: "#111827",
  }}
>
  🛟 Поддержка
</Link>

<Link
  href="/safety"
  onClick={onClose}
  style={{
    textDecoration: "none",
    color: "#111827",
  }}
>
  🔒 Безопасность
</Link>

<Link
  href="/rules"
  onClick={onClose}
  style={{
    textDecoration: "none",
    color: "#111827",
  }}
>
  📜 Правила платформы
</Link>

<Link
  href="/about"
  onClick={onClose}
  style={{
    textDecoration: "none",
    color: "#111827",
  }}
>
  ℹ️ О платформе
</Link>
        </div>
      </div>
    </>
  );
}
