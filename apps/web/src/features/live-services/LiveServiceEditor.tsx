"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import BackButton from "@/components/BackButton";
import { PageHeading } from "@/components/studly/PageHeading";
import { accountClient, type PortfolioExample } from "@/lib/api/account";
import { servicesClient, type OwnService, type ServiceDraftInput } from "@/lib/api/services";
import { ApiError, apiErrorMessage, requestKey } from "@/lib/api/client";
import { LiveAccess, LiveState, useLiveResource } from "@/features/live/shared";
import { draftFields, serviceForm, serviceStatus, type ServiceForm } from "./model";
import styles from "@/features/demo-workspace/commerce.module.css";

async function allExamples(signal: AbortSignal) {
  const examples: PortfolioExample[] = [], seen = new Set<string>();
  let next: string | undefined;
  do {
    const key = next ?? "first";
    if (seen.has(key)) throw new ApiError(502, null);
    seen.add(key);
    const page = await accountClient.portfolio(signal, next);
    examples.push(...page.results);
    next = page.next ?? undefined;
  } while (next);
  return examples;
}

export function EditorForm({ initial, examples, reload }: { initial?: OwnService; examples: PortfolioExample[]; reload: () => void }) {
  const router = useRouter();
  const [service, setService] = useState(initial);
  const [form, setForm] = useState<ServiceForm>(() => serviceForm(initial));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [uncertain, setUncertain] = useState(false);
  const [notice, setNotice] = useState("");
  const [validation, setValidation] = useState("");
  const [preview, setPreview] = useState(false);
  const saving = useRef(false);
  const lifetime = useRef<AbortController | null>(null);
  const intention = useRef<{ signature: string; input: ServiceDraftInput; submit: boolean } | null>(null);
  useEffect(() => {
    const controller = new AbortController(); lifetime.current = controller;
    return () => { controller.abort(); lifetime.current = null; };
  }, []);
  const patch = (value: Partial<ServiceForm>) => {
    setForm(previous => ({ ...previous, ...value })); setDirty(true); setValidation(""); setNotice("");
  };
  const conflict = error instanceof ApiError && error.status === 409;
  async function mutate(submit: boolean) {
    const controller = lifetime.current;
    if (!controller || saving.current || conflict || (uncertain && intention.current?.submit !== submit) || (submit && (!service || dirty))) return;
    saving.current = true; setBusy(true); setError(undefined); setValidation(""); setNotice("");
    try {
      const fields = submit ? {} : draftFields(form);
      const revision = service?.revision ?? 0;
      const signature = JSON.stringify({ id: service?.id ?? null, submit, revision, fields });
      if (!uncertain && intention.current?.signature !== signature) intention.current = { signature, input: { ...fields, revision, request_key: requestKey() }, submit };
      if (!intention.current) return;
      const input = intention.current.input;
      const saved = submit ? await servicesClient.submit(service!.id, input, controller.signal) :
        service ? await servicesClient.patch(service.id, input, controller.signal) : await servicesClient.create(input, controller.signal);
      if (controller.signal.aborted) return;
      intention.current = null; setUncertain(false); setService(saved); setForm(serviceForm(saved)); setDirty(false);
      setNotice(submit ? "Сервер подтвердил подачу услуги на модерацию." : "Черновик сохранён на сервере.");
      if (!service) router.replace(`/create-service?id=${saved.id}`);
    } catch (cause) {
      if (!controller.signal.aborted) {
        if (cause instanceof ApiError) {
          setError(cause);
          const unknown = cause.status === 0 || cause.status >= 500;
          setUncertain(unknown);
          if (!unknown) intention.current = null;
        }
        else setValidation(cause instanceof Error ? cause.message : "Проверьте поля услуги.");
      }
    } finally {
      saving.current = false;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  const canSubmit = !!service && ["draft", "rejected", "changes"].includes(service.status);
  return <div className={styles.grid}><section className={styles.panel} aria-labelledby="live-composer-title">
    <h2 id="live-composer-title">{service ? "Данные услуги" : "Новый черновик"}</h2>
    {service && <p className={styles.badge}>{serviceStatus[service.status]} · версия {service.revision}</p>}
    {service?.reason && <p className={styles.note}>Причина решения: {service.reason}</p>}
    {service?.status === "published" && <p className={styles.note}>После сохранения изменений опубликованная услуга повторно проходит модерацию.</p>}
    <fieldset className={styles.stack} disabled={busy || conflict || uncertain} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <label className={styles.field}>Название услуги<input className={styles.input} value={form.title} maxLength={200} onChange={event => patch({ title: event.target.value })} /></label>
      <label className={styles.field}>Категория<input className={styles.input} value={form.category} maxLength={100} onChange={event => patch({ category: event.target.value })} /></label>
      <label className={styles.field}>Описание<textarea className={styles.textarea} value={form.description} maxLength={10000} onChange={event => patch({ description: event.target.value })} /></label>
      <label className={styles.field}>Что входит в услугу<textarea className={styles.textarea} value={form.included} placeholder="Каждый пункт с новой строки" onChange={event => patch({ included: event.target.value })} /></label>
      <div className={styles.two}><label className={styles.field}>Цена, ₽<input className={styles.input} inputMode="decimal" value={form.price} onChange={event => patch({ price: event.target.value })} /></label>
        <label className={styles.field}>Срок, дней<input className={styles.input} type="number" min="1" max="32767" step="1" value={form.days} onChange={event => patch({ days: event.target.value })} /></label></div>
      <fieldset className={styles.exampleList}><legend>Примеры из Вашего портфолио</legend>{examples.length ? examples.map(example =>
        <label key={example.id} className={styles.check}><input type="checkbox" checked={form.exampleIds.includes(example.id)} onChange={event => patch({ exampleIds: event.target.checked ? [...form.exampleIds, example.id] : form.exampleIds.filter(id => id !== example.id) })} /><span>{example.title}</span></label>) :
        <p className={styles.muted}>Добавьте примеры работ в <Link href="/profile">кабинете</Link> перед подачей услуги.</p>}</fieldset>
      <h3>Дополнительные услуги</h3>{form.extras.map((extra, index) => {
        const change = (value: Partial<typeof extra>) => patch({ extras: form.extras.map(item => item.id === extra.id ? { ...item, ...value } : item) });
        return <div className={styles.extra} key={extra.id}><label className={styles.field}>Название дополнения {index + 1}<input className={styles.input} value={extra.title} maxLength={200} onChange={event => change({ title: event.target.value })} /></label>
          <div className={styles.two}><label className={styles.field}>Цена дополнения, ₽<input className={styles.input} inputMode="decimal" value={extra.price} onChange={event => change({ price: event.target.value })} /></label>
            <label className={styles.field}>Дополнительные дни<input className={styles.input} type="number" min="0" max="32766" step="1" value={extra.days} onChange={event => change({ days: event.target.value })} /></label></div>
          <button type="button" className={styles.secondary} onClick={() => patch({ extras: form.extras.filter(item => item.id !== extra.id) })}>Удалить дополнение {index + 1}</button></div>;
      })}
      <button type="button" className={styles.secondary} disabled={form.extras.length >= 50} onClick={() => patch({ extras: [...form.extras, { id: requestKey(), title: "", price: "0.00", days: "0" }] })}>Добавить дополнение</button>
    </fieldset>
    {validation && <p className={styles.error} role="alert">{validation}</p>}
    {error !== undefined && <div role="alert" className={styles.error}><p>{apiErrorMessage(error)}</p>{error instanceof ApiError && error.status === 400 && <p>Проверьте обязательные поля, примеры работ и одобрение профиля. Правила подачи проверяет сервер.</p>}
      {uncertain && <><p>Результат операции неизвестен. Новые правки приостановлены. Повтор отправит исходные данные с прежним ключом; автоматического повтора нет.</p>
        <button type="button" className={styles.secondary} disabled={busy} onClick={() => void mutate(intention.current?.submit ?? false)}>Повторить исходную операцию с тем же ключом</button><Link href="/profile?role=performer">Проверить мои серверные услуги</Link></>}
      {conflict && <p>Серверная версия изменилась. Сохраните нужный текст отдельно и загрузите актуальную версию перед повторным действием.</p>}</div>}
    {notice && <p className={styles.note} role="status">{notice}</p>}
    <div className={styles.actions}><button type="button" className={styles.secondary} onClick={() => setPreview(value => !value)} aria-expanded={preview} aria-controls="live-composer-preview">Предпросмотр</button>
      <button type="button" className={styles.primary} disabled={busy || conflict || uncertain} onClick={() => void mutate(false)}>{busy ? "Сохраняем…" : "Сохранить черновик"}</button>
      <button type="button" className={styles.secondary} disabled={busy || uncertain} onClick={reload}>Загрузить серверную версию</button></div>
    <p className={styles.small}>{dirty ? "Есть несохранённые изменения. Сохраните черновик перед выходом." : "После сохранения черновик можно восстановить по ссылке на эту услугу."}</p>
    {service && <Link href={`/create-service?id=${service.id}`}>Ссылка на черновик №{service.id}</Link>}
  </section><aside className={styles.stack}><section className={styles.panel}><h2>Отправка на проверку</h2>
    <p className={styles.muted}>Отправляется сохранённая серверная версия. Требуются заполненная услуга, собственное портфолио и действующее одобрение профиля исполнителя.</p>
    <button type="button" className={styles.primary} disabled={busy || conflict || uncertain || dirty || !canSubmit} onClick={() => void mutate(true)}>Отправить на модерацию</button>
    <p className={styles.note}>Услуга появляется в каталоге после серверного одобрения. Профиль и услуга проходят отдельные проверки.</p>
  </section>{preview && <section className={styles.panel} id="live-composer-preview"><p className={styles.eyebrow}>Предпросмотр</p><h2>{form.title || "Название услуги"}</h2><p className={styles.muted}>{form.category}</p><p className={styles.result}>{form.description}</p><ul>{form.included.split("\n").filter(Boolean).map((line, index) => <li key={index}>{line}</li>)}</ul><p>{form.price} ₽ · {form.days} дн.</p><p className={styles.small}>Это предпросмотр формы; публикацию подтверждает сервер.</p></section>}</aside></div>;
}

function EditorSource({ id }: { id: string | null }) {
  const resource = useLiveResource(`service-editor:${id ?? "new"}`, async signal => {
    const [account, service, examples] = await Promise.all([accountClient.account(signal), id ? servicesClient.myDetail(id, signal) : Promise.resolve(undefined), allExamples(signal)]);
    return { account, service, examples };
  });
  if (!resource.data) return <LiveState loading={resource.loading} error={resource.error} retry={resource.reload} />;
  if (!resource.data.account.capabilities.create_service) return <section className={styles.panel}><h2>Нужна роль исполнителя</h2><p>Подключите роль исполнителя в своём аккаунте.</p><Link href="/register/roles">Открыть регистрацию</Link></section>;
  return <EditorForm initial={resource.data.service} examples={resource.data.examples} reload={resource.reload} />;
}
function EditorQuery() {
  const parameters = useSearchParams();
  const id = parameters.get("id") ?? parameters.get("edit");
  return <LiveAccess><EditorSource key={id ?? "new"} id={id} /></LiveAccess>;
}
export default function LiveServiceEditor() {
  return <div className={styles.page}><BackButton /><PageHeading title="Мои услуги">Серверный черновик → модерация → публикация.</PageHeading>
    <Suspense fallback={<LiveState loading />}><EditorQuery /></Suspense>
  </div>;
}
