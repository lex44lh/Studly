// Presentation only: persisted Demo records may predate the current UI shape.
// Unknown values never become a business status or change the stored record.
export function DemoOrderStatus({ status }: { status: unknown }) {
  let label: string;
  let modifier: string;
  switch (status) {
    case "PENDING": label = "Ожидает"; modifier = "pending"; break;
    case "IN_PROGRESS": label = "В работе"; modifier = "in_progress"; break;
    case "REVIEW": label = "На рассмотрении"; modifier = "review"; break;
    case "COMPLETED": label = "Завершён"; modifier = "completed"; break;
    default:
      label = status == null || status === "" ? "Статус не указан" : "Статус недоступен";
      modifier = "unspecified";
  }
  return <span className={`activity-status activity-status--${modifier}`}>{label}</span>;
}

export function demoPerformerName(value: unknown): string {
  return typeof value === "string" && value.trim() ? value : "Не указан";
}

export function demoPerformerInitial(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 1).toUpperCase() : "?";
}
