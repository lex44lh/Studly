"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/studly/Icon";
import { useDemoWorkspace } from "./Provider";
import { AssetPreview } from "./ui";
import { MODERATOR, moderationLabels, ratingFor, rubles, statusLabels, type AdminEvent, type Workspace } from "./model";
import styles from "./admin.module.css";

type Section = "dashboard" | "users" | "profiles" | "services" | "orders" | "disputes" | "security" | "reviews" | "finance" | "analytics" | "settings" | "events";
type Access = "all" | "profiles" | "services" | "support" | "finance";
type Kind = "user" | "profile" | "service" | "order" | "dispute" | "review" | "event";
type Row = { id: string; kind: Kind; title: string; description: string; status: string; statusText: string; at: number; summary: string; roles: string[] };
type View = { query: string; status: string; role: string; from: string; to: string; sort: "new" | "old" | "name"; page: number };
type Decision = "approved" | "rejected" | "changes";
type DecisionDraft = { decision: Decision; reason: string };
const sections: { id: Section; label: string; icon: IconName }[] = [
  { id: "dashboard", label: "Обзор", icon: "grid" }, { id: "users", label: "Пользователи", icon: "user" },
  { id: "profiles", label: "Профили на проверке", icon: "book" }, { id: "services", label: "Услуги", icon: "code" },
  { id: "orders", label: "Заказы", icon: "book" }, { id: "disputes", label: "Обращения и споры", icon: "chat" },
  { id: "security", label: "Жалобы и безопасность", icon: "heart" }, { id: "reviews", label: "Отзывы", icon: "pen" },
  { id: "finance", label: "Финансы", icon: "grid" }, { id: "analytics", label: "Аналитика", icon: "filter" },
  { id: "events", label: "История решений", icon: "clock" }, { id: "settings", label: "Настройки", icon: "menu" },
];
const accessLabels: Record<Access, string> = { all: "Все тестовые представления", profiles: "Проверка профилей", services: "Проверка услуг", support: "Обращения и заказы", finance: "Финансовые отчёты" };
const visibleSections: Record<Access, Section[]> = {
  all: sections.map(section => section.id),
  profiles: ["dashboard", "users", "profiles", "events", "settings"],
  services: ["dashboard", "services", "events", "settings"],
  support: ["dashboard", "orders", "disputes", "security", "reviews", "settings"],
  finance: ["dashboard", "finance", "analytics", "settings"],
};
const initialView = (): View => ({ query: "", status: "", role: "", from: "", to: "", sort: "new", page: 1 });
const initialViews = () => Object.fromEntries(sections.map(section => [section.id, initialView()])) as Record<Section, View>;
const date = (at: number) => Number.isFinite(at) ? new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Moscow" }).format(at) : "—";
const roleName = (role: string) => role === "customer" ? "Заказчик" : role === "performer" ? "Исполнитель" : role;
const disputeLabels = { discussion: "Обсуждение замечаний", open: "Открыт", reviewing: "На рассмотрении", decision: "Решение зафиксировано" };
const withinPeriod = (at: number, from: string, to: string) => (!from || at >= new Date(`${from}T00:00:00+03:00`).getTime()) && (!to || at <= new Date(`${to}T23:59:59.999+03:00`).getTime());
const eventAllowed = (event: AdminEvent, access: Access) => access === "all" || access === "profiles" && event.type === "profile" || access === "services" && event.type === "service";
const sumMoney = (values: number[]) => { const total = values.reduce((sum, value) => sum + BigInt(value), BigInt(0)); return total <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(total) : null; };
const displayMoney = (value: number | null) => value === null ? "Выше диапазона отображения" : rubles(value);

export function adminMetrics(state: Workspace) {
  const reviews = [...new Set(state.reviews.map(review => review.performerId))].flatMap(id => ratingFor(state, id).reviews);
  return {
    users: state.account ? 1 : 0,
    customers: state.account?.roles.includes("customer") ? 1 : 0,
    performers: state.account?.roles.includes("performer") ? 1 : 0,
    pendingProfiles: state.account?.moderation === "pending" ? 1 : 0,
    pendingServices: state.services.filter(service => service.status === "pending").length,
    activeOrders: state.orders.filter(order => order.status !== "COMPLETED").length,
    completedOrders: state.orders.filter(order => order.status === "COMPLETED").length,
    openDisputes: state.orders.filter(order => order.arbitration?.stage === "open" || order.arbitration?.stage === "reviewing").length,
    turnover: sumMoney(state.orders.map(order => order.money.total)),
    fees: sumMoney(state.orders.map(order => order.money.fee)),
    reviews,
  };
}

