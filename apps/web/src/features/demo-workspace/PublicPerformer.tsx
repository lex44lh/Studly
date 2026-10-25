"use client";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import ServiceCard from "@/components/ServiceCard";
import { useDemoWorkspace } from "./Provider";
import { ratingFor,SELF } from "./model";
import { useDemoCatalog,SELF_PROFILE_ID } from "./catalog";
import { PublicDemoPerformer } from "./AccountWorkspace";
export default function PublicPerformer({id}:{id:string}){const w=useDemoWorkspace(),catalog=useDemoCatalog();if(id===SELF||Number(id)===SELF_PROFILE_ID)return <PublicDemoPerformer performerId={SELF}/>;
  const list=catalog.filter(s=>s.profileId===Number(id)),first=list[0];if(!first)return <div className="campus-page"><BackButton/><section className="page-panel dw-state"><h1>Исполнитель не найден</h1><Link className="page-button" href="/search">В каталог</Link></section></div>;
  const stats=w.state?ratingFor(w.state,`fixture:${id}`):null;const initials=first.seller.split(/\s+/).slice(0,2).map(s=>s[0]).join("");
  return <div className="campus-page"><BackButton/><div className="performer-layout"><section className="page-panel performer-summary"><div className="performer-initials" aria-hidden="true">{initials}</div><p className="page-eyebrow">ДЕМОНСТРАЦИОННЫЙ ИСПОЛНИТЕЛЬ</p><h1>{first.seller}</h1><p>{stats?.count?`★ ${stats.average!.toFixed(1)} · ${stats.count} отзывов`:"Пока нет отзывов по завершённым заказам STUDLY Demo"}</p><p>Переписку можно начать на странице услуги.</p></section><div><section className="page-panel"><h2>Подтверждённая Demo-история</h2><p>Завершено внутри STUDLY Demo: {stats?.completed??0}</p><p>Другие сведения в этом демонстрационном профиле не сохранены.</p></section><section className="page-section"><h2>Услуги</h2><div className="performer-services">{list.map(s=><ServiceCard key={s.id} {...s} isDemo/>)}</div></section><section className="page-panel"><h2>Отзывы по заказам STUDLY</h2>{stats?.reviews.length?stats.reviews.map(r=><article key={r.id}><strong>{r.rating} / 5 · {r.author}</strong>{r.text&&<p>{r.text}</p>}<p className="page-muted">Завершённый Demo-заказ · {r.orderId}</p></article>):<p className="page-muted">Отзывы по внешним договорённостям не учитываются.</p>}</section></div></div></div>;
}
