import type { RegistrationDraft } from "@/types/registration";

export type Role = "customer" | "performer";
export type Moderation = "draft" | "pending" | "approved" | "rejected" | "changes";
export type Actor = { id: string; role: Role | "moderator" };
export type Example = { id: string; title: string; kind: "link" | "file"; url?: string; assetId?: string; mime?: string; size?: number };
export type Account = { id: string; name: string; university: string; city: string; about: string; description: string; roles: Role[]; activeRole: Role; avatarAssetId?: string; createdAt: number; moderation: Moderation; moderationReason: string; submittedAt?: number; examples: Example[] };
export type Extra = { id: string; title: string; price: number; extraDays: number };
export type DemoService = { id: number; performerId: string; performerName: string; title: string; category: string; description: string; included: string[]; price: number; days: number; extras: Extra[]; exampleIds: string[]; status: Moderation; reason: string; createdAt: number; revision: number };
export type ServiceFormDraft = { title:string; category:string; description:string; included:string; price:string; days:string; extras:{id:string;title:string;price:string;extraDays:string}[]; exampleIds:string[] };
export type ComposerDraft = { revision:number; serviceRevision:number|null; form:ServiceFormDraft };
export type MoneySnapshot = { policy: "demo-5-v1"; currency: "RUB"; base: number; extras: number; subtotal: number; feePercent: 5; fee: number; total: number };
export type OrderStatus = "PENDING" | "IN_PROGRESS" | "REVIEW" | "COMPLETED";
export type OrderEvent = { id: string; at: number; actorId: string; text: string };
export type DemoOrder = { id: string; customerId: string; customerName: string; performerId: string; performerName: string; serviceId: number; serviceTitle: string; serviceDescription:string; serviceIncluded:string[]; selectedExtras: Extra[]; money: MoneySnapshot; days: number; status: OrderStatus; revision: number; conversationId: string; createdAt: number; simulation: true; result: string; remarks: string; events: OrderEvent[]; arbitration: null | { stage: "discussion" | "open" | "reviewing" | "decision"; reason: string }; };
export type Conversation = { id: string; serviceId: number; title: string; participants: string[]; participantNames: Record<string,string>; orderId: string | null; createdAt: number };
export type Message = { id: string; conversationId: string; senderId: string; senderName: string; text: string; at: number };
export type Review = { id: string; orderId: string; performerId: string; customerId: string; author: string; rating: number; text: string; at: number };
export type AdminEvent = { id: string; at: number; actorId: string; targetId: string; type: "profile" | "service"; decision: Moderation; reason: string };
export type Workspace = { schemaVersion: 2; revision: number; draft: RegistrationDraft; registrationAvatarId: string | null; registrationStep: "roles" | "profile" | "performer"; account: Account | null; composerDrafts?:Record<string,ComposerDraft>; services: DemoService[]; orders: DemoOrder[]; conversations: Conversation[]; messages: Message[]; reviews: Review[]; adminEvents: AdminEvent[]; applied: Record<string,{ signature: string; entityId: string | null }>; };
export type ServiceInput = Omit<DemoService,"id"|"performerId"|"performerName"|"status"|"reason"|"createdAt"|"revision">;
export type Purchase = { revision?:number; serviceId: number; performerId: string; performerName: string; title: string; base: number; days: number; extras: Extra[]; customerName?: string };
export type Command =
 | { type:"registration"; draft:RegistrationDraft; step?:Workspace["registrationStep"]; avatarId?:string|null }
 | { type:"register" }
 | { type:"role"; role:Role }
 | { type:"profile"; patch:Partial<Pick<Account,"name"|"university"|"city"|"about"|"description"|"avatarAssetId">> }
 | { type:"example.add"; example:Example }
 | { type:"example.remove"; id:string }
 | { type:"profile.submit" }
 | { type:"profile.decide"; decision:"approved"|"rejected"|"changes"; reason:string }
 | { type:"service.form"; key:string; revision:number|null; serviceRevision:number|null; form:ServiceFormDraft }
 | { type:"service.save"; id?:number; revision?:number; formRevision?:number|null; input:ServiceInput }
 | { type:"service.submit"; id:number }
 | { type:"service.decide"; id:number; decision:"approved"|"rejected"|"changes"; reason:string }
 | { type:"purchase"; purchase:Purchase; simulated:true }
 | { type:"discussion"; serviceId:number; performerId:string; performerName:string; title:string }
 | { type:"order.accept"; id:string; revision:number }
 | { type:"order.result"; id:string; revision:number; text:string }
 | { type:"order.remarks"; id:string; revision:number; text:string }
 | { type:"order.complete"; id:string; revision:number }
 | { type:"message"; conversationId:string; text:string }
 | { type:"review"; orderId:string; rating:number; text:string };
export type RunOptions = { actor?:Actor; actionId?:string; expectedRevision?:number };
export const SELF = "demo-self";
export const MODERATOR = "demo-moderator";
export const NEXT_SERVICE_ID = 1_000_000_000;
export const moderationLabels: Record<Moderation,string> = {draft:"Черновик",pending:"На модерации",approved:"Одобрено",rejected:"Отклонено",changes:"Требуются исправления"};
export const statusLabels:Record<OrderStatus,string>={PENDING:"Ожидает принятия",IN_PROGRESS:"В работе",REVIEW:"На проверке",COMPLETED:"Завершён"};
export function rubles(cents:number){if(!Number.isSafeInteger(cents)||cents<0)return "Сумма недоступна";const value=BigInt(cents);return `${new Intl.NumberFormat("ru-RU",{maximumFractionDigits:0}).format(value/BigInt(100))},${String(value%BigInt(100)).padStart(2,"0")}\u00a0₽`;}
export function ratingFor(state:Workspace,performerId:string){const reviews=state.reviews.filter(r=>r.performerId===performerId&&state.orders.some(o=>o.id===r.orderId&&o.status==="COMPLETED"&&!o.arbitration));return {reviews,count:reviews.length,average:reviews.length?reviews.reduce((n,r)=>n+r.rating,0)/reviews.length:null,completed:state.orders.filter(o=>o.performerId===performerId&&o.status==="COMPLETED").length};}
