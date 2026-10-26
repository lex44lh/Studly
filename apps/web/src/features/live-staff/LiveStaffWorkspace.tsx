"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/studly/Icon";
import { ApiError, pagePath, requestKey } from "@/lib/api/client";
import { staffClient, type StaffResource, type StaffRow, type StaffCase, type StaffSession, type StaffPerformer,
  type StaffDecision, type StaffUser, type StaffOrder, type StaffEvent } from "@/lib/api/staff";
import { portfolioContentPath } from "@/lib/api/account";
import type { OwnService } from "@/lib/api/services";
import type { SecurityCase } from "@/lib/api/commerce";
import { LiveAccess, LiveState, useLiveResource } from "@/features/live/shared";
import styles from "@/features/demo-workspace/admin.module.css";

export const staffSections: { id: string; label: string; resource?: StaffResource; unavailable?: string }[] = [
  { id: "dashboard", label: "Обзор" }, { id: "users", label: "Пользователи", resource: "users" },
  { id: "profiles", label: "Профили на проверке", resource: "performers" }, { id: "services", label: "Услуги", resource: "services" },
  { id: "orders", label: "Заказы", resource: "orders" }, { id: "disputes", label: "Обращения и споры", unavailable: "Арбитражные команды и обращения по заказам пока недоступны." },
  { id: "security", label: "Жалобы и безопасность", resource: "security-cases" },
  { id: "reviews", label: "Отзывы", unavailable: "Отзывы по завершённым заказам пока недоступны." },
  { id: "finance", label: "Финансы", unavailable: "Платежи, возвраты, выплаты и финансовые отчёты пока недоступны." },
  { id: "analytics", label: "Аналитика", unavailable: "Серверная аналитика пока недоступна." },
  { id: "events", label: "История решений", resource: "events" }, { id: "settings", label: "Настройки" },
];
const labels: Record<string, string> = { draft: "Черновик", pending: "На проверке", approved: "Одобрен", published: "Опубликована", rejected: "Отклонено", changes: "Нужны исправления",
  pending_acceptance: "Ожидает исполнителя", awaiting_payment: "Ожидает оплаты", cancelled: "Отменён", declined: "Исполнитель отказался", release: "Опубликовать сообщение", keep: "Оставить удержанным" };
function rowId(row: StaffRow) { return "user_id" in row ? row.user_id : row.id; }
function rowTitle(row: StaffRow) {
  return "display_name" in row ? row.display_name : "title" in row ? row.title : "operation" in row ? row.operation : `Проверка сообщения № ${row.message_id}`;
}
function rowStatus(row: StaffRow) {
  if ("status" in row) return labels[row.status] ?? row.status;
  if ("decision" in row) return row.decision ? labels[row.decision] : row.appealed ? "Есть обжалование" : "Ожидает решения";
  if ("is_active" in row) return row.is_active ? "Активен" : "Неактивен";
  return "Событие";
}

