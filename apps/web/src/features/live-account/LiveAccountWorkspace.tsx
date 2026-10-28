"use client";

import { Suspense, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Icon } from "@/components/studly/Icon";
import { LiveAccess, LiveState, useLiveResource } from "@/features/live/shared";
import { accountClient, safePortfolioUrl, portfolioContentPath, type LiveAccount, type PerformerModeration, type PortfolioExample, type AccountVersion, type PortfolioPage } from "@/lib/api/account";
import { registrationClient, registrationRevisionAfterSave } from "@/lib/api/registration";
import { ApiError, requestKey } from "@/lib/api/client";
import type { RegistrationResponse } from "@/types/registration-api";
import type { RegistrationRole } from "@/types/registration";
import { useAccountWriter, type AccountWriter } from "./useAccountWriter";
import { createOwnRevisionChain, confirmOwnRevision, type OwnRevisionChain } from "./revisions";
import LiveOwnServices from "@/features/live-services/LiveOwnServices";
import styles from "@/features/demo-workspace/account.module.css";

const moderationLabels = { draft: "Черновик", pending: "На модерации", approved: "Одобрен", rejected: "Отклонён", changes: "Нужны изменения" };
const missingLabels: Record<string, string> = { "roles.performer": "Роль исполнителя", "profile.display_name": "Имя для отображения", "performer.description": "Описание исполнителя", portfolio: "Хотя бы один пример работы" };
const version = (revision: number): AccountVersion => ({ revision, request_key: requestKey() });
type Snapshot = { account: LiveAccount; moderation: PerformerModeration };
const loadSnapshot = (signal: AbortSignal): Promise<Snapshot> => accountClient.snapshot(signal);

function Avatar({ registration, revision }: { registration: RegistrationResponse; revision: number }) {
  return <span className={styles.avatar}>{registration.profile.avatar_url
    ? <Image src={`${registration.profile.avatar_url}?v=${revision}`} width={80} height={80} unoptimized alt="Аватар профиля" />
    : registration.profile.display_name.trim().slice(0, 1).toUpperCase() || <Icon name="user" />}</span>;
}

