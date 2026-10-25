"use client";
import { useEffect,useState,type ReactNode } from "react";
import type { Example } from "./model";
import { useDemoWorkspace } from "./Provider";
export function WorkspaceFrame({title,eyebrow="Мой кампус",children}:{title:string;eyebrow?:string;children:ReactNode}){return <div className="campus-page dw-page"><header className="dw-heading"><p className="page-eyebrow">{eyebrow}</p><h1 className="page-heading">{title}</h1></header>{children}</div>;}
export function DemoNotice(){return <p className="dw-note" role="note">Локальный Demo-sandbox. Данные и действия демонстрационные; деньги не списываются, сообщения другим людям не отправляются.</p>;}
export function AssetPreview({example}:{example:Example}){const {getAsset}=useDemoWorkspace();const [value,setValue]=useState<{id:string;url:string;error:string}>({id:"",url:"",error:""});
  useEffect(()=>{if(example.kind!=="file"||!example.assetId)return;let live=true,url="";getAsset(example.assetId).then(blob=>{if(!blob)throw Error("Файл отсутствует в этом браузере.");if(!live)return;url=URL.createObjectURL(blob);setValue({id:example.id,url,error:""});}).catch(()=>{if(live)setValue({id:example.id,url:"",error:"Локальный файл недоступен. Повторная загрузка требует выбора файла."});});return()=>{live=false;if(url)URL.revokeObjectURL(url);};},[example.id,example.kind,example.assetId,getAsset]);
  if(example.kind==="link"){let safe=false;try{safe=["http:","https:"].includes(new URL(example.url??"").protocol);}catch{}return safe?<a className="dw-asset-link" href={example.url} target="_blank" rel="noopener noreferrer">{example.title} ↗</a>:<p>Ссылка недоступна</p>;}
  if(value.id!==example.id)return <p role="status">Открываем локальный пример…</p>;if(value.error)return <p role="alert">{value.error}</p>;
  return <div className="dw-asset">{example.mime?.startsWith("image/")?
      // eslint-disable-next-line @next/next/no-img-element -- Local IndexedDB Blob preview cannot use a server image optimizer.
      <img src={value.url} alt={example.title}/>:<p>PDF · {example.title}</p>}<a className="dw-asset-link" href={value.url} target="_blank" rel="noopener noreferrer">Открыть {example.mime==="application/pdf"?"PDF":"изображение"}</a></div>;
}