export default function LiveStaffWorkspace() { return <LiveAccess><StaffSessionView /></LiveAccess>; }
function StaffSessionView() {
  const session = useLiveResource("staff-session", signal => staffClient.me(signal));
  if (!session.data) return <div className="campus-page"><h1 className="page-heading">Рабочее место сотрудника</h1><LiveState error={session.error} loading={session.loading} retry={session.reload} /><Link href="/profile">Вернуться в кабинет</Link></div>;
  return <Workspace key={session.data.id} session={session.data} refresh={session.reload} />;
}
function Workspace({ session, refresh }: { session: StaffSession; refresh: () => void }) {
  const [section, setSection] = useState("dashboard");
  const selected = staffSections.find(item => item.id === section)!;
  return <div className={`campus-page ${styles.admin}`}>
    <aside className={styles.sidebar}><span className={styles.sandboxLabel}>STUDLY · LIVE</span><strong className={styles.sidebarTitle}>Рабочее место</strong><p>{session.display_name}</p>
      <nav aria-label="Разделы рабочего места">{staffSections.map(item => <button type="button" key={item.id} aria-current={section === item.id ? "page" : undefined} onClick={() => setSection(item.id)}><Icon name="grid" /><span>{item.label}</span></button>)}</nav>
      <Link className={styles.sidebarFooter} href="/profile">В личный кабинет</Link>
    </aside>
    <div className={styles.content}><header className={styles.topbar}><div><p className={styles.eyebrow}>Сотрудник STUDLY</p><h1>{selected.label}</h1></div><button type="button" className={styles.outlineButton} onClick={refresh}>Проверить доступ</button></header>
      <label className={styles.mobileNavigation}>Раздел рабочего места<select value={section} onChange={event => setSection(event.target.value)}>{staffSections.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      {selected.resource ? session.resources.includes(selected.resource) ? <Resource key={selected.resource} resource={selected.resource} staffId={session.id} /> : <section className={styles.panel}><h2>Нет доступа</h2><p>У вашей учётной записи нет разрешения на этот раздел.</p></section>
        : selected.unavailable ? <section className={styles.panel}><h2>Раздел пока недоступен</h2><p>{selected.unavailable}</p></section>
        : section === "dashboard" ? <section className={styles.panel}><h2>Доступные разделы</h2><p>Открывайте записи и проверяйте актуальные данные перед решением.</p><div className={styles.quickActions}>{staffSections.filter(item => item.resource && session.resources.includes(item.resource)).map(item => <button type="button" key={item.id} onClick={() => setSection(item.id)}>{item.label}<Icon name="arrow" /></button>)}</div>{!session.resources.length && <p>Разрешения на ресурсы не выданы.</p>}<p className={styles.note}>Сводные показатели и серверные уведомления пока недоступны.</p></section>
        : <section className={styles.panel}><h2>Полномочия сотрудника</h2><p>Доступ подтверждён для учётной записи № {session.id}. Изменять права и правила платформы здесь нельзя.</p><p>Тема меняется общим переключателем STUDLY. Серверные настройки пока недоступны.</p></section>}
    </div>
  </div>;
}
function Resource({ resource, staffId }: { resource: StaffResource; staffId: number }) {
  const [query, setQuery] = useState(""); const [search, setSearch] = useState(""); const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<StaffRow | null>(null);
  const data = useLiveResource(`staff:${resource}:${query}`, signal => staffClient.list(resource, query, signal));
  const statuses = resource === "performers" ? ["draft", "pending", "approved", "rejected", "changes"] : resource === "services" ? ["draft", "pending", "published", "rejected", "changes"] : resource === "orders" ? ["pending_acceptance", "awaiting_payment", "cancelled", "declined"] : [];
  return <><section className={styles.panel}>
    <form className={styles.filters} onSubmit={event => { event.preventDefault(); setSelected(null); const params = new URLSearchParams(); if (search.trim()) params.set("search", search.trim()); if (status) params.set("status", status); setQuery(params.toString()); }}>
      {resource !== "security-cases" && <label>Поиск<input maxLength={200} value={search} onChange={event => setSearch(event.target.value)} /></label>}
      {!!statuses.length && <label>Статус<select value={status} onChange={event => setStatus(event.target.value)}><option value="">Все</option>{statuses.map(value => <option key={value} value={value}>{labels[value]}</option>)}</select></label>}
      {resource !== "security-cases" && <button type="submit" className={styles.outlineButton}>Применить</button>}
      <button type="button" className={styles.outlineButton} onClick={data.reload}>Обновить список</button>
    </form>
    <LiveState error={data.error} loading={data.loading} retry={data.reload} />
    {data.data && <><p className={styles.tableSummary}>Всего записей: {data.data.count}</p><div className={styles.quickActions}>{data.data.results.map(row => <button type="button" key={rowId(row)} onClick={() => setSelected(row)}>{rowTitle(row)} · {rowStatus(row)}<Icon name="arrow" /></button>)}</div>{!data.data.results.length && <p>Записей пока нет.</p>}
      <div className={styles.paging}>{(["previous", "next"] as const).map(direction => <button type="button" key={direction} disabled={!data.data?.[direction]} onClick={() => { setSelected(null); setQuery(pagePath(data.data![direction]!, `staff/${resource}/`).split("?")[1] ?? ""); }}>{direction === "previous" ? "Назад" : "Далее"}</button>)}</div></>}
  </section>{selected && <Detail key={`${resource}:${rowId(selected)}`} resource={resource} initial={selected} staffId={staffId} close={() => setSelected(null)} changed={data.reload} />}</>;
}
function Detail({ resource, initial, staffId, close, changed }: { resource: StaffResource; initial: StaffRow; staffId: number; close: () => void; changed: () => void }) {
  const id = rowId(initial); const [purpose, setPurpose] = useState(""); const [approvedPurpose, setApprovedPurpose] = useState("");
  const detail = useLiveResource<StaffRow | StaffCase>(resource === "security-cases" && !approvedPurpose ? null : `staff-detail:${resource}:${id}:${approvedPurpose}`, signal => resource === "security-cases" ? staffClient.caseContent(id, approvedPurpose, signal) : staffClient.detail(resource, id, signal));
  const row = detail.data ?? initial;
  const [decision, setDecision] = useState<StaffDecision | "release" | "keep">(resource === "security-cases" ? "keep" : "approved");
  const [reason, setReason] = useState(""); const [confirmed, setConfirmed] = useState(false); const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(); const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<((signal: AbortSignal) => Promise<unknown>) | null>(null); const active = useRef(false); const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const canDecide = !!detail.data && !detail.error && !detail.loading && (resource === "performers" ? (row as StaffPerformer).status === "pending" && id !== staffId : resource === "services" ? (row as OwnService).status === "pending" && (row as OwnService).performer.id !== staffId : resource === "security-cases" ? (row as SecurityCase).decision === null : false);
  const needsReason = resource === "security-cases" || decision !== "approved";
  const submit = async () => {
    if (active.current || (!pending && (!canDecide || !confirmed || needsReason && !reason.trim()))) return;
    active.current = true; setBusy(true); setError(undefined); setNotice(""); const controller = new AbortController(); abort.current = controller;
    let command = pending;
    if (!command) {
      const input = { revision: (row as StaffPerformer | OwnService | SecurityCase).revision, request_key: requestKey(), decision, reason: reason.trim() };
      command = resource === "performers" ? signal => staffClient.decideProfile(id, { ...input, decision: input.decision as StaffDecision }, signal)
        : resource === "services" ? signal => staffClient.decideService(id, { ...input, decision: input.decision as StaffDecision }, signal)
        : signal => staffClient.decideCase(id, { ...input, decision: input.decision as "release" | "keep" }, signal);
      setPending(() => command);
    }
    try { await command(controller.signal); if (controller.signal.aborted) return; setPending(null); setConfirmed(false); setNotice("Решение сохранено. Проверяем актуальное состояние."); detail.reload(); changed(); }
    catch (cause) { if (controller.signal.aborted) return; setError(cause); if (cause instanceof ApiError && cause.status > 0 && cause.status < 500) { setPending(null); setConfirmed(false); if ([403, 409].includes(cause.status)) detail.reload(); } }
    finally { active.current = false; if (!controller.signal.aborted) setBusy(false); }
  };
  return <section className={styles.panel} aria-labelledby="staff-detail-title"><div className={styles.topbar}><h2 id="staff-detail-title">{rowTitle(row)} · № {id}</h2><button type="button" className={styles.outlineButton} disabled={busy || !!pending} onClick={close}>Закрыть</button></div>
    {resource === "security-cases" && !approvedPurpose && <form onSubmit={event => { event.preventDefault(); if (purpose.trim()) setApprovedPurpose(purpose.trim()); }}><label>Цель просмотра сообщения<textarea maxLength={500} required value={purpose} onChange={event => setPurpose(event.target.value)} /></label><button type="submit" className={styles.outlineButton} disabled={!purpose.trim()}>Открыть сообщение по обращению</button><p className={styles.note}>Просмотр фиксируется в истории. Общая лента частной переписки недоступна.</p></form>}
    <LiveState error={detail.error} loading={detail.loading} retry={detail.reload} />
    <p>{rowStatus(row)}</p><Details resource={resource} row={row} />
    {canDecide || pending ? <div className={styles.decision}><h3>Решение сотрудника</h3><fieldset disabled={busy || !!pending}><label>Действие<select value={decision} onChange={event => { setDecision(event.target.value as typeof decision); setConfirmed(false); }}>{(resource === "security-cases" ? ["keep", "release"] : ["approved", "rejected", "changes"]).map(value => <option key={value} value={value}>{labels[value]}</option>)}</select></label><label>Причина{needsReason ? " · обязательно" : ""}<textarea maxLength={2000} required={needsReason} value={reason} onChange={event => { setReason(event.target.value); setConfirmed(false); }} /></label><label className={styles.checkLabel}><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />Я проверил(а) актуальные материалы и подтверждаю решение</label></fieldset>
      {!!pending && !busy && <p role="status">Ответ не подтверждён. Повторим то же решение с сохранённым ключом.</p>}
      <button type="button" className={styles.primaryButton} disabled={busy || !pending && (!confirmed || needsReason && !reason.trim())} onClick={() => void submit()}>{busy ? "Сохраняем…" : pending ? "Повторить то же решение" : "Подтвердить решение"}</button></div> : ["performers", "services", "security-cases"].includes(resource) && <p className={styles.note}>Сейчас решение недоступно. Проверьте статус, материалы и свои полномочия.</p>}
    <LiveState error={error} />{notice && <p role="status">{notice}</p>}
  </section>;
}
function Details({ resource, row }: { resource: StaffResource; row: StaffRow }) {
  if (resource === "users") { const value = row as StaffUser; return <p>Роли: {value.roles.map(role => role === "customer" ? "Заказчик" : "Исполнитель").join(", ") || "Не выбраны"}. Изменять аккаунт здесь нельзя.</p>; }
  if (resource === "performers") { const value = row as StaffPerformer; return <><p>{value.description}</p><p>Редакция {value.revision}. {value.reason}</p><p>Недостающие поля: {value.missing_fields.join(", ") || "нет"}</p><h3>Примеры работ</h3>{value.examples.map(example => <p key={example.id}>{example.title} · {example.kind === "link" ? <a href={example.url!} target="_blank" rel="noopener noreferrer">Открыть ссылку</a> : <a href={portfolioContentPath(example.id, example.content_url!)} download>Скачать приватный файл</a>}</p>)}</>; }
  if (resource === "services") { const value = row as OwnService; return <><p>{value.description}</p><p>{value.category} · {value.price_amount} ₽ · {value.duration_days} дн.</p><p>Исполнитель: {value.performer.name}. Редакция {value.revision}. {value.reason}</p><ul>{value.included.map((text, index) => <li key={index}>{text}</li>)}</ul><h3>Дополнения</h3>{value.extras.map(extra => <p key={extra.id}>{extra.title} · {extra.price_amount} ₽ · +{extra.extra_days} дн.</p>)}<p>Выбрано примеров: {value.portfolio_example_ids.length}</p></>; }
  if (resource === "orders") { const value = row as StaffOrder; return <><p>{value.buyer.name} → {value.performer.name}</p><p>{value.description}</p><p>Сумма снимка: {value.price_amount} ₽ · комиссия {value.buyer_fee_percent}%: {value.buyer_fee_amount} ₽ · итого {value.total_amount} ₽</p><p>Срок: {value.duration_days} дн.</p><p>Оплата, арбитражные решения и изменение заказа сотрудником пока недоступны.</p></>; }
  if (resource === "events") { const value = row as StaffEvent; return <><p>Объект: {value.target} · сотрудник № {value.actor_id ?? "—"}</p><p>{value.created_at}</p>{typeof value.details.reason === "string" && <p>Причина: {value.details.reason}</p>}</>; }
  const value = row as SecurityCase | StaffCase; return <><p>Категории: {value.categories.join(", ")} · правила {value.rules_version}</p><p>Редакция {value.revision}</p>{value.appealed && <p>Обжалование: {value.appeal_reason}</p>}{value.decision && <p>Причина решения: {value.decision_reason}</p>}{"message" in value && <><h3>Сообщение по обращению</h3><p>{value.message.text}</p><p>Автор № {value.message.sender_id} · {value.message.created_at}</p></>}</>;
}