export function LiveProfileEditor({ snapshot, writer, onDirtyChange, revisions, relatedDirty = false }: { snapshot: Snapshot; writer: AccountWriter; onDirtyChange?: (dirty: boolean) => void; revisions?: OwnRevisionChain; relatedDirty?: boolean }) {
  const registration = snapshot.account.registration;
  const [localRevisions] = useState(createOwnRevisionChain);
  const chain = revisions ?? localRevisions;
  const baseline = useRef<RegistrationResponse | null>(null);
  const base = useRef<number | null>(null);
  const [changes, setChanges] = useState<Partial<Record<"display_name" | "university" | "city" | "about" | "description" | "study_year" | "portfolio", string>>>({});
  const [roles, setRoles] = useState<RegistrationRole[] | null>(null);
  const [specializationIds, setSpecializationIds] = useState<string[] | null>(null);
  const [specializationSearch, setSpecializationSearch] = useState("");
  const specializations = useLiveResource("account-specializations", signal => registrationClient.listSpecializations(signal));
  const [avatarError, setAvatarError] = useState("");
  const [avatarStamp, setAvatarStamp] = useState(0);
  const [validation, setValidation] = useState<{ name?: string; roles?: string }>({});
  const dirty = Object.keys(changes).length > 0 || roles !== null || specializationIds !== null;
  const fields = { ...registration.profile, description: registration.performer?.description ?? "", study_year: registration.performer?.study_year ?? "", portfolio: registration.performer?.portfolio ?? "", ...changes };
  function touched() { if (base.current === null) { base.current = snapshot.moderation.revision; baseline.current = registration; } }
  function edit(key: keyof typeof changes, value: string) {
    touched();
    onDirtyChange?.(true); setValidation({});
    setChanges(current => ({ ...current, [key]: value }));
  }
  function toggleRole(role: RegistrationRole) {
    touched();
    onDirtyChange?.(true); setValidation({});
    const current = roles ?? registration.roles;
    setRoles(current.includes(role) ? current.filter(item => item !== role) : [...current, role]);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty || writer.blocked) return;
    const invalid = registration.status.is_complete ? {
      ...(!fields.display_name.trim() ? { name: "Укажите непустое имя для отображения. Завершённый профиль нельзя сохранить без имени." } : {}),
      ...(!(roles ?? registration.roles).length ? { roles: "Оставьте хотя бы одну роль: заказчик или исполнитель." } : {}),
      ...(relatedDirty && !(roles ?? registration.roles).includes("performer") ? { roles: "Сначала сохраните или отмените правки портфолио, затем отключите роль исполнителя." } : {}),
    } : {};
    setValidation(invalid);
    if (Object.keys(invalid).length) return;
    const profile = Object.fromEntries(Object.entries(changes).filter(([key]) => ["display_name", "university", "city", "about"].includes(key))
      .map(([key, value]) => [key, key === "display_name" ? value.trim() : value]));
    const performer = { ...Object.fromEntries(Object.entries(changes).filter(([key]) => ["description", "study_year", "portfolio"].includes(key))),
      ...(specializationIds ? { specialization_ids: specializationIds } : {}) };
    const inputRevision = chain.resolve(base.current ?? snapshot.moderation.revision);
    const before = baseline.current ?? registration;
    const patch = { performer_revision: inputRevision, ...(roles ? { roles } : {}),
      ...(Object.keys(profile).length ? { profile } : {}), ...(Object.keys(performer).length ? { performer } : {}) };
    if (await writer.execute(async signal => {
      const result = await registrationClient.save(patch, signal);
      await confirmOwnRevision(chain, snapshot.account.id, inputRevision, registrationRevisionAfterSave(before, result, inputRevision), signal);
      return result;
    }, false)) { setChanges({}); setRoles(null); setSpecializationIds(null); base.current = null; baseline.current = null; onDirtyChange?.(false); }
  }
  async function avatar(file: File | null) {
    if (writer.blocked || dirty || relatedDirty) return;
    setAvatarError("");
    if (file && (!file.size || file.size > 5 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(file.type))) {
      setAvatarError("Выберите PNG, JPEG или WebP размером до 5 МиБ."); return;
    }
    // Avatar v1 has no revision field: never advance a dirty text form from a later GET.
    if (await writer.execute(signal => file ? registrationClient.uploadAvatar(file, signal) : registrationClient.deleteAvatar(signal), false)) setAvatarStamp(value => value + 1);
  }
  const selectedRoles = roles ?? registration.roles;
  return <section className={styles.panel} aria-labelledby="live-account-data-title">
    <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Один аккаунт</p><h2 id="live-account-data-title">Данные профиля</h2></div></div>
    {["approved", "pending"].includes(snapshot.moderation.status) && <p className={styles.locked}>Изменение модерируемых данных или аватара отправит профиль на повторную проверку. Услуги будут скрыты до одобрения.</p>}
    <form className={styles.profileForm} onSubmit={save} noValidate>
      <fieldset className={styles.fieldset} disabled={writer.blocked}>
        <div className={styles.avatarEditor}><Avatar registration={registration} revision={snapshot.moderation.revision + avatarStamp} /><div className={styles.field}><label htmlFor="live-account-avatar">Аватар</label><input id="live-account-avatar" type="file" accept="image/png,image/jpeg,image/webp" disabled={dirty || relatedDirty} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void avatar(file); }} /><p className={styles.hint}>PNG, JPEG или WebP, до 5 МиБ. Сначала сохраните правки профиля и портфолио. После загрузки аватара данные перечитываются с сервера.</p>{registration.profile.avatar_url && <button className={styles.remove} type="button" disabled={dirty || relatedDirty} onClick={() => { void avatar(null); }}>Удалить аватар</button>}</div></div>
        {avatarError && <p className={styles.error} role="alert">{avatarError}</p>}
        <fieldset className={styles.roleFieldset} aria-describedby={validation.roles ? "live-account-roles-error" : undefined}><legend>Роли аккаунта</legend><div className={styles.kindSwitch}>{(["customer", "performer"] as const).map(role => <label key={role}><input type="checkbox" checked={selectedRoles.includes(role)} onChange={() => toggleRole(role)} />{role === "customer" ? "Заказчик" : "Исполнитель"}</label>)}</div><p>Вы можете использовать обе роли. Доступ к разделам и новым действиям подтверждает Django.</p>{validation.roles && <p id="live-account-roles-error" className={styles.error} role="alert">{validation.roles}</p>}</fieldset>
        <div className={styles.field}><label htmlFor="live-account-name">Имя для отображения</label><input id="live-account-name" value={fields.display_name} maxLength={255} autoComplete="nickname" required={registration.status.is_complete} aria-invalid={!!validation.name} aria-describedby={validation.name ? "live-account-name-error" : undefined} onChange={event => edit("display_name", event.target.value)} />{validation.name && <p id="live-account-name-error" className={styles.error} role="alert">{validation.name}</p>}</div>
        <div className={styles.fieldColumns}><div className={styles.field}><label htmlFor="live-account-university">Университет</label><input id="live-account-university" value={fields.university} maxLength={255} onChange={event => edit("university", event.target.value)} /></div><div className={styles.field}><label htmlFor="live-account-city">Город</label><input id="live-account-city" value={fields.city} maxLength={255} autoComplete="address-level2" onChange={event => edit("city", event.target.value)} /></div></div>
        <div className={styles.field}><label htmlFor="live-account-about">О себе</label><textarea id="live-account-about" value={fields.about} maxLength={10000} onChange={event => edit("about", event.target.value)} /></div>
        {(selectedRoles.includes("performer") || registration.performer) && <><div className={styles.field}><label htmlFor="live-account-description">Описание исполнителя</label><textarea id="live-account-description" value={fields.description} maxLength={10000} onChange={event => edit("description", event.target.value)} /></div><div className={styles.field}><label htmlFor="live-account-year">Курс обучения</label><input id="live-account-year" value={fields.study_year} maxLength={100} onChange={event => edit("study_year", event.target.value)} /></div>
          <fieldset className={styles.roleFieldset}><legend>Специализации</legend><div className={styles.field}><label htmlFor="live-account-specialization-search">Найти специализацию</label><input id="live-account-specialization-search" type="search" value={specializationSearch} onChange={event => setSpecializationSearch(event.target.value)} /></div><LiveState loading={specializations.loading} error={specializations.error} retry={specializations.reload} /><div className={styles.kindSwitch}>{(specializations.data ?? registration.performer?.specializations ?? []).filter(item => item.title.toLocaleLowerCase("ru").includes(specializationSearch.trim().toLocaleLowerCase("ru"))).map(item => <label key={item.id}><input type="checkbox" checked={(specializationIds ?? registration.performer?.specializations.map(value => value.id) ?? []).includes(item.id)} onChange={() => {
            touched();
            onDirtyChange?.(true); setValidation({});
            const selected = specializationIds ?? registration.performer?.specializations.map(value => value.id) ?? [];
            setSpecializationIds(selected.includes(item.id) ? selected.filter(value => value !== item.id) : [...selected, item.id]);
          }} />{item.title}</label>)}</div></fieldset>
          <div className={styles.field}><label htmlFor="live-account-portfolio-note">Заметка о портфолио</label><textarea id="live-account-portfolio-note" value={fields.portfolio} maxLength={10000} onChange={event => edit("portfolio", event.target.value)} /><p className={styles.hint}>Примеры для модерации добавляются отдельными работами.</p></div></>}
        <button className={styles.secondary} type="submit" disabled={!dirty}>Сохранить данные профиля</button>
        {dirty && <button className={styles.remove} type="button" onClick={() => { setChanges({}); setRoles(null); setSpecializationIds(null); setValidation({}); base.current = null; baseline.current = null; onDirtyChange?.(false); writer.refresh(); }}>Загрузить актуальные данные (заменит несохранённые правки)</button>}
      </fieldset>
    </form>
    {!registration.status.is_complete && <p className={styles.hint}>Общая регистрация ещё не завершена. <Link className={styles.textLink} href="/register/roles">Продолжить регистрацию</Link></p>}
  </section>;
}

