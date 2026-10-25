"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { demoMode } from "@/lib/data-mode";
import type { RegistrationDraft } from "@/types/registration";
import { SELF, type Actor, type Command, type RunOptions, type Workspace } from "./model";
import { DemoError } from "./domain";
import { execute, loadWorkspace, readAsset, validateAsset, type AssetWrite } from "./repository";
import "./workspace.css";
export const adminSandboxEnabled=demoMode&&(process.env.NODE_ENV==="development"||process.env.NEXT_PUBLIC_STUDLY_DEMO_ADMIN==="enabled");
export const newActionId=()=>crypto.randomUUID();
type Context={state:Workspace|null;ready:boolean;busy:boolean;error:string;notice:string;sandboxEnabled:boolean;run:(command:Command,options?:RunOptions)=>Promise<string|null>;retry:()=>void;saveRegistration:(draft:RegistrationDraft,step?:Workspace["registrationStep"],expectedRevision?:number,avatarIntent?:"preserve"|"remove")=>Promise<number>;saveExample:(input:{title:string;url?:string;file?:File})=>Promise<void>;saveAvatar:(file:File|null,options?:Pick<RunOptions,"expectedRevision">)=>Promise<number>;getAsset:typeof readAsset};
const DemoContext=createContext<Context|null>(null);
const message=(e:unknown)=>e instanceof DemoError?e.message:"Не удалось сохранить локальные Demo-данные. Проверьте доступность хранилища и свободное место, затем повторите.";
export function DemoWorkspaceProvider({children}:{children:ReactNode}){
  const [state,setState]=useState<Workspace|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[attempt,setAttempt]=useState(0);
  const avatarFiles=useRef(new WeakMap<File,string>());
  const current=useRef<Workspace|null>(null),queue=useRef<Promise<unknown>>(Promise.resolve()),channel=useRef<BroadcastChannel|null>(null),mounted=useRef(true);
  const adopt=useCallback((value:Workspace)=>{if(current.current&&current.current.revision>value.revision)return;current.current=value;if(mounted.current)setState(value);},[]);
  useEffect(()=>{if(!demoMode)return;mounted.current=true;let live=true;
    const refresh=()=>loadWorkspace().then(value=>{if(live){adopt(value);setError("");}}).catch(e=>{if(live)setError(message(e));});
    void refresh();
    if(typeof BroadcastChannel!=="undefined"){const c=new BroadcastChannel("studly-demo-workspace-v2");channel.current=c;c.onmessage=()=>{void refresh();};}
    const focus=()=>{void refresh();};window.addEventListener("focus",focus);
    return()=>{live=false;mounted.current=false;window.removeEventListener("focus",focus);channel.current?.close();channel.current=null;};
  },[attempt,adopt]);
  const submit=useCallback((command:Command,options:RunOptions={},asset?:AssetWrite):Promise<{state:Workspace;entityId:string|null}>=>{
    const snapshot=current.current;const actor:Actor=options.actor??{id:snapshot?.account?.id??SELF,role:snapshot?.account?.activeRole??"customer"};const id=options.actionId??newActionId();
    // Capture the actor, but serialize this tab's writers. IndexedDB serializes
    // other tabs and compares the actual revision inside the write transaction.
    const job=queue.current.catch(()=>{}).then(async()=>{
      if(!demoMode||!current.current)throw new DemoError("Demo-хранилище ещё не готово. Повторите после загрузки.","storage");
      if(mounted.current){setBusy(true);setError("");setNotice("");}
      try{const result=await execute(command,actor,id,options.expectedRevision??current.current.revision,adminSandboxEnabled,asset);adopt(result.state);channel.current?.postMessage({revision:result.state.revision});if(mounted.current)setNotice("Сохранено в локальной Demo-модели. Реальные данные не изменялись.");return result;}
      catch(e){if(mounted.current)setError(message(e));try{adopt(await loadWorkspace());}catch{/* Preserve the last valid view; never overwrite an invalid database. */}throw e;}
      finally{if(mounted.current)setBusy(false);}
    });queue.current=job;return job;
  },[adopt]);
  const run=useCallback((command:Command,options?:RunOptions)=>submit(command,options).then(result=>result.entityId),[submit]);
  const saveRegistration=useCallback(async(draft:RegistrationDraft,step?:Workspace["registrationStep"],expectedRevision?:number,avatarIntent:"preserve"|"remove"="preserve")=>{
    const file=draft.profile.avatarFile;let asset:AssetWrite|undefined;let avatarId=current.current?.registrationAvatarId??null;
    if(file){if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>5*1024*1024)throw new DemoError("Для аватара выберите PNG/JPEG/WebP до 5 МиБ.");validateAsset(file);avatarId=avatarFiles.current.get(file)??newActionId();avatarFiles.current.set(file,avatarId);asset={id:avatarId,blob:file};}
    // Preview readiness is unrelated to removal. Only an explicit form action may clear the persisted reference.
    else if(avatarIntent==="remove")avatarId=null;
    const clean:RegistrationDraft={...draft,profile:{...draft.profile,avatarFile:null,avatarUrl:draft.profile.avatarUrl.startsWith("blob:")?"":draft.profile.avatarUrl}};
    const result=await submit({type:"registration",draft:clean,step,avatarId},{expectedRevision},asset);return result.state.revision;
  },[submit]);
  const saveExample=useCallback(async(input:{title:string;url?:string;file?:File})=>{const id=newActionId();if(input.file){validateAsset(input.file);await submit({type:"example.add",example:{id,title:input.title,kind:"file",assetId:id,mime:input.file.type,size:input.file.size}},{},{id,blob:input.file});}else await submit({type:"example.add",example:{id,title:input.title,kind:"link",url:input.url}});},[submit]);
  const saveAvatar=useCallback(async(file:File|null,options:Pick<RunOptions,"expectedRevision">={})=>{if(file){if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>5*1024*1024)throw new DemoError("Для аватара выберите PNG/JPEG/WebP до 5 МиБ.");validateAsset(file);const id=newActionId();const result=await submit({type:"profile",patch:{avatarAssetId:id}},options,{id,blob:file});return result.state.revision;}const result=await submit({type:"profile",patch:{avatarAssetId:""}},options);return result.state.revision;},[submit]);
  return <DemoContext.Provider value={{state,ready:state!==null,busy,error,notice,run,retry:()=>setAttempt(n=>n+1),sandboxEnabled:adminSandboxEnabled,saveRegistration,saveExample,saveAvatar,getAsset:readAsset}}>{children}</DemoContext.Provider>;
}
export const useOptionalDemoWorkspace=()=>useContext(DemoContext);
export function useDemoWorkspace(){const value=useOptionalDemoWorkspace();if(!value)throw new Error("DemoWorkspaceProvider is required in explicit Demo mode");return value;}
export function WorkspaceStatus(){const w=useDemoWorkspace();return <section className="page-panel dw-state" role={w.error?"alert":"status"} aria-busy={!w.error}><h2>{w.error?"Локальные данные недоступны":"Открываем Demo-пространство…"}</h2><p>{w.error||"Загружаем сохранённый прогресс этого браузера."}</p>{w.error&&<button className="page-button" onClick={w.retry}>Повторить загрузку</button>}</section>;}
