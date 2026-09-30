import Link from "next/link";
import ServiceCard from "@/components/ServiceCard";

export default function HomePage() {
  const categories = [
    "📚 Помощь с заданиями",
    "🇬🇧 Английский язык",
    "💻 Программирование",
    "🎬 Видеомонтаж",
  ];

  const services = [
    {
      id: 1,
      title: "Помогу с C++",
      price: "500 ₽",
      seller: "Иван Петров",
      rating: "4.9 (126)",
    },
    {
      id: 100,
      title: "Репетитор по английскому",
      price: "700 ₽",
      seller: "Анна Смирнова",
      rating: "4.8 (93)",
    },
    {
      id: 2,
      title: "Помощь с Python",
      price: "900 ₽",
      seller: "Дмитрий Иванов",
      rating: "5.0 (54)",
    },
    {
      id: 101,
      title: "Монтаж видео",
      price: "1200 ₽",
      seller: "Максим Козлов",
      rating: "4.9 (41)",
    },
  ];

  return (
    <div>
      {/* Поиск */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "24px",
        }}
      >
        <input
          placeholder="Поиск услуг..."
          style={{
            flex: 1,
            height: "44px",
            border: "1px solid #E5E7EB",
            borderRadius: "12px",
            padding: "0 12px",
            fontSize: "14px",
          }}
        />

        <button
          style={{
            width: "44px",
            border: "1px solid #E5E7EB",
            borderRadius: "12px",
            background: "#FFFFFF",
            cursor: "pointer",
          }}
        >
          ⚙️
        </button>
      </div>

      {/* Категории */}
      <h2>Популярные категории</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
          marginBottom: "32px",
        }}
      >
        {categories.map((category) => (
          <div
            key={category}
            style={{
              background: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: "12px",
              padding: "16px",
              textAlign: "center",
            }}
          >
            {category}
          </div>
        ))}
      </div>

      {/* Услуги */}
      <h2>Популярные услуги</h2>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {services.map((service) => (
          <ServiceCard
            key={service.id}
            id={service.id}
            title={service.title}
            price={service.price}
            seller={service.seller}
            rating={service.rating}
          />
        ))}
      </div>

      {/* Все услуги */}
      <Link
        href="/search"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          marginTop: "20px",
          height: "48px",
          borderRadius: "12px",
          background: "#3547B8",
          color: "#FFFFFF",
          fontWeight: 600,
          textDecoration: "none",
          boxSizing: "border-box",
        }}
      >
        Смотреть все услуги
      </Link>
    </div>
  );
}