function ModerationPanel({ moderation, writer, revisions }: { moderation: PerformerModeration; writer: AccountWriter; revisions?: OwnRevisionChain }) {
  const canSubmit = moderation.ready_to_submit && ["draft", "rejected", "changes"].includes(moderation.status);
  return <section className={styles.panel}><p className={styles.eyebrow}>Профиль исполнителя</p><h2>Проверка профиля</h2><span className={styles.status}>{moderationLabels[moderation.status]}</span>
    {moderation.reason && <p className={styles.reason}><strong>Комментарий модератора</strong>{moderation.reason}</p>}
    {moderation.submitted_at && <p className={styles.hint}>Подан: {new Date(moderation.submitted_at).toLocaleString("ru-RU")}</p>}
    {moderation.missing_fields.length > 0 && <ul className={styles.checklist}>{moderation.missing_fields.map(field => <li key={field}>{missingLabels[field] ?? field}</li>)}</ul>}
    {moderation.status === "pending" && <p className={styles.hint}>Решение ещё не принято. Изменения профиля и портфолио будут включены в новую редакцию проверки.</p>}
    {moderation.approved && <p className={styles.hint}>Одобрение подтверждено сервером. Каждая услуга проходит отдельную модерацию.</p>}
    <button className={styles.primary} type="button" disabled={!canSubmit || writer.blocked} onClick={() => { const intent = version(revisions?.resolve(moderation.revision) ?? moderation.revision); void writer.execute(async signal => { const result = await accountClient.submit(intent, signal); if (revisions) await confirmOwnRevision(revisions, moderation.user_id, intent.revision, intent.revision + 1, signal); return result; }); }}>Отправить профиль на модерацию</button>
  </section>;
}

