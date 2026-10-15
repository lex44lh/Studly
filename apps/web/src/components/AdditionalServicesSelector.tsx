"use client";

import { useMemo, useState } from "react";

export type AdditionalService = {
  id: string;
  title: string;
  price: number;
  extraDays: number;
};

type Props = {
  services: AdditionalService[];
  onChange: (selected: AdditionalService[]) => void;
};

export default function AdditionalServicesSelector({
  services,
  onChange,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>(
    []
  );

  const selectedServices = useMemo(
    () =>
      services.filter((service) =>
        selectedIds.includes(service.id)
      ),
    [services, selectedIds]
  );

  const toggleService = (serviceId: string) => {
    const nextIds = selectedIds.includes(serviceId)
      ? selectedIds.filter((id) => id !== serviceId)
      : [...selectedIds, serviceId];

    setSelectedIds(nextIds);

    onChange(
      services.filter((service) =>
        nextIds.includes(service.id)
      )
    );
  };

  const additionalTotal = selectedServices.reduce(
    (sum, service) => sum + service.price,
    0
  );

  return (
    <div>
      {services.map((service) => {
        const selected = selectedIds.includes(
          service.id
        );

        return (
          <button
            key={service.id}
            type="button"
            onClick={() =>
              toggleService(service.id)
            }
            style={{
              width: "100%",
              textAlign: "left",
              border: selected
                ? "2px solid #3547B8"
                : "1px solid #E5E7EB",
              borderRadius: "12px",
              padding: "14px",
              marginBottom: "10px",
              background: selected
                ? "#F5F6FF"
                : "#FFFFFF",
              cursor: "pointer",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <div>
                <div
                  style={{
                    fontWeight: 600,
                    marginBottom: "4px",
                  }}
                >
                  {selected ? "☑️" : "⬜"}{" "}
                  {service.title}
                </div>

                <div
                  style={{
                    fontSize: "13px",
                    color: "#6B7280",
                  }}
                >
                  {service.extraDays > 0
                    ? `+${service.extraDays} день`
                    : "Без изменения срока"}
                </div>
              </div>

              <strong
                style={{
                  color: "#3547B8",
                  whiteSpace: "nowrap",
                }}
              >
                +{service.price} ₽
              </strong>
            </div>
          </button>
        );
      })}

      {selectedServices.length > 0 && (
        <div
          style={{
            marginTop: "8px",
            marginBottom: "20px",
            padding: "12px",
            borderRadius: "12px",
            background: "#F9FAFB",
            fontSize: "14px",
          }}
        >
          Дополнительно:{" "}
          <strong>
            {additionalTotal} ₽
          </strong>
        </div>
      )}
    </div>
  );
}