export function adminRows(state: Workspace, section: Section, access: Access): Row[] {
  if (!visibleSections[access].includes(section)) return [];
  const account = state.account;
  if (section === "users" || section === "profiles") return account && (section === "users" || account.roles.includes("performer")) ? [{
    id: account.id, kind: section === "users" ? "user" : "profile", title: account.name,
    description: [account.id, account.university, account.roles.map(roleName).join(" · ")].filter(Boolean).join(" · "),
    status: account.roles.includes("performer") ? account.moderation : "registered",
    statusText: account.roles.includes("performer") ? moderationLabels[account.moderation] : "Зарегистрирован",
    at: section === "profiles" ? account.submittedAt ?? account.createdAt : account.createdAt,
    summary: `${account.examples.length} примеров · ${ratingFor(state, account.id).completed} завершённых заказов`, roles: account.roles,
  }] : [];
  if (section === "services") return state.services.map(service => ({
    id: String(service.id), kind: "service", title: service.title, description: `${service.performerName} · ${service.category}`,
    status: service.status, statusText: moderationLabels[service.status], at: service.createdAt,
    summary: `${rubles(service.price)} · ${service.days} дн. · Редакция ${service.revision}`, roles: [],
  }));
  if (section === "orders" || section === "finance" || section === "disputes") return state.orders.filter(order => section !== "disputes" || order.arbitration).map(order => ({
    id: order.id, kind: section === "disputes" ? "dispute" : "order", title: order.serviceTitle,
    description: section === "finance" ? order.id : `${order.customerName} → ${order.performerName}`,
    status: section === "disputes" ? order.arbitration!.stage : order.status,
    statusText: section === "disputes" ? disputeLabels[order.arbitration!.stage] : statusLabels[order.status], at: order.createdAt,
    summary: `${rubles(order.money.total)} · ${order.days} дн.${order.arbitration ? " · Есть обращение" : ""}`, roles: [],
  }));
  if (section === "reviews") return adminMetrics(state).reviews.map(review => ({
    id: review.id, kind: "review", title: `${review.rating} из 5 · ${review.author}`, description: review.text || "Без текстового комментария",
    status: "published", statusText: "Допустимый отзыв", at: review.at,
    summary: `Заказ ${review.orderId}`, roles: [],
  }));
  if (section === "events") return state.adminEvents.filter(event => eventAllowed(event, access)).map(event => ({
    id: event.id, kind: "event", title: `${event.type === "profile" ? "Профиль" : "Услуга"}: ${moderationLabels[event.decision]}`,
    description: event.reason || "Без дополнительного комментария", status: event.decision, statusText: moderationLabels[event.decision], at: event.at,
    summary: `${event.targetId} · ${event.actorId}`, roles: [],
  }));
  return [];
}

export function filterAdminRows(rows: Row[], view: View, globalQuery = ""): Row[] {
  const queries = [view.query, globalQuery].map(value => value.trim().toLocaleLowerCase("ru"));
  return rows.filter(row => (!view.status || row.status === view.status) && (!view.role || row.roles.includes(view.role)) && withinPeriod(row.at, view.from, view.to) && queries.every(query => !query || [row.id, row.title, row.description, row.summary].join(" ").toLocaleLowerCase("ru").includes(query)))
    .sort((a, b) => view.sort === "name" ? a.title.localeCompare(b.title, "ru") : view.sort === "old" ? a.at - b.at : b.at - a.at);
}

function Empty({ title = "Пока нет записей", children }: { title?: string; children?: ReactNode }) {
  return <div className={styles.empty}><Icon name="grid" size={28} /><h3>{title}</h3><p>{children || "Здесь появятся данные из единого Demo workspace. Отдельные записи для админки не создаются."}</p></div>;
}
function Metric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return <div className={styles.metric}><span>{label}</span><strong>{value}</strong>{hint && <small>{hint}</small>}</div>;
}
function Status({ value, children }: { value: string; children: ReactNode }) {
  return <span className={styles.status} data-status={value}>{children}</span>;
}