function ExampleEditor({ example, revision, actor, writer, revisions, onDirtyChange }: { example: PortfolioExample; revision: number; actor: number; writer: AccountWriter; revisions?: OwnRevisionChain; onDirtyChange?: (example: PortfolioExample, dirty: boolean) => void }) {
  const [localRevisions] = useState(createOwnRevisionChain);
  const chain = revisions ?? localRevisions;
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(example.title);
  const [url, setUrl] = useState(example.url ?? "");
  const base = useRef(revision);
  const original = useRef(example);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (writer.blocked) return;
    const intent = version(chain.resolve(base.current));
    const before = original.current;
    await writer.execute(async signal => {
      const result = await accountClient.editExample(example.id, { title, ...(example.kind === "link" ? { url } : {}) }, intent, signal);
      const changed = result.example.title !== before.title || result.example.url !== before.url;
      await confirmOwnRevision(chain, actor, intent.revision, intent.revision + (changed ? 1 : 0), signal);
      if (!signal.aborted) { setEditing(false); onDirtyChange?.(before, false); }
      return result;
    });
  }
  return <article className={styles.example}><h3>{example.title}</h3>
    {example.kind === "link" ? <a className={styles.textLink} href={safePortfolioUrl(example.url!)} target="_blank" rel="noopener noreferrer">Открыть работу <Icon name="arrow" /></a>
      : <><a className={styles.textLink} href={portfolioContentPath(example.id, example.content_url!)} download>Скачать приватный файл <Icon name="arrow" /></a><p className={styles.hint}>{example.content_type} · {new Intl.NumberFormat("ru-RU").format(example.size)} байт. Доступ проверяет Django.</p></>}
    {editing ? <form className={styles.exampleForm} onSubmit={save}><fieldset className={styles.fieldset} disabled={writer.blocked}><div className={styles.field}><label htmlFor={`example-title-${example.id}`}>Название работы</label><input id={`example-title-${example.id}`} value={title} required maxLength={200} onChange={event => setTitle(event.target.value)} /></div>{example.kind === "link" && <div className={styles.field}><label htmlFor={`example-url-${example.id}`}>Ссылка</label><input id={`example-url-${example.id}`} type="url" value={url} required maxLength={2000} onChange={event => setUrl(event.target.value)} /></div>}<button className={styles.secondary} type="submit">Сохранить работу</button><button className={styles.remove} type="button" onClick={() => { setEditing(false); onDirtyChange?.(original.current, false); }}>Отменить правки</button></fieldset></form>
      : <div className={styles.compactLinks}><button type="button" className={styles.remove} disabled={writer.blocked} onClick={() => { base.current = revision; original.current = example; setTitle(example.title); setUrl(example.url ?? ""); setEditing(true); onDirtyChange?.(example, true); }}>Изменить работу</button><button type="button" className={styles.remove} disabled={writer.blocked} onClick={() => { const intent = version(chain.resolve(revision)); void writer.execute(async signal => { const result = await accountClient.deleteExample(example.id, intent, signal); await confirmOwnRevision(chain, actor, intent.revision, intent.revision + 1, signal); return result; }); }}>Удалить работу</button></div>}
  </article>;
}

