"use client";

import { use, useState } from "react";
import BackButton from "@/components/BackButton";
import Link from "next/link";
import ServiceFavoriteButton from "@/components/ServiceFavoriteButton";
import StartChatButton from "@/components/StartChatButton";
import CreateOrderButton from "@/components/CreateOrderButton";
import AdditionalServicesSelector, {
  AdditionalService,
} from "@/components/AdditionalServicesSelector";
import services from "@/data/services";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

const additionalServices: AdditionalService[] = [
  {
    id: "urgent",
    title: "Срочное выполнение",
    price: 300,
    extraDays: 0,
  },
  {
    id: "call",
    title: "Созвон и объяснение",
    price: 500,
    extraDays: 0,
  },
  {
    id: "report",
    title: "Подробный отчёт",
    price: 400,
    extraDays: 1,
  },
];

export default function ServicePage({
  params,
}: Props) {
  const { id } = use(params);

  const service = services.find(
    (item) => item.id === Number(id)
  );

  const [
    selectedAdditionalServices,
    setSelectedAdditionalServices,
  ] = useState<AdditionalService[]>([]);

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
          serviceId={service.id}
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
          marginBottom: "0",
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
            marginBottom: "0",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {service.seller}
        </p>

        <p
          style={{
            marginBottom: "0",
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
        ⏱ Срок выполнения:{" "}
        {service.duration}
      </p>

      {/* Начать чат */}
      <StartChatButton
        serviceId={service.id}
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

      <p
        style={{
          color: "#6B7280",
          fontSize: "14px",
          marginTop: "0",
          marginBottom: "12px",
        }}
      >
        Можно выбрать дополнительные услуги
        сразу при оформлении заказа.
      </p>

      <AdditionalServicesSelector
        services={additionalServices}
        onChange={
          setSelectedAdditionalServices
        }
      />

      {/* Оплата */}
      <CreateOrderButton
        serviceId={service.id}
        serviceTitle={service.title}
        performerId={service.profileId}
        performerName={service.seller}
        basePrice={service.priceNumber}
        baseDurationDays={service.durationDays}
        selectedAdditionalServices={
          selectedAdditionalServices
        }
      />
    </div>
  );
}