function UserAvatar({ name, assetId }: { name: string; assetId?: string }) {
  const { getAsset } = useDemoWorkspace();
  const [image, setImage] = useState<{ id: string; url: string } | null>(null);
  useEffect(() => {
    if (!assetId) return;
    let live = true, url = "";
    getAsset(assetId).then(blob => {
      if (!live || !blob || !blob.type.startsWith("image/")) return;
      url = URL.createObjectURL(blob);
      if (live) setImage({ id: assetId, url });
    }).catch(() => { /* Initials remain visible if the optional local avatar is unavailable. */ });
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [assetId, getAsset]);
  return <span className={styles.personAvatar} aria-hidden="true">{image && image.id === assetId
    // Local object URLs do not require remote Next image configuration.
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={image.url} alt="" /> : name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join("")}</span>;
}

export default function AdminWorkspace() {
  const workspace = useDemoWorkspace();
  const [started, setStarted] = useState(false);
  if (!workspace.sandboxEnabled) return <section className={`page-panel ${styles.entry}`}><Icon name="user" size={32} /><h1>Административный sandbox закрыт</h1><p>Он доступен только при явно включённой сборке для демонстрации. Роли обычного аккаунта не дают административных прав.</p><Link className="page-button-secondary" href="/profile">Вернуться в кабинет</Link></section>;
  if (!workspace.ready && !workspace.error) return <section className={`page-panel ${styles.entry}`} aria-busy="true"><h1>Загружаем тестовое рабочее место</h1><div className={styles.skeleton} aria-hidden="true"><span /><span /><span /></div><p role="status">Восстанавливаем единое локальное состояние…</p></section>;
  if (!workspace.state) return <section className={`page-panel ${styles.entry}`}><h1>Не удалось открыть Demo</h1><p role="alert">{workspace.error || "Локальное состояние недоступно."}</p><button type="button" className="page-button-secondary" onClick={workspace.retry}>Повторить загрузку</button></section>;
  if (!started) return <section className={`page-panel ${styles.entry}`}><span className={styles.sandboxLabel}>DEMO · ADMIN SANDBOX</span><Icon name="grid" size={36} /><h1>Рабочее место модератора</h1><p>Это отдельная тестовая среда. Решения изменяют те же локальные заявки и услуги, что видны в Demo-кабинете исполнителя.</p><p className="page-muted">Вход сюда не делает ваш аккаунт сотрудником STUDLY. Настоящая административная авторизация и Live-операции недоступны.</p><button type="button" className="page-button" onClick={() => setStarted(true)}>Открыть тестовое рабочее место <Icon name="arrow" /></button><Link href="/profile" className="page-button-secondary">Вернуться в кабинет</Link></section>;
  return <AdminSession workspace={workspace} state={workspace.state} onExit={() => setStarted(false)} />;
}

function AdminSession({ workspace, state, onExit }: { workspace: ReturnType<typeof useDemoWorkspace>; state: Workspace; onExit: () => void }) {
  const [section, setSection] = useState<Section>("dashboard");
  const [access, setAccess] = useState<Access>("all");
  const [views, setViews] = useState(initialViews);
  const [globalQuery, setGlobalQuery] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [compact, setCompact] = useState(false);
  const [selected, setSelected] = useState<Row | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DecisionDraft>>({});
  const [confirmation, setConfirmation] = useState<{ target: Row; draft: DecisionDraft; revision: number; actionId: string } | null>(null);
  const [localError, setLocalError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const metrics = useMemo(() => adminMetrics(state), [state]);
  const available = sections.filter(item => visibleSections[access].includes(item.id));
  const view = views[section];
  const rows = adminRows(state, section, access);
  const filtered = filterAdminRows(rows, view, globalQuery);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(view.page, pageCount);
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const heading = sections.find(item => item.id === section)!;
  const canProfiles = access === "all" || access === "profiles";
  const canServices = access === "all" || access === "services";
  const canSupport = access === "all" || access === "support";
  const canFinance = access === "all" || access === "finance";
  const draftKey = selected ? `${selected.kind}:${selected.id}` : "";
  const decisionDraft = drafts[draftKey] ?? { decision: "approved" as const, reason: "" };
  const account = selected && (selected.kind === "user" || selected.kind === "profile") && state.account?.id === selected.id ? state.account : null;
  const service = selected?.kind === "service" ? state.services.find(item => String(item.id) === selected.id) : undefined;
  const order = selected && (selected.kind === "order" || selected.kind === "dispute") ? state.orders.find(item => item.id === selected.id) : undefined;
  const review = selected?.kind === "review" ? metrics.reviews.find(item => item.id === selected.id) : undefined;
  const event = selected?.kind === "event" ? state.adminEvents.find(item => item.id === selected.id) : undefined;
  const decisionTarget = selected?.kind === "profile" && canProfiles && account?.moderation === "pending" || selected?.kind === "service" && canServices && service?.status === "pending";
  const approvalBlocked = selected?.kind === "service" && (state.account?.id !== service?.performerId || state.account?.moderation !== "approved");
  useEffect(() => {
    if (selected && !dialog.current?.open) dialog.current?.showModal();
    if (!selected && dialog.current?.open) dialog.current.close();
  }, [selected]);
  function changeSection(next: Section) { if (visibleSections[access].includes(next)) { setSection(next); setSelected(null); setConfirmation(null); setLocalError(""); } }
  function updateView(patch: Partial<View>) { setViews(current => ({ ...current, [section]: { ...current[section], ...patch, ...(patch.page === undefined ? { page: 1 } : {}) } })); }
  function editDecision(patch: Partial<DecisionDraft>) { setDrafts(current => ({ ...current, [draftKey]: { ...decisionDraft, ...patch } })); setConfirmation(null); setLocalError(""); }
  function proposeDecision() {
    if (!selected || !decisionTarget || workspace.busy) return;
    if (decisionDraft.decision !== "approved" && !decisionDraft.reason.trim()) { setLocalError("Укажите причину, чтобы исполнитель понимал, что нужно исправить."); return; }
    if (decisionDraft.decision === "approved" && approvalBlocked) { setLocalError("Сначала необходимо одобрить профиль исполнителя."); return; }
    setConfirmation({ target: selected, draft: { ...decisionDraft, reason: decisionDraft.reason.trim() }, revision: state.revision, actionId: `admin-${crypto.randomUUID()}` });
  }
  async function confirmDecision() {
    if (!confirmation || workspace.busy) return;
    if (!decisionTarget || confirmation.revision !== state.revision) { setLocalError("Данные изменились. Повторно просмотрите заявку перед решением."); setConfirmation(null); return; }
    try {
      const { target, draft, actionId } = confirmation;
      if (target.kind === "profile" && canProfiles) await workspace.run({ type: "profile.decide", decision: draft.decision, reason: draft.reason }, { actor: { id: MODERATOR, role: "moderator" }, actionId, expectedRevision: confirmation.revision });
      else if (target.kind === "service" && canServices) await workspace.run({ type: "service.decide", id: Number(target.id), decision: draft.decision, reason: draft.reason }, { actor: { id: MODERATOR, role: "moderator" }, actionId, expectedRevision: confirmation.revision });
      else throw new Error("Для этого решения не выбрано доступное тестовое представление.");
      setDrafts(current => { const next = { ...current }; delete next[`${target.kind}:${target.id}`]; return next; });
      setConfirmation(null); setLocalError("");
    } catch (error) { setLocalError(error instanceof Error ? error.message : "Решение не сохранено. Проверьте состояние перед повтором."); }
  }
  const tasks = [
    ...(canProfiles && state.account?.moderation === "pending" ? [{ section: "profiles" as Section, text: "Профиль ожидает проверки" }] : []),
    ...(canServices && metrics.pendingServices ? [{ section: "services" as Section, text: `Услуг на проверке: ${metrics.pendingServices}` }] : []),
    ...(canSupport && metrics.openDisputes ? [{ section: "disputes" as Section, text: `Открытых модельных обращений: ${metrics.openDisputes}` }] : []),
  ];
  const globalMatches = globalQuery.trim() ? available.filter(item => adminRows(state, item.id, access).length).map(item => ({ ...item, count: filterAdminRows(adminRows(state, item.id, access), initialView(), globalQuery).length })).filter(item => item.count) : [];

  function renderTable() {
    const statuses = section === "profiles" || section === "services" ? Object.entries(moderationLabels) : [...new Map(rows.map(row => [row.status, row.statusText])).entries()];
    return <>
      {(section === "profiles" || section === "services") && <div className={styles.queueTabs} role="group" aria-label="Очереди модерации"><button type="button" aria-pressed={!view.status} onClick={() => updateView({ status: "" })}>Все</button>{statuses.map(([value, label]) => <button type="button" aria-pressed={view.status === value} key={value} onClick={() => updateView({ status: value })}>{label}</button>)}</div>}
      <div className={styles.filters}>
        <label className={styles.searchField}>Поиск в разделе<input type="search" value={view.query} onChange={event => updateView({ query: event.target.value })} placeholder="Название, имя или ID" /></label>
        <label>Статус<select value={view.status} onChange={event => updateView({ status: event.target.value })}><option value="">Все состояния</option>{statuses.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        {section === "users" && <label>Роль<select value={view.role} onChange={event => updateView({ role: event.target.value })}><option value="">Все роли</option><option value="customer">Заказчик</option><option value="performer">Исполнитель</option></select></label>}
        <label>С даты<input type="date" value={view.from} max={view.to || undefined} onChange={event => updateView({ from: event.target.value })} /></label>
        <label>По дату<input type="date" value={view.to} min={view.from || undefined} onChange={event => updateView({ to: event.target.value })} /></label>
        <label>Сортировка<select value={view.sort} onChange={event => updateView({ sort: event.target.value as View["sort"] })}><option value="new">Сначала новые</option><option value="old">Сначала старые</option><option value="name">По названию</option></select></label>
      </div>
      <div className={styles.tableSummary}><span role="status">Показано {filtered.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filtered.length)} из {filtered.length}</span><button type="button" className={styles.textButton} onClick={() => { setViews(current => ({ ...current, [section]: initialView() })); setGlobalQuery(""); }}>Сбросить фильтры</button></div>
      {!filtered.length ? <Empty title={rows.length ? "По этим условиям ничего не найдено" : "В этом разделе пока пусто"}>{rows.length ? "Измените поиск или фильтры. Записи не удалены." : undefined}</Empty> : <table className={styles.table}><thead><tr><th scope="col">Запись</th><th scope="col">Состояние</th><th scope="col">Дата · MSK</th><th scope="col">Сведения</th><th scope="col"><span className="sr-only">Действия</span></th></tr></thead><tbody>{paged.map(row => <tr key={`${row.kind}:${row.id}`}><td data-label="Запись">{row.kind === "user" && state.account && <UserAvatar name={state.account.name} assetId={state.account.avatarAssetId} />}<strong>{row.title}</strong><small>{row.description}</small><code>{row.id}</code></td><td data-label="Состояние"><Status value={row.status}>{row.statusText}</Status></td><td data-label="Дата · MSK">{date(row.at)}</td><td data-label="Сведения">{row.summary}</td><td data-label="Действия"><button type="button" className={styles.outlineButton} aria-label={`Открыть: ${row.title}`} onClick={() => { setSelected(row); setConfirmation(null); setLocalError(""); }}>Подробнее <Icon name="arrow" size={16} /></button></td></tr>)}</tbody></table>}
      {filtered.length > pageSize && <nav className={styles.paging} aria-label="Страницы административного списка"><button type="button" disabled={page === 1} onClick={() => updateView({ page: page - 1 })}>Назад</button><span>Страница {page} из {pageCount}</span><button type="button" disabled={page === pageCount} onClick={() => updateView({ page: page + 1 })}>Далее</button></nav>}
    </>;
  }

  return <div className={styles.admin} data-density={compact ? "compact" : "comfortable"}>
    <aside className={styles.sidebar}><span className={styles.sandboxLabel}>STUDLY · УПРАВЛЕНИЕ</span><strong className={styles.sidebarTitle}>Ясный порядок.</strong><p>Тестовое рабочее место</p><nav aria-label="Разделы административного sandbox">{available.map(item => <button key={item.id} type="button" aria-current={section === item.id ? "page" : undefined} onClick={() => changeSection(item.id)}><Icon name={item.icon} /><span>{item.label}</span>{item.id === "profiles" && metrics.pendingProfiles > 0 && <b>{metrics.pendingProfiles}</b>}{item.id === "services" && metrics.pendingServices > 0 && <b>{metrics.pendingServices}</b>}</button>)}</nav><div className={styles.sidebarFooter}><Icon name="user" /><span>Demo-модератор<small>Не серверная роль</small></span></div></aside>
    <div className={styles.content}>
      <div className={styles.topbar}><div><p className={styles.eyebrow}>ADMIN SANDBOX · DEMO</p><h1>{heading.label}</h1></div><div className={styles.topActions}><details className={styles.notifications}><summary aria-label={`Задачи, требующие внимания: ${tasks.length}`}><Icon name="bell" />{tasks.length > 0 && <b>{tasks.length}</b>}</summary><div className={styles.notificationsPanel}><strong>Требует внимания</strong>{tasks.length ? tasks.map(task => <button key={task.section} type="button" onClick={event => { changeSection(task.section); event.currentTarget.closest("details")?.removeAttribute("open"); }}>{task.text}<Icon name="arrow" size={16} /></button>) : <p>Нет доступных задач в выбранном представлении.</p>}</div></details><button type="button" className={styles.outlineButton} onClick={() => { if (!Object.keys(drafts).length || window.confirm("Есть незавершённое решение. Выйти и закрыть его без сохранения?")) onExit(); }}>Закрыть sandbox</button></div></div>
      <div className={styles.scopeBar}><span><strong>Изолированные локальные данные.</strong> Все суммы — симуляция. Реальные аккаунты и деньги не изменяются.</span><label>Представление прав<select value={access} onChange={event => { setAccess(event.target.value as Access); setSection("dashboard"); setSelected(null); setConfirmation(null); setGlobalQuery(""); }}>{Object.entries(accessLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>
      <label className={styles.mobileNavigation}>Раздел<select value={section} onChange={event => changeSection(event.target.value as Section)}>{available.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <div className={styles.globalSearch}><Icon name="search" /><label className="sr-only" htmlFor="admin-global-search">Поиск по доступным административным данным</label><input id="admin-global-search" type="search" value={globalQuery} onChange={event => { setGlobalQuery(event.target.value); updateView({ page: 1 }); }} placeholder="Поиск по доступным разделам…" />{globalQuery && <button type="button" aria-label="Очистить глобальный поиск" onClick={() => setGlobalQuery("")}><Icon name="close" /></button>}</div>
      {globalQuery.trim() && <div className={styles.searchResults} role="status">{globalMatches.length ? globalMatches.map(item => <button key={item.id} type="button" onClick={() => changeSection(item.id)}>{item.label} <b>{item.count}</b></button>) : <span>В доступных данных совпадений нет. Частные сообщения в поиск не включены.</span>}</div>}
      {(workspace.error || localError) && <p className={styles.error} role="alert">{localError || workspace.error}</p>}
      {workspace.notice && <p className={styles.success} role="status">{workspace.notice}</p>}
      {Object.keys(drafts).length > 0 && <p className={styles.note}>Незавершённых решений: {Object.keys(drafts).length}. Причины сохраняются при переходе между разделами до закрытия sandbox.</p>}

      {section === "dashboard" ? <>
        <div className={styles.metrics}>
          {canProfiles && <><Metric label="Пользователей в workspace" value={metrics.users} /><Metric label="Заказчиков" value={metrics.customers} /><Metric label="Исполнителей" value={metrics.performers} /><Metric label="Профилей на модерации" value={metrics.pendingProfiles} /></>}
          {canServices && <Metric label="Услуг на модерации" value={metrics.pendingServices} />}
          {canSupport && <><Metric label="Активных Demo-заказов" value={metrics.activeOrders} /><Metric label="Завершённых заказов" value={metrics.completedOrders} /><Metric label="Открытых обращений" value={metrics.openDisputes} /><Metric label="Жалобы на проверке" value="—" hint="Модель жалоб не подключена" /></>}
          {canFinance && <><Metric label="Оборот примеров" value={displayMoney(metrics.turnover)} hint="Не выручка и не реальные платежи" /><Metric label="Комиссия в примерах" value={displayMoney(metrics.fees)} hint="Сумма сохранённых снимков" /></>}
        </div>
        <section className={styles.panel}><h2>Быстрые переходы</h2><div className={styles.quickActions}>{tasks.map(task => <button type="button" key={task.section} onClick={() => changeSection(task.section)}>{task.text}<Icon name="arrow" /></button>)}{canSupport && <button type="button" onClick={() => changeSection("security")}>Жалобы и безопасность <Icon name="arrow" /></button>}{visibleSections[access].includes("events") && <button type="button" onClick={() => changeSection("events")}>История решений <Icon name="arrow" /></button>}</div>{!tasks.length && <p className={styles.muted}>Новых заявок в этом представлении нет. Создайте и отправьте профиль или услугу из обычного Demo-кабинета.</p>}</section>
        <section className={styles.panel}><h2>Последняя активность</h2><div className={styles.timeline}>{state.adminEvents.filter(item => eventAllowed(item, access)).slice(-5).reverse().map(item => <div key={item.id}><Icon name="clock" /><span><strong>{item.type === "profile" ? "Профиль" : "Услуга"} · {moderationLabels[item.decision]}</strong><small>{date(item.at)} · {item.actorId}</small>{item.reason && <p>{item.reason}</p>}</span></div>)}</div>{!state.adminEvents.some(item => eventAllowed(item, access)) && <Empty title="История решений пока пуста">Здесь появятся решения Demo-модератора. Новые заявки доступны через уведомления выше.</Empty>}</section>
      </> : section === "security" ? <section className={styles.panel}><span className={styles.sandboxLabel}>ПРОЕКТНОЕ ПРЕДСТАВЛЕНИЕ</span><h2>Жалобы и критические фразы</h2><p className={styles.muted}>Серверных проверок переписки и источника жалоб пока нет. Список ниже описывает будущие типы проверки, а не обнаруженные нарушения.</p><div className={styles.policyGrid}>{["Жалоба на пользователя", "Жалоба на услугу", "Жалоба на сообщение", "Внешняя оплата", "Передача контактов", "Обход платформы"].map(label => <div key={label}><Icon name="filter" /><strong>{label}</strong><small>События не подключены</small></div>)}</div><Empty title="Обращения не подключены">Алгоритмическая проверка критических фраз планируется для STUDLY 2.0. AI-модерация отложена до STUDLY 3.0. Упоминание Telegram само по себе не считается нарушением.</Empty><p className={styles.notice}>Нет доступа к общей ленте частной переписки. Будущий доступ к контексту должен быть ограничен конкретным обращением и серверным полномочием.</p><div className={styles.disabledActions}><button type="button" disabled>Рассмотреть жалобу</button><button type="button" disabled>Принять обжалование</button><button type="button" disabled>Ограничить аккаунт</button></div><p className={styles.muted}>Решения, основания, сроки и санкции ожидают продуктового утверждения и Backend.</p></section>
      : section === "settings" ? <section className={styles.panel}><h2>Настройки рабочего места</h2><div className={styles.settingsGrid}><label>Записей на странице<select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setViews(current => Object.fromEntries(Object.entries(current).map(([key, value]) => [key, { ...value, page: 1 }])) as Record<Section, View>); }}><option value={5}>5</option><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label><label className={styles.checkLabel}><input type="checkbox" checked={compact} onChange={event => setCompact(event.target.checked)} />Компактные таблицы</label></div><p className={styles.muted}>Светлая и тёмная темы общие для STUDLY. Переключатель темы находится в верхней панели приложения.</p><h2>Политики · только просмотр</h2><dl className={styles.facts}><div><dt>Новые Demo-заказы</dt><dd>5% от услуги и дополнений, HALF_UP до копейки</dd></div><div><dt>Исторические суммы</dt><dd>Сохраняют исходный снимок без пересчёта</dd></div><div><dt>Публикация</dt><dd>Одобренный профиль с примерами работ и отдельное одобрение услуги</dd></div><div><dt>Отзывы</dt><dd>Один неизменяемый отзыв после допустимого завершённого заказа</dd></div><div><dt>Арбитраж и санкции</dt><dd>Полномочия и последствия не утверждены</dd></div></dl><h2>Сотрудники и полномочия</h2><p className={styles.muted}>Переключатель представления демонстрирует возможное разделение обязанностей. Это предложение для UI, не серверный RBAC. Выдать реальные права или создать сотрудника здесь нельзя.</p></section>
      : section === "analytics" ? <section className={styles.panel}><h2>Аналитика локальных сценариев</h2><div className={styles.filters}><label>С даты<input type="date" value={view.from} max={view.to || undefined} onChange={event => updateView({ from: event.target.value })} /></label><label>По дату<input type="date" value={view.to} min={view.from || undefined} onChange={event => updateView({ to: event.target.value })} /></label></div><div className={styles.metrics}><Metric label="Регистраций" value={state.account && withinPeriod(state.account.createdAt, view.from, view.to) ? 1 : 0} /><Metric label="Новых услуг" value={state.services.filter(item => withinPeriod(item.createdAt, view.from, view.to)).length} /><Metric label="Заказов" value={state.orders.filter(item => withinPeriod(item.createdAt, view.from, view.to)).length} /><Metric label="Средняя допустимая оценка" value={metrics.reviews.filter(item => withinPeriod(item.at, view.from, view.to)).length ? (metrics.reviews.filter(item => withinPeriod(item.at, view.from, view.to)).reduce((sum, item) => sum + item.rating, 0) / metrics.reviews.filter(item => withinPeriod(item.at, view.from, view.to)).length).toFixed(1) : "—"} /></div><h3>Заказы по статусам</h3>{state.orders.some(item => withinPeriod(item.createdAt, view.from, view.to)) ? <div className={styles.bars}>{Object.entries(statusLabels).map(([key, label]) => { const count = state.orders.filter(item => item.status === key && withinPeriod(item.createdAt, view.from, view.to)).length; return <div key={key}><span>{label}</span><span className={styles.barTrack} aria-hidden="true"><span style={{ width: `${count / Math.max(1, state.orders.filter(item => withinPeriod(item.createdAt, view.from, view.to)).length) * 100}%` }} /></span><strong>{count}</strong></div>; })}</div> : <Empty title="Недостаточно данных для графика">В выбранном периоде нет Demo-заказов.</Empty>}<p className={styles.note}>Показатели рассчитаны из сохранённых записей. Активность переписки и неподтверждённые показатели не моделируются.</p></section>
      : <section className={styles.panel}>
        {section === "finance" && <><p className={styles.notice}>Все данные ниже — локальные симуляции, не финансовая отчётность STUDLY. Суммы взяты из снимков заказов и не пересчитываются по новой ставке.</p><div className={styles.metrics}><Metric label="Итоги отфильтрованных примеров" value={displayMoney(sumMoney(filtered.map(row => state.orders.find(order => order.id === row.id)?.money.total ?? 0)))} /><Metric label="Комиссия в этих примерах" value={displayMoney(sumMoney(filtered.map(row => state.orders.find(order => order.id === row.id)?.money.fee ?? 0)))} /></div></>}
        {section === "disputes" && <><p className={styles.notice}>Модельные материалы обращения доступны в карточке заказа. Открытие, решения арбитра, возвраты и сроки не выполняются.</p>{!rows.length && <div className={styles.policyGrid}>{["Обсуждение замечаний", "Открытый спор", "Рассмотрение арбитром", "Решение арбитража"].map(label => <div key={label}><strong>{label}</strong><small>Проектный сценарий · действие недоступно</small></div>)}</div>}</>}
        {section === "reviews" && <p className={styles.note}>Только допустимые отзывы на завершённые заказы внутри workspace. Редактирование и удаление пользовательского текста недоступны.</p>}
        {renderTable()}
        {section === "finance" && <><h3>Тарифы в сохранённых снимках</h3>{state.orders.length ? <div className={styles.tags}>{[...new Set(state.orders.map(order => `${order.money.policy} · ${order.money.feePercent}%`))].map(tariff => <span key={tariff}>{tariff}</span>)}</div> : <p className={styles.muted}>Заказов для истории тарифов пока нет.</p>}<p className={styles.muted}>Статусы настоящих платежей, выплаты и история возвратов не подключены. Редактировать тариф или переводить деньги из этого интерфейса нельзя.</p></>}
      </section>}
      <p className={styles.footerNote}>Demo workspace · revision {state.revision} · timestamps MSK · Административные решения Live создаёт только Backend.</p>
    </div>

    <dialog ref={dialog} className={styles.dialog} aria-labelledby="admin-detail-title" onClose={() => { setSelected(null); setConfirmation(null); }} onClick={event => { if (event.target === event.currentTarget && !confirmation) { setSelected(null); } }}>
      <div className={styles.dialogHeader}><div><p className={styles.eyebrow}>DEMO · КАРТОЧКА ЗАПИСИ</p><h2 id="admin-detail-title">{selected?.title || "Подробности"}</h2></div><button type="button" className={styles.closeButton} aria-label="Закрыть карточку" onClick={() => setSelected(null)}><Icon name="close" /></button></div>
      {selected && <div className={styles.dialogContent}>
        <code>{selected.id}</code>
        {account && <><div className={styles.personHeading}><UserAvatar name={account.name} assetId={account.avatarAssetId} /><div><strong>{account.name}</strong><small>{account.roles.map(roleName).join(" · ")}</small></div><Status value={account.moderation}>{moderationLabels[account.moderation]}</Status></div><dl className={styles.facts}><div><dt>Университет</dt><dd>{account.university || "Не указан"}</dd></div><div><dt>Город</dt><dd>{account.city || "Не указан"}</dd></div><div><dt>Дата регистрации</dt><dd>{date(account.createdAt)}</dd></div><div><dt>Дата подачи</dt><dd>{account.submittedAt ? date(account.submittedAt) : "Не отправлен"}</dd></div><div><dt>Статус аккаунта</dt><dd>Зарегистрирован в Demo; ограничения не моделируются</dd></div></dl><h3>О себе</h3><p className={styles.prose}>{account.about || "Не заполнено"}</p><h3>Профиль исполнителя</h3><p className={styles.prose}>{account.description || "Описание не добавлено"}</p><p className={styles.muted}>Подтверждённые серверные специализации в этой локальной карточке не доступны.</p><h3>Примеры работ</h3>{account.examples.length ? <div className={styles.examples}>{account.examples.map(example => <div key={example.id}><strong>{example.title}</strong><AssetPreview example={example} /></div>)}</div> : <p className={styles.muted}>Примеры работ не добавлены.</p>}{account.moderationReason && <p className={styles.notice}>Причина решения: {account.moderationReason}</p>}<h3>Связанные услуги</h3>{state.services.filter(item => item.performerId === account.id).map(item => <button type="button" key={item.id} className={styles.relatedButton} onClick={() => { if (canServices) { setSelected(adminRows(state, "services", access).find(row => row.id === String(item.id))!); setConfirmation(null); } }} disabled={!canServices}>{item.title}<Status value={item.status}>{moderationLabels[item.status]}</Status></button>)}{!state.services.some(item => item.performerId === account.id) && <p className={styles.muted}>Услуг пока нет.</p>}<h3>Подтверждённая Demo-активность</h3><p>{ratingFor(state, account.id).completed} завершённых заказов · {ratingFor(state, account.id).count ? `${ratingFor(state, account.id).average!.toFixed(1)} / 5 · ${ratingFor(state, account.id).count} отзывов` : "Нет допустимых отзывов"}</p>{canSupport ? <><h3>История заказов</h3>{state.orders.filter(item => item.customerId === account.id || item.performerId === account.id).map(item => <button key={item.id} type="button" className={styles.relatedButton} onClick={() => setSelected(adminRows(state, "orders", access).find(row => row.id === item.id) ?? null)}>{item.serviceTitle}<Status value={item.status}>{statusLabels[item.status]}</Status></button>)}{!state.orders.some(item => item.customerId === account.id || item.performerId === account.id) && <p className={styles.muted}>Связанных заказов пока нет.</p>}<h3>Допустимые отзывы об исполнителе</h3>{ratingFor(state, account.id).reviews.map(item => <div className={styles.notice} key={item.id}><strong>{item.rating} из 5 · {item.author}</strong><p>{item.text || "Без комментария"}</p></div>)}{!ratingFor(state, account.id).count && <p className={styles.muted}>Отзывов пока нет.</p>}</> : <p className={styles.note}>История заказов и переписка не входят в это представление профиля.</p>}{canProfiles && selected.kind === "user" && account.roles.includes("performer") && <button className={styles.outlineButton} type="button" onClick={() => setSelected(adminRows(state, "profiles", access)[0] ?? null)}>Открыть заявку исполнителя</button>}<h3>История модерации</h3><EventHistory events={state.adminEvents.filter(item => item.type === "profile" && item.targetId === account.id)} /><button type="button" disabled className={styles.outlineButton}>Ограничение аккаунта не подключено</button></>}
        {service && <><Status value={service.status}>{moderationLabels[service.status]}</Status><dl className={styles.facts}><div><dt>Исполнитель</dt><dd>{service.performerName}</dd></div><div><dt>Категория</dt><dd>{service.category}</dd></div><div><dt>Стоимость услуги</dt><dd>{rubles(service.price)}</dd></div><div><dt>Срок</dt><dd>{service.days} дн.</dd></div><div><dt>Редакция</dt><dd>{service.revision}</dd></div></dl><h3>Описание</h3><p className={styles.prose}>{service.description}</p><h3>Состав услуги</h3><ul>{service.included.map((item, index) => <li key={index}>{item}</li>)}</ul><h3>Дополнения</h3>{service.extras.length ? <ul>{service.extras.map(extra => <li key={extra.id}>{extra.title} · +{rubles(extra.price)} · +{extra.extraDays} дн.</li>)}</ul> : <p className={styles.muted}>Дополнений нет.</p>}<h3>Связанные примеры</h3><div className={styles.examples}>{state.account?.examples.filter(example => service.exampleIds.includes(example.id)).map(example => <div key={example.id}><strong>{example.title}</strong><AssetPreview example={example} /></div>)}</div>{!service.exampleIds.length && <p className={styles.muted}>Примеры не выбраны.</p>}<p className={styles.note}>Профиль исполнителя: {state.account?.id === service.performerId ? moderationLabels[state.account.moderation] : "Нет доступных данных"}</p>{canProfiles && state.account?.id === service.performerId && <button type="button" className={styles.outlineButton} onClick={() => setSelected(adminRows(state, "profiles", access)[0] ?? null)}>Проверить профиль</button>}{service.reason && <p className={styles.notice}>Причина решения: {service.reason}</p>}<h3>Предпросмотр карточки</h3><div className={styles.servicePreview}><span>{service.category}</span><h3>{service.title}</h3><p>{service.description}</p><strong>{rubles(service.price)}</strong><small>{service.days} дн. · {service.performerName}</small></div>{service.status === "approved" && <Link className={styles.outlineButton} href={`/service/${service.id}`}>Открыть опубликованную Demo-услугу <Icon name="arrow" /></Link>}<h3>История решений</h3><EventHistory events={state.adminEvents.filter(item => item.type === "service" && item.targetId === String(service.id))} /></>}
        {order && <><Status value={order.status}>{statusLabels[order.status]}</Status><p className={styles.notice}>Симуляция. Реального списания денег нет.</p><dl className={styles.facts}><div><dt>Основная услуга</dt><dd>{rubles(order.money.base)}</dd></div><div><dt>Дополнения</dt><dd>{rubles(order.money.extras)}</dd></div><div><dt>Промежуточная сумма</dt><dd>{rubles(order.money.subtotal)}</dd></div><div><dt>Комиссия в снимке · {order.money.feePercent}%</dt><dd>{rubles(order.money.fee)}</dd></div><div><dt>Итого в снимке</dt><dd>{rubles(order.money.total)}</dd></div><div><dt>Политика расчёта</dt><dd>{order.money.policy}</dd></div><div><dt>Срок выполнения</dt><dd>{order.days} дн.</dd></div><div><dt>Создан</dt><dd>{date(order.createdAt)}</dd></div></dl>{canSupport && <><h3>Участники</h3><p>{order.customerName} → {order.performerName}</p><h3>Состав заказа</h3><p>{order.serviceTitle}</p>{order.selectedExtras.length ? <ul>{order.selectedExtras.map(extra => <li key={extra.id}>{extra.title} · {rubles(extra.price)}</li>)}</ul> : <p className={styles.muted}>Дополнения не выбраны.</p>}<h3>Позиция исполнителя / результат</h3><p className={styles.prose}>{order.result || "Результат не передан."}</p><h3>Позиция заказчика / замечания</h3><p className={styles.prose}>{order.remarks || "Замечания не переданы."}</p><h3>Обращение</h3>{order.arbitration ? <><Status value={order.arbitration.stage}>{disputeLabels[order.arbitration.stage]}</Status><p>{order.arbitration.reason}</p></> : <p className={styles.muted}>Обращения нет.</p>}<p className={styles.note}>Показаны только сохранённые материалы этого заказа. Частная переписка не открывается. Файлы доказательств и назначение арбитра не подключены.</p><h3>История заказа</h3><ol className={styles.orderHistory}>{order.events.map(item => <li key={item.id}><strong>{item.text}</strong><small>{date(item.at)} · {item.actorId}</small></li>)}</ol></>}<p className={styles.muted}>Ручное изменение статуса, цены, оплаты и возврат денег недоступны.</p>{selected.kind === "dispute" && <div className={styles.disabledActions}><button type="button" disabled>Назначить ответственного</button><button type="button" disabled>Вынести решение</button><button type="button" disabled>Вернуть средства</button></div>}</>}
        {review && <><Status value="published">Допустимый отзыв</Status><h3>{review.rating} из 5</h3><p className={styles.prose}>{review.text || "Без текстового комментария"}</p><dl className={styles.facts}><div><dt>Автор</dt><dd>{review.author}</dd></div><div><dt>Исполнитель</dt><dd>{state.orders.find(item => item.id === review.orderId)?.performerName || review.performerId}</dd></div><div><dt>Заказ</dt><dd>{review.orderId}</dd></div><div><dt>Опубликован</dt><dd>{date(review.at)}</dd></div></dl><p className={styles.note}>Отзыв нельзя редактировать или удалять. При арбитраже зависимые действия заблокированы до утверждения правил.</p><button type="button" disabled className={styles.outlineButton}>Рассмотрение жалобы не подключено</button></>}
        {event && <><Status value={event.decision}>{moderationLabels[event.decision]}</Status><dl className={styles.facts}><div><dt>Объект</dt><dd>{event.type} · {event.targetId}</dd></div><div><dt>Автор</dt><dd>{event.actorId} · отдельный Demo-модератор</dd></div><div><dt>Время</dt><dd>{date(event.at)}</dd></div></dl><h3>Причина решения</h3><p className={styles.prose}>{event.reason || "Не требовалась для этого решения."}</p><p className={styles.note}>Запись сформирована единой Demo-моделью. В Live автора, время и историю подтверждает только Backend.</p></>}
        {decisionTarget && <section className={styles.decision} aria-labelledby="admin-decision-title"><h3 id="admin-decision-title">Решение Demo-модератора</h3><p>Изменит каноническую заявку и будет видно в кабинете исполнителя.</p><label>Действие<select value={decisionDraft.decision} disabled={workspace.busy || !!confirmation} onChange={event => editDecision({ decision: event.target.value as Decision })}><option value="approved">Одобрить{service ? " публикацию услуги" : " профиль"}</option><option value="rejected">Отклонить с причиной</option><option value="changes">Запросить исправления</option></select></label><label>Причина / комментарий{decisionDraft.decision !== "approved" && " · обязательно"}<textarea value={decisionDraft.reason} disabled={workspace.busy || !!confirmation} required={decisionDraft.decision !== "approved"} onChange={event => editDecision({ reason: event.target.value })} placeholder="Понятно объясните, что нужно изменить" /></label>{approvalBlocked && <p className={styles.notice}>Публикация недоступна до одобрения профиля исполнителя.</p>}{confirmation ? <div className={styles.confirmation}><strong>Подтвердить: {moderationLabels[confirmation.draft.decision]}?</strong><p>{confirmation.target.title}</p>{confirmation.draft.reason && <p>{confirmation.draft.reason}</p>}<div className={styles.actionRow}><button type="button" className={styles.primaryButton} disabled={workspace.busy} onClick={() => void confirmDecision()}>{workspace.busy ? "Сохраняем…" : "Подтвердить Demo-решение"}</button><button type="button" className={styles.outlineButton} disabled={workspace.busy} onClick={() => setConfirmation(null)}>Вернуться к проверке</button></div></div> : <button type="button" className={styles.primaryButton} disabled={workspace.busy || decisionDraft.decision === "approved" && approvalBlocked || decisionDraft.decision !== "approved" && !decisionDraft.reason.trim()} onClick={proposeDecision}>Проверить и подтвердить решение</button>}</section>}
        {(localError || workspace.error) && <p className={styles.error} role="alert">{localError || workspace.error}</p>}
        {workspace.notice && <p className={styles.success} role="status">{workspace.notice}</p>}
      </div>}
    </dialog>
  </div>;
}

function EventHistory({ events }: { events: AdminEvent[] }) {
  return events.length ? <ol className={styles.orderHistory}>{events.slice().reverse().map(event => <li key={event.id}><strong>{moderationLabels[event.decision]}</strong><small>{date(event.at)} · {event.actorId}</small>{event.reason && <p>{event.reason}</p>}</li>)}</ol> : <p className={styles.muted}>Решений пока нет.</p>;
}
