import demoServices from "@/data/services";
import { demoMode } from "@/lib/api/catalog";
import LivePerformer from "@/components/catalog/LivePerformer";
import BackButton from "@/components/BackButton";
import Link from "next/link";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

const profiles = {
  1: {
    name: "Иван Петров",
    rating: "4.9 (126 отзывов)",
    status: "Эксперт",
    about:
      "Помогаю студентам с программированием, C++, Python и Telegram-ботами. Опыт более 4 лет.",
    completed: 48,
    servicesCount: 12,
    success: "98%",
    disputes: "1%",
    services: [1],
  },

  2: {
    name: "Дмитрий Иванов",
    rating: "5.0 (54 отзыва)",
    status: "Эксперт",
    about:
      "Помогаю студентам разобраться с Python, алгоритмами и программированием.",
    completed: 32,
    servicesCount: 7,
    success: "99%",
    disputes: "1%",
    services: [2],
  },

  100: {
    name: "Анна Смирнова",
    rating: "4.8 (93 отзыва)",
    status: "Эксперт",
    about:
      "Репетитор по английскому языку. Помогаю студентам улучшить грамматику, лексику и разговорную речь.",
    completed: 41,
    servicesCount: 9,
    success: "97%",
    disputes: "2%",
    services: [100],
  },

  101: {
    name: "Максим Козлов",
    rating: "4.9 (41 отзыв)",
    status: "Профессионал",
    about:
      "Занимаюсь видеомонтажом, обработкой видео, субтитрами и созданием готовых роликов.",
    completed: 27,
    servicesCount: 5,
    success: "98%",
    disputes: "1%",
    services: [101],
  },
};

const services = Object.fromEntries(demoServices.map(service => [service.id, service]));

async function DemoPerformerProfilePage({
  params,
}: Props) {
  const { id } = await params;

  const existingService = demoServices.find(service => service.profileId === Number(id));
  const profile = profiles[Number(id) as keyof typeof profiles] ?? (existingService ? {
    name: existingService.seller, rating: existingService.rating, status: "Демо-профиль",
    about: "Описание не добавлено в демонстрационные данные.", completed: "—", servicesCount: demoServices.filter(service => service.profileId === Number(id)).length,
    success: "—", disputes: "—", services: demoServices.filter(service => service.profileId === Number(id)).map(service => service.id),
  } : undefined);

  if (!profile) {
    return (
      <div>
        <BackButton />

        <h1>Исполнитель не найден</h1>

        <p>
          Такой профиль исполнителя пока не существует.
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
      <BackButton />

      {/* Профиль */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            background: "#E5E7EB",
            flexShrink: 0,
          }}
        />

        <div>
          <h2
            style={{
              margin: 0,
            }}
          >
            {profile.name}
          </h2>

          <p
            style={{
              margin: "4px 0",
            }}
          >
            ⭐ {profile.rating}
          </p>

          <p
            style={{
              margin: 0,
              color: "#3547B8",
              fontWeight: 600,
            }}
          >
            {profile.status}
          </p>
        </div>
      </div>

      {/* О себе */}
      <h3>О себе</h3>

      <p>{profile.about}</p>

      {/* Статистика */}
      <h3
        style={{
          marginTop: "32px",
        }}
      >
        Статистика
      </h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
          marginTop: "12px",
        }}
      >
        <div
          style={{
            border: "1px solid #E5E7EB",
            borderRadius: "12px",
            padding: "12px",
          }}
        >
          <strong>{profile.completed}</strong>
          <br />
          Выполнено заказов
        </div>

        <div
          style={{
            border: "1px solid #E5E7EB",
            borderRadius: "12px",
            padding: "12px",
          }}
        >
          <strong>{profile.servicesCount}</strong>
          <br />
          Услуг
        </div>

        <div
          style={{
            border: "1px solid #E5E7EB",
            borderRadius: "12px",
            padding: "12px",
          }}
        >
          <strong>{profile.success}</strong>
          <br />
          Успешность
        </div>

        <div
          style={{
            border: "1px solid #E5E7EB",
            borderRadius: "12px",
            padding: "12px",
          }}
        >
          <strong>{profile.disputes}</strong>
          <br />
          Споры
        </div>
      </div>

      {/* Услуги исполнителя */}
      <h3
        style={{
          marginTop: "32px",
        }}
      >
        Активные услуги
      </h3>

      {profile.services.map((serviceId) => {
        const service =
          services[
            serviceId as keyof typeof services
          ];

        if (!service) {
          return null;
        }

        return (
          <Link
            key={serviceId}
            href={`/service/${serviceId}`}
            style={{
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div
              style={{
                border: "1px solid #E5E7EB",
                borderRadius: "16px",
                padding: "16px",
                marginBottom: "12px",
                cursor: "pointer",
              }}
            >
              <h4>{service.title}</h4>

              <p
                style={{
                  color: "#3547B8",
                  fontWeight: 700,
                }}
              >
                {service.price}
              </p>
            </div>
          </Link>
        );
      })}

      {/* Написать исполнителю */}
      <button
        type="button"
        style={{
          width: "100%",
          height: "52px",
          border: "none",
          borderRadius: "12px",
          background: "#3547B8",
          color: "#FFFFFF",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Написать исполнителю
      </button>
    </div>
  );
}

export default async function PerformerProfilePage({ params }: Props) {
  const { id } = await params;
  return demoMode ? <DemoPerformerProfilePage params={params} /> : <LivePerformer key={id} id={id} />;
}
