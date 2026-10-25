"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ChatDetail,ChatList,OrderDetail,OrderList,ServiceComposer } from "./CommerceWorkspace";
import LegacyHistory from "./LegacyHistory";
export function OrdersRoute(){return <><OrderList/><LegacyHistory kind="orders"/></>;}
export function ChatsRoute(){return <><ChatList/><LegacyHistory kind="chats"/></>;}
export function OrderRoute({id}:{id:string}){return id.startsWith("order-")?<OrderDetail key={id} id={id}/>:<LegacyHistory kind="orders" id={id}/>;}
export function ChatRoute({id}:{id:string}){return id.startsWith("conversation-")||id.startsWith("discussion-")?<ChatDetail key={id} id={id}/>:<LegacyHistory kind="chats" id={id}/>;}
function Composer(){const params=useSearchParams();const raw=params.get("edit");const id=raw&&/^\d+$/.test(raw)&&Number.isSafeInteger(Number(raw))?Number(raw):undefined;return <ServiceComposer key={id??"new"} id={id}/>;}
export function CreateServiceRoute(){return <Suspense fallback={<p role="status">Открываем редактор услуги…</p>}><Composer/></Suspense>;}
