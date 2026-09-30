import ServiceCard from "@/components/ServiceCard";
import Link from "next/link";
import BackButton from "@/components/BackButton";
type Props = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function CategoryPage({
  params,
}: Props) {
  const { slug } = await params;

  const categoryNames: Record<string, string> = {
    programming: "💻 Программирование",
    courseworks: "🎓 Помощь с курсовыми",
    homework: "📚 Помощь с заданиями",
    tutoring: "👨‍🏫 Репетиторство",
    engineering: "📐 Инженерная графика",
    presentations: "📊 Презентации",
    reports: "📝 Рефераты и отчёты",
    video: "🎬 Видеомонтаж",
  };

  const title = categoryNames[slug] ?? "Категория";

  const services = [
    {
      id: 1,
      title: "Помогу с C++",
      price: "500 ₽",
      seller: "Иван Петров",
      rating: "4.9 (126 отзывов)",
    },
    {
      id: 2,
      title: "Помощь с Python",
      price: "900 ₽",
      seller: "Дмитрий Иванов",
      rating: "5.0 (54 отзыва)",
    },
    {
      id: 3,
      title: "Напишу Telegram-бота",
      price: "2000 ₽",
      seller: "Алексей Смирнов",
      rating: "4.8 (64 отзыва)",
    },
  ];

  return (
    <div>
      <BackButton />

      <h1>{title}</h1>

      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "20px",
        }}
      >
        <input
          placeholder="Поиск в категории..."
          style={{
            flex: 1,
            height: "44px",
            border: "1px solid #E5E7EB",
            borderRadius: "12px",
            padding: "0 12px",
          }}
        />

        <button
          style={{
            width: "44px",
            borderRadius: "12px",
          }}
        >
          ⚙️
        </button>
      </div>

      <p>Найдено услуг: 127</p>

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
  );
}
