"use client";
import { useMemo } from "react";
import fixtures, {type Service} from "@/data/services";
import { useOptionalDemoWorkspace } from "./Provider";
import { ratingFor, SELF, rubles, type Workspace } from "./model";
export const SELF_PROFILE_ID=2_000_000_000;
export function demoCatalog(state:Workspace|null):Service[]{
  const rating=(id:string)=>{if(!state)return "";const r=ratingFor(state,id);return r.count?`${r.average!.toFixed(1)} (${r.count} отзывов)` : "";};
  return [...fixtures.map(f=>({...f,rating:rating(`fixture:${f.profileId}`)})),...(state?.account?.moderation==="approved"?state.services.filter(s=>s.status==="approved").map(s=>({id:s.id,title:s.title,description:s.description,category:s.category,included:s.included,price:rubles(s.price),priceNumber:s.price/100,seller:s.performerName,profileId:SELF_PROFILE_ID,rating:rating(SELF),duration:`${s.days} дн.`,durationDays:s.days})):[])];
}
export function useDemoCatalog(){const workspace=useOptionalDemoWorkspace();return useMemo(()=>demoCatalog(workspace?.state??null),[workspace?.state]);}
