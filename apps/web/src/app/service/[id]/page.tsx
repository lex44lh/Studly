import BackButton from "@/components/BackButton";
import Link from "next/link";
import ServiceFavoriteButton from "../../../components/ServiceFavoriteButton";
import StartChatButton from "../../../components/StartChatButton";
import CreateOrderButton from "@/components/CreateOrderButton";
type Props = {
  params: Promise<{
    id: string;
  }>;
};

const services = {
  1: {
    title: "Помогу с C++",
    price: "500 ₽",
    seller: "Иван Петров",
    rating: "4.9 (126 отзывов)",
    profileId: 1,
    duration: "3 дня",
    description:
      "Помогу выполнить лабораторные работы, исправить ошибки в коде, объяснить сложные темы по C++.",
    included: [
      "Консультация",
      "Проверка кода",
      "Исправление ошибок",
    ],
  },

  2: {
    title: "Помощь с Python",
    price: "900 ₽",
    seller: "Дмитрий Иванов",
    rating: "5.0 (54 отзыва)",
    profileId: 2,
    duration: "4 дня",
    description:
      "Помогу разобраться с Python, решить учебные задачи, найти ошибки в коде и объяснить сложные темы.",
    included: [
      "Консультация",
      "Разбор кода",
      "Исправление ошибок",
    ],
  },

  100: {
    title: "Репетитор по английскому",
    price: "700 ₽",
    seller: "Анна Смирнова",
    rating: "4.8 (93 отзыва)",
    profileId: 100,
    duration: "7 дней",
    description:
      "Помогу улучшить английский язык, разобраться с грамматикой, подготовиться к занятиям и выполнить учебные задания.",
    included: [
      "Онлайн-консультация",
      "Разбор заданий",
      "Объяснение грамматики",
    ],
  },

  101: {
    title: "Монтаж видео",
    price: "1200 ₽",
    seller: "Максим Козлов",
    rating: "4.9 (41 отзыв)",
    profileId: 101,
    duration: "5 дней",
    description:
      "Смонтирую видео, добавлю переходы, музыку, субтитры и подготовлю готовый ролик.",
    included: [
      "Монтаж видео",
      "Добавление музыки",
      "Субтитры и переходы",
    ],
  },
};

export default async function ServicePage({
  params,
}: Props) {
  const { id } = await params;

  const service = services[
    Number(id) as keyof typeof services
  ];

  if (!service) {
    return (
      <div>
        <BackButton />

        <h1>Услуга не найдена</h1>

        <p>
          Такой услуги пока не существует.
        </p>

        <Link
          href="/search"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: "44px",
            padding: "0 16px",
            borderRadius: "12px",
            background: "#3547B8",
            color: "#FFFFFF",
            textDecoration: "none",
            fontWeight: 600,
            marginTop: "16px",
          }}
        >
          Вернуться в каталог
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Верхняя панель */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <BackButton />

        <ServiceFavoriteButton
          serviceId={Number(id)}
        />
      </div>

      {/* Фото */}
      <div
        style={{
          height: "220px",
          background: "#F3F4F6",
          borderRadius: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "20px",
        }}
      >
        Фото услуги
      </div>

      {/* Цена */}
      <p
        style={{
          color: "#3547B8",
          fontWeight: 700,
          fontSize: "24px",
          marginBottom: "0px",
        }}
      >
        {service.price}
      </p>

      {/* Название */}
      <h1
        style={{
          marginTop: "0",
          marginBottom: "40px",
        }}
      >
        {service.title}
      </h1>

      {/* Исполнитель */}
      <Link
        href={`/profile/${service.profileId}`}
        style={{
          textDecoration: "none",
          color: "inherit",
        }}
      >
        <p
          style={{
            marginBottom: "0px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {service.seller}
        </p>

        <p
          style={{
            marginBottom: "0px",
            cursor: "pointer",
          }}
        >
          ⭐ {service.rating}
        </p>
      </Link>

      {/* Срок */}
      <p
        style={{
          marginBottom: "10px",
        }}
      >
        ⏱ Срок выполнения: {service.duration}
      </p>

      {/* Начать чат */}

<StartChatButton
  serviceId={Number(id)}
  performerId={service.profileId}
  performerName={service.seller}
  serviceTitle={service.title}
/>

      {/* Описание */}
      <h3
        style={{
          marginBottom: "10px",
        }}
      >
        Описание:
      </h3>

      <p>{service.description}</p>

      {/* Что входит */}
      <h3
        style={{
          marginTop: "30px",
          marginBottom: "10px",
        }}
      >
        Что входит:
      </h3>

      <ul>
        {service.included.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      {/* Дополнительные услуги */}
      <h3
        style={{
          marginTop: "32px",
          marginBottom: "12px",
        }}
      >
        Дополнительные услуги:
      </h3>

      <div
        style={{
          border: "1px solid #E5E7EB",
          borderRadius: "12px",
          padding: "12px",
          marginBottom: "10px",
        }}
      >
        Срочное выполнение — 300 ₽
      </div>

      <div
        style={{
          border: "1px solid #E5E7EB",
          borderRadius: "12px",
          padding: "12px",
          marginBottom: "10px",
        }}
      >
        Созвон и объяснение — 500 ₽
      </div>

      <div
        style={{
          border: "1px solid #E5E7EB",
          borderRadius: "12px",
          padding: "12px",
          marginBottom: "24px",
        }}
      >
        Подробный отчёт — 400 ₽
      </div>

      {/* Оплата */}
      <CreateOrderButton
  serviceId={Number(id)}
  serviceTitle={service.title}
  performerId={service.profileId}
  performerName={service.seller}
/>
    </div>
  );
}