function PortfolioPanel({ moderation, writer, refreshKey, revisions, onDirtyChange }: { moderation: PerformerModeration; writer: AccountWriter; refreshKey: string; revisions?: OwnRevisionChain; onDirtyChange?: (dirty: boolean) => void }) {
  const [localRevisions] = useState(createOwnRevisionChain);
  const chain = revisions ?? localRevisions;
  const [next, setNext] = useState<string | undefined>();
  const pageKey = next ?? "first";
  const [pages, setPages] = useState<Record<string, PortfolioPage>>({});
  const [editingDrafts, setEditingDrafts] = useState<Record<string, PortfolioExample>>({});
  const editingRef = useRef<Record<string, PortfolioExample>>({});
  const newDirty = useRef(false);
  const portfolio = useLiveResource(`portfolio:${refreshKey}:${pageKey}`, async signal => {
    const value = await accountClient.portfolio(signal, next);
    if (!signal.aborted) setPages(previous => ({ ...previous, [pageKey]: value }));
    return value;
  });
  const page = portfolio.data ?? pages[pageKey];
  // Keep keyed editors mounted through loading/error, including a draft whose row disappears externally.
  const examples = [...(page?.results ?? []), ...Object.values(editingDrafts).filter(item => !page?.results.some(row => row.id === item.id))];
  const portfolioWriter = { ...writer, blocked: writer.blocked || portfolio.loading || !!portfolio.error };
  const [kind, setKind] = useState<"link" | "file">("link");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const base = useRef<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  function notifyDirty() { onDirtyChange?.(newDirty.current || Object.keys(editingRef.current).length > 0); }
  function touched() { if (base.current === null) base.current = moderation.revision; newDirty.current = true; notifyDirty(); }
  function editorDirty(example: PortfolioExample, dirty: boolean) {
    if (dirty) editingRef.current = { ...editingRef.current, [example.id]: example };
    else { const remaining = { ...editingRef.current }; delete remaining[example.id]; editingRef.current = remaining; }
    setEditingDrafts(editingRef.current); notifyDirty();
  }
  function clearNew() { setTitle(""); setUrl(""); setFile(null); base.current = null; newDirty.current = false; setNext(undefined); if (fileInput.current) fileInput.current.value = ""; notifyDirty(); }
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (portfolioWriter.blocked) return; setError("");
    if (!title.trim()) { setError("Укажите название работы."); return; }
    if (kind === "file" && (!file || !file.size || file.size > 10 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(file.type))) { setError("Выберите PNG, JPEG, WebP или PDF до 10 МиБ."); return; }
    if (kind === "link") { try { safePortfolioUrl(url); } catch { setError("Нужна HTTP(S)-ссылка без учётных данных."); return; } }
    const intent = version(chain.resolve(base.current ?? moderation.revision));
    const input = kind === "file" ? { title, file: file! } : { title, url };
    await portfolioWriter.execute(async signal => {
      const result = await accountClient.addExample(input, intent, signal);
      await confirmOwnRevision(chain, moderation.user_id, intent.revision, intent.revision + 1, signal);
      if (!signal.aborted) clearNew();
      return result;
    });
  }
  return <section className={styles.panel}><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Портфолио</p><h2>Примеры работ</h2></div><span className={styles.counter}>{page?.count ?? "—"}</span></div><p className={styles.hint}>Файлы доступны владельцу и уполномоченному модератору. Одобрение профиля не делает их публичными.</p>
    <LiveState loading={portfolio.loading} error={portfolio.error} retry={portfolio.reload} />
    <div className={styles.examples}>{examples.map(example => <ExampleEditor key={example.id} example={example} revision={moderation.revision} actor={moderation.user_id} writer={portfolioWriter} revisions={chain} onDirtyChange={editorDirty} />)}</div>
    {page && <>{!examples.length && <p className={styles.muted}>Примеров работ пока нет.</p>}<nav className={styles.compactLinks} aria-label="Страницы портфолио">{page.previous && <button className={styles.secondary} type="button" disabled={portfolioWriter.blocked || Object.keys(editingDrafts).length > 0} onClick={() => setNext(page.previous!)}>Назад</button>}{page.next && <button className={styles.secondary} type="button" disabled={portfolioWriter.blocked || Object.keys(editingDrafts).length > 0} onClick={() => setNext(page.next!)}>Далее</button>}</nav></>}
    <form className={styles.exampleForm} onSubmit={add}><fieldset className={styles.fieldset} disabled={portfolioWriter.blocked}><legend className={styles.formLegend}>Добавить работу</legend><div className={styles.kindSwitch}>{(["link", "file"] as const).map(value => <label key={value}><input type="radio" name="live-example-kind" checked={kind === value} onChange={() => { touched(); setKind(value); setError(""); }} />{value === "link" ? "Ссылка" : "Файл"}</label>)}</div><div className={styles.field}><label htmlFor="live-example-title">Название работы</label><input id="live-example-title" value={title} required maxLength={200} onChange={event => { touched(); setTitle(event.target.value); }} /></div>{kind === "link" ? <div className={styles.field}><label htmlFor="live-example-url">Ссылка на работу</label><input id="live-example-url" type="url" value={url} required maxLength={2000} onChange={event => { touched(); setUrl(event.target.value); }} placeholder="https://" /></div> : <div className={styles.field}><label htmlFor="live-example-file">Файл с примером работы</label><input id="live-example-file" ref={fileInput} type="file" required accept="image/png,image/jpeg,image/webp,application/pdf" onChange={event => { touched(); setFile(event.target.files?.[0] ?? null); }} /><p className={styles.hint}>PNG, JPEG, WebP или PDF до 10 МиБ. Окончательную проверку содержимого выполняет сервер.</p></div>}{error && <p className={styles.error} role="alert">{error}</p>}<button className={styles.secondary} type="submit">Добавить пример</button><button className={styles.remove} type="button" onClick={() => { clearNew(); writer.refresh(); }}>Загрузить актуальные данные (очистит новую работу)</button></fieldset></form>
  </section>;
}

