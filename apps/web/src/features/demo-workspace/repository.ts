import { applyCommand, DemoError, emptyWorkspace, validateWorkspace } from "./domain";
import type { Actor, Command, Workspace } from "./model";

// Both the envelope and files share an IndexedDB transaction. Writers in other
// tabs serialize on the same stores; localStorage is never used as a fake CAS.
export const DATABASE = "studly-demo-workspace-v2";
let connection:Promise<IDBDatabase>|null=null;
function open():Promise<IDBDatabase>{
  if(connection)return connection;
  if(typeof indexedDB==="undefined")return Promise.reject(new DemoError("Постоянное локальное хранилище недоступно. Demo-действия не будут выданы за сохранённые.","storage"));
  connection=new Promise((resolve,reject)=>{
    const request=indexedDB.open(DATABASE,1);
    request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains("state"))db.createObjectStore("state");if(!db.objectStoreNames.contains("assets"))db.createObjectStore("assets");};
    request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();connection=null;};resolve(db);};
    request.onerror=()=>{connection=null;reject(request.error);};
    request.onblocked=()=>{connection=null;reject(new DemoError("Обновление Demo-хранилища заблокировано другой вкладкой. Закройте её и повторите.","storage"));};
  });return connection;
}
export async function loadWorkspace():Promise<Workspace>{const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction("state","readonly"),r=tx.objectStore("state").get("current");let value:Workspace; r.onsuccess=()=>{try{value=r.result===undefined?emptyWorkspace():r.result;validateWorkspace(value);}catch(error){reject(error);}};tx.oncomplete=()=>{if(value)resolve(value);};tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
export type AssetWrite={id:string;blob:Blob};
export async function execute(command:Command,actor:Actor,actionId:string,expectedRevision:number,allowModerator:boolean,asset?:AssetWrite):Promise<{state:Workspace;entityId:string|null}> {
  const db=await open();return new Promise((resolve,reject)=>{
    const tx=db.transaction(["state","assets"],"readwrite"),store=tx.objectStore("state"),assets=tx.objectStore("assets");let result:{state:Workspace;entityId:string|null}|undefined;let failure:unknown;
    const abort=(error:unknown)=>{failure=error;try{tx.abort();}catch{reject(error);}};
    const request=store.get("current");request.onsuccess=()=>{
      try{
        const current=request.result===undefined?emptyWorkspace():request.result;validateWorkspace(current);
        const prior=Object.hasOwn(current.applied,actionId);if(!prior&&current.revision!==expectedRevision)throw new DemoError("Demo-данные изменились в другой вкладке. Данные обновлены; проверьте условия и повторите действие.","conflict");
        const commit=()=>{try{const next=applyCommand(current,command,actor,actionId,Date.now(),allowModerator);result=next;if(!next.replayed){if(asset)assets.put(asset.blob,asset.id);store.put(next.state,"current");}}catch(error){abort(error);}};
        const refs:{id:string;avatar?:boolean;mime?:string;size?:number}[]=[];
        const referenced=command.type==="example.add"&&command.example.kind==="file"?command.example.assetId:command.type==="profile"?command.patch.avatarAssetId:command.type==="registration"?command.avatarId:undefined;
        if(referenced)refs.push({id:referenced,avatar:command.type!=="example.add",mime:command.type==="example.add"?command.example.mime:undefined,size:command.type==="example.add"?command.example.size:undefined});
        if(command.type==="profile.submit"||command.type==="service.submit"||(command.type==="profile.decide"&&command.decision==="approved")||(command.type==="service.decide"&&command.decision==="approved")){
          for(const e of current.account?.examples??[])if(e.kind==="file"&&e.assetId)refs.push({id:e.assetId,mime:e.mime,size:e.size});
          if(current.account?.avatarAssetId)refs.push({id:current.account.avatarAssetId,avatar:true});
        }
        let index=0;
        const next=()=>{
          const ref=refs[index++];if(!ref){commit();return;}
          const check=(blob:unknown)=>{if(!(blob instanceof Blob))throw new DemoError("Локальный файл не найден. Выберите его повторно.","storage");validateAsset(blob);if(ref.avatar&&(!blob.type.startsWith("image/")||blob.size>5*1024*1024))throw new DemoError("Аватар должен быть PNG/JPEG/WebP до 5 МиБ.");if((ref.mime!==undefined&&blob.type!==ref.mime)||(ref.size!==undefined&&blob.size!==ref.size))throw new DemoError("Данные локального файла не совпадают с примером.","storage");};
          if(asset?.id===ref.id){try{check(asset.blob);next();}catch(error){abort(error);}}
          else{const r=assets.get(ref.id);r.onsuccess=()=>{try{check(r.result);next();}catch(error){abort(error);}};}
        };next();
      }catch(error){abort(error);}
    };
    tx.oncomplete=()=>{if(result)resolve(result);else reject(new DemoError("Не удалось подтвердить сохранение Demo-данных.","storage"));};
    tx.onerror=()=>{failure??=tx.error;};tx.onabort=()=>reject(failure??tx.error??new DemoError("Не удалось сохранить Demo-данные.","storage"));
  });
}
export function validateAsset(blob:Blob){if(!["image/png","image/jpeg","image/webp","application/pdf"].includes(blob.type)||blob.size<=0||blob.size>10*1024*1024)throw new DemoError("Поддерживаются PNG, JPEG, WebP и PDF до 10 МиБ.");}
export async function readAsset(id:string):Promise<Blob|undefined>{const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction("assets","readonly"),r=tx.objectStore("assets").get(id);r.onsuccess=()=>resolve(r.result instanceof Blob?r.result:undefined);r.onerror=()=>reject(r.error);});}
