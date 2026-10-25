"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import { DemoOrderStatus,demoPerformerName } from "@/components/studly/DemoOrderPresentation";
import { demoMode } from "@/lib/data-mode";
type Row=Record<string,unknown>;
const text=(v:unknown,fallback:string)=>typeof v==="string"&&v.trim()?v:fallback;
const amount=(v:unknown)=>typeof v==="number"&&Number.isFinite(v)&&v>=0?new Intl.NumberFormat("ru-RU",{style:"currency",currency:"RUB"}).format(v):"Не сохранено";
export default function LegacyHistory({kind,id}:{kind:"orders"|"chats";id?:string}){
 const [data,setData]=useState<{ready:boolean;rows:Row[];error:string;messages:Row[]}>({ready:false,rows:[],error:"",messages:[]});
 useEffect(()=>{if(!demoMode)return;try{const raw=localStorage.getItem(`studly-${kind}`);const parsed:unknown=raw?JSON.parse(raw):[];const rows=Array.isArray(parsed)?parsed.filter((x):x is Row=>!!x&&typeof x==="object"&&!Array.isArray(x)):[];let messages:Row[]=[];if(id&&kind==="chats"){const value=localStorage.getItem(`studly-chat-messages-${id}`);const m:unknown=value?JSON.parse(value):[];messages=Array.isArray(m)?m.filter((x):x is Row=>!!x&&typeof x==="object"&&!Array.isArray(x)):[];}
 // eslint-disable-next-line react-hooks/set-state-in-effect -- Read legacy records without rewriting or migrating them.
 setData({ready:true,rows,error:!Array.isArray(parsed)?"Старый формат не поддерживается. Исходная запись сохранена.":"",messages});}catch{setData({ready:true,rows:[],error:"Старые локальные данные недоступны или повреждены. Они не изменялись.",messages:[]});}},[kind,id]);
 const note=<p className="dw-note">Старые Demo-записи сохранены без пересчёта и переноса в новый аккаунт. Владелец и роли в них не записаны. Действия над ними ожидают решения PO.</p>;
 if(!id){if(!data.ready||(!data.rows.length&&!data.error))return null;return <section className="campus-page"><details className="dw-readonly"><summary>Старые локальные {kind==="orders"?"заказы":"переписки"} · {data.rows.length}</summary>{note}{data.error&&<p role="alert">{data.error}</p>}<ul>{data.rows.map((row,index)=>{const validId=(typeof row.id==="number"&&Number.isSafeInteger(row.id))||typeof row.id==="string";return <li key={index}>{validId?<Link href={`/${kind}/${encodeURIComponent(String(row.id))}`}>{text(row.serviceTitle,`Старая запись ${index+1}`)}</Link>:<span>Запись без идентификатора</span>}</li>;})}</ul></details></section>;}
 const row=data.rows.find(row=>String(row.id)===id);
 return <div className="campus-page dw-page" data-legacy-history="true"><BackButton/><h1 className="page-heading">{data.ready?row?text(row.serviceTitle,"Старый Demo-пример"):"Старая запись не найдена":"Открываем старую запись…"}</h1>{note}{data.error&&<p role="alert">{data.error}</p>}{row&&<section className="page-panel dw-state"><p>Исполнитель: {demoPerformerName(row.performerName)}</p>{kind==="orders"?<><DemoOrderStatus status={row.status}/><dl><dt>Стоимость основной услуги</dt><dd>{amount(row.basePrice)}</dd><dt>Сохранённый итог</dt><dd>{amount(row.totalPrice)}</dd></dl><p>Комиссия в старой модели отдельно не сохранялась. Новые 5% к этому итогу не добавляются.</p></>:<><h2>Сохранённые сообщения</h2>{data.messages.length?data.messages.map((m,i)=><p key={i}>{text(m.text,"Неподдерживаемое сообщение")}</p>):<p>Сообщений нет.</p>}<p>Отправка и удаление в старом контексте пока недоступны.</p></>}</section>}<Link className="page-button" href={`/${kind}`}>К новым Demo-{kind==="orders"?"заказам":"чатам"}</Link></div>;
}