function CabinetPanel({ role, snapshot, refreshKey }: { role: RegistrationRole; snapshot: Snapshot; refreshKey: string }) {
  const cabinet = useLiveResource(`cabinet:${role}:${refreshKey}`, async signal => {
    const value = await accountClient.cabinet(role, signal);
    if (value.account_id !== snapshot.account.id) throw new ApiError(502, null);
    return value;
  });
  return <section className={styles.panel}><p className={styles.eyebrow}>{role === "customer" ? "Кабинет заказчика" : "Кабинет исполнителя"}</p><h2>{role === "customer" ? "Помощь рядом" : "Твои знания — чья-то поддержка"}</h2><LiveState loading={cabinet.loading} error={cabinet.error} retry={cabinet.reload} />
    {cabinet.data && <><div className={styles.stats}><div><strong>{cabinet.data.orders.count}</strong><span>Заказов в истории</span></div><div><strong>{cabinet.data.statistics.rating ?? "—"}</strong><span>Средняя оценка</span></div><div><strong>{cabinet.data.statistics.completed_orders ?? "—"}</strong><span>Завершено заказов</span></div></div><p className={styles.hint}>Рейтинг, отзывы и завершение оплаченных заказов пока недоступны в API.</p>{cabinet.data.services && <div className={styles.checklist}>{Object.entries(cabinet.data.services).map(([status, count]) => <p key={status}>{({ draft: "Черновики", pending: "На модерации", published: "Опубликованы", rejected: "Отклонены", changes: "Требуют изменений" } as Record<string, string>)[status] ?? status}: {count}</p>)}</div>}</>}
    <nav className={styles.compactLinks} aria-label="Разделы кабинета"><Link href={`/orders?role=${role}`}><Icon name="book" />Заказы <Icon name="arrow" /></Link><Link href="/chats"><Icon name="chat" />Переписки <Icon name="arrow" /></Link>{role === "customer" && <><Link href="/search"><Icon name="search" />Каталог <Icon name="arrow" /></Link><Link href="/favorites">Избранное <Icon name="arrow" /></Link></>}{role === "performer" && snapshot.account.capabilities.create_service && <Link href="/create-service">Создать черновик услуги <Icon name="arrow" /></Link>}</nav>
  </section>;
}

