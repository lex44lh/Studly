"use client";
import { useMemo,useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ServiceDetail,DetailState } from "@/components/catalog/ServiceDetail";
import { useDemoWorkspace } from "./Provider";
import { emptyWorkspace,sellable } from "./domain";
import { ratingFor,rubles,SELF,type Extra,type Purchase } from "./model";
import { SELF_PROFILE_ID } from "./catalog";
import { DemoCheckout,IncomingDemoOrder } from "./CommerceWorkspace";
export function DiscussionButton({purchase}:{purchase:Purchase}){const w=useDemoWorkspace(),router=useRouter();const [failure,setFailure]=useState("");if(!w.state?.account)return <Link className="primary-btn" href="/register/roles">Зарегистрироваться в Demo</Link>;if(purchase.performerId===w.state.account.id)return <Link href="/profile" className="primary-btn">Кабинет исполнителя</Link>;
  return <><button className="primary-btn" disabled={w.busy||w.state.account.activeRole!=="customer"} onClick={async()=>{setFailure("");try{const id=await w.run({type:"discussion",...purchase});if(id)router.push(`/chats/${id}`);}catch(e){setFailure(e instanceof Error?e.message:"Не удалось открыть диалог.");}}}>Начать Demo-чат</button>{w.state.account.activeRole!=="customer"&&<p className="sd-muted">Переключитесь в режим заказчика в кабинете.</p>}{failure&&<p role="alert">{failure}</p>}</>;
}
export default function ServiceWorkspace({id}:{id:string}){const w=useDemoWorkspace();const [selectedIds,setSelectedIds]=useState<string[]>([]);
  const source=useMemo(()=>{try{return sellable(w.state??emptyWorkspace(),Number(id));}catch{return null;}},[w.state,id]);
  if(!source){if(w.error&&Number(id)>=1_000_000_000)return <DetailState><p role="alert">{w.error}</p><button className="primary-btn" onClick={w.retry}>Повторить загрузку</button></DetailState>;if(!w.ready&&Number(id)>=1_000_000_000&&!w.error)return <DetailState><p role="status">Загружаем локальную услугу…</p></DetailState>;return <DetailState><p>Услуга не найдена или ещё не одобрена для Demo-каталога.</p></DetailState>;}
  const extras:Extra[]=source.extras.filter(e=>selectedIds.includes(e.id));const stats=w.state?ratingFor(w.state,source.performerId):null;
  return <ServiceDetail isDemoMode service={{id:source.serviceId,title:source.title,description:source.description,price:rubles(source.base),duration:`${source.days} дн.`,seller:source.performerName,profileId:source.performerId===SELF?SELF_PROFILE_ID:Number(source.performerId.split(":")[1]),included:source.included,category:source.category,rating:stats?.count?`${stats.average!.toFixed(1)} (${stats.count} отзывов)`:"",isDemo:true}}
    chat={<DiscussionButton purchase={source}/>}
    extras={<><p className="sd-muted">Дополнения входят в расчёт до создания заказа. Поздние покупки пока недоступны.</p><div className="sd-options" role="group" aria-label="Дополнительные услуги">{source.extras.length?source.extras.map(option=><button type="button" key={option.id} className="sd-option" aria-pressed={selectedIds.includes(option.id)} onClick={()=>setSelectedIds(ids=>ids.includes(option.id)?ids.filter(id=>id!==option.id):[...ids,option.id])}><span className="sd-option-check" aria-hidden="true">✓</span><span className="sd-option-copy"><strong>{option.title}</strong><small>{option.extraDays?`+${option.extraDays} дн.`:"Без изменения срока"}</small></span><strong className="sd-option-price">+{rubles(option.price)}</strong></button>):<p className="sd-muted">Дополнения не предусмотрены.</p>}</div></>}
    order={<><DemoCheckout purchase={{...source,extras}}/><IncomingDemoOrder purchase={{...source,extras}}/></>}/>;
}