function AccountBody() {
  const { state: auth, logout } = useAuth();
  const params = useSearchParams(); const router = useRouter();
  const [refresh, setRefresh] = useState(0);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [profileDirty, setProfileDirty] = useState(false);
  const [portfolioDirty, setPortfolioDirty] = useState(false);
  const [revisions] = useState(createOwnRevisionChain);
  const portfolioDirtyRef = useRef(false);
  const profileDirtyRef = useRef(false);
  const resource = useLiveResource(`account:${refresh}`, async signal => {
    const value = await loadSnapshot(signal);
    if (!signal.aborted) setSnapshot(value);
    return value;
  });
  const commands = useAccountWriter(() => { setRefresh(value => value + 1); }, auth.user?.id ?? null);
  const writer = { ...commands, blocked: commands.blocked || resource.loading || !!resource.error };
  const relatedWriter: AccountWriter = { ...writer, blocked: writer.blocked || profileDirty,
    execute: (...args) => profileDirtyRef.current ? Promise.resolve(false) : writer.execute(...args) };
  const updateProfileDirty = (dirty: boolean) => { profileDirtyRef.current = dirty; setProfileDirty(dirty); };
  const updatePortfolioDirty = (dirty: boolean) => { portfolioDirtyRef.current = dirty; setPortfolioDirty(dirty); };
  if (!snapshot) return <LiveState loading={resource.loading} error={resource.error} retry={resource.reload} />;
  const { account, moderation } = snapshot;
  // The closed production wizard must also cover alternate account entry points.
  if (process.env.NODE_ENV !== "development" && !account.registration.status.is_complete) return <div className={styles.page}><section className={styles.panel}><p className={styles.eyebrow}>Мой STUDLY · Live</p><h1>Регистрация скоро появится</h1><p>Регистрация этого аккаунта ещё не завершена. Создание профиля в этой сборке закрыто.</p><nav className={styles.compactLinks}><Link href="/search">Перейти в каталог</Link><button type="button" className={styles.secondary} onClick={logout}>Выйти из аккаунта</button></nav></section></div>;
  const requested = params.get("role");
  const role = requested === "customer" || requested === "performer" ? requested : account.registration.roles[0];
  const allowed = role && account.capabilities[role];
  const refreshKey = `${refresh}:${moderation.revision}`;
  return <div className={styles.page}><header className={styles.heading}><p className={styles.eyebrow}>Мой STUDLY · Live</p><div className={styles.identity}><Avatar registration={account.registration} revision={moderation.revision} /><div><h1>{account.registration.profile.display_name || "Мой аккаунт"}</h1>{account.registration.profile.university && <p>{account.registration.profile.university}</p>}{account.registration.profile.city && <p className={styles.city}>{account.registration.profile.city}</p>}</div></div><nav className={styles.compactLinks} aria-label="Доступ к аккаунту">{account.capabilities.django_admin && <Link href="/staff">Рабочее место сотрудника</Link>}<button type="button" className={styles.secondary} disabled={writer.blocked} onClick={logout}>Выйти из аккаунта</button></nav></header>
    <LiveState loading={resource.loading} error={resource.error} retry={resource.reload} />
    {writer.error && <div className={styles.error} role="alert"><p>{writer.error}</p>{writer.uncertain && writer.replayable ? <button className={styles.secondary} type="button" disabled={writer.busy} onClick={writer.retry}>Повторить исходную операцию с тем же ключом</button> : <button className={styles.secondary} type="button" disabled={writer.busy} onClick={writer.refresh}>Загрузить актуальные данные</button>}</div>}
    {writer.notice && <p className={styles.success} role="status">{writer.notice}</p>}
    <fieldset className={styles.roleFieldset} disabled={writer.blocked || portfolioDirty}><legend>Режим кабинета</legend><div className={styles.roleSwitch}>{(["customer", "performer"] as const).filter(item => account.capabilities[item]).map(item => <button type="button" key={item} aria-pressed={item === role} onClick={() => { if (!portfolioDirtyRef.current) router.replace(`/profile?role=${item}`); }}>{item === "customer" ? "Заказчик" : "Исполнитель"}</button>)}</div><p>Роль меняет вид кабинета. Сервер проверяет доступ к каждому действию.</p></fieldset>
    <div className={styles.sections}>{allowed ? <CabinetPanel key={role} role={role} snapshot={snapshot} refreshKey={refreshKey} /> : <section className={styles.panel}><h2>Роль недоступна</h2><p className={styles.hint}>Добавьте нужную роль в данных аккаунта. Доступ появится после сохранения на сервере.</p></section>}
      {role === "performer" && account.capabilities.performer && <>{profileDirty && <p className={styles.locked} role="status">В профиле есть несохранённые изменения. Сначала сохраните их или загрузите актуальные данные, затем изменяйте портфолио и отправляйте профиль на модерацию.</p>}<div className={styles.performerGrid}><ModerationPanel moderation={moderation} writer={relatedWriter} revisions={revisions} /><PortfolioPanel moderation={moderation} writer={relatedWriter} refreshKey={refreshKey} revisions={revisions} onDirtyChange={updatePortfolioDirty} /></div><LiveOwnServices /></>}
      {portfolioDirty && <p className={styles.locked} role="status">В портфолио есть несохранённая работа. Её ввод сохранится при сохранении профиля. Перед сменой режима кабинета или аватара сохраните работу либо отмените её правки.</p>}
      <LiveProfileEditor snapshot={snapshot} writer={writer} onDirtyChange={updateProfileDirty} revisions={revisions} relatedDirty={portfolioDirty} />
    </div>
  </div>;
}

function AuthenticatedAccount() { const { state } = useAuth(); return <AccountBody key={state.user?.id ?? "anonymous"} />; }
export default function LiveAccountWorkspace() {
  return <LiveAccess><Suspense fallback={<LiveState loading />}><AuthenticatedAccount /></Suspense></LiveAccess>;
}
