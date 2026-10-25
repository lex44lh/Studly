"use client";
import { useEffect,useReducer,useRef,useState,type ReactNode,type Context } from "react";
import { useRouter } from "next/navigation";
import { createDraftState,draftReducer,type DraftAction } from "@/lib/registration/draft";
import { registrationClient } from "@/lib/api/registration";
import type { RegistrationStep } from "@/types/registration-api";
import { useDemoWorkspace,WorkspaceStatus } from "./Provider";
import type { RegistrationDraft } from "@/types/registration";
export type DemoRegistrationValue={draft:RegistrationDraft;dispatch:(action:DraftAction)=>void;client:typeof registrationClient;previewComplete:boolean;returnToForm:()=>void;ready:boolean;loading:boolean;busy:boolean;error:string;retry:()=>void;saveStep:(step:RegistrationStep,skip?:boolean)=>Promise<void>};
type Props={children:ReactNode;context:Context<DemoRegistrationValue|null>};
const signature=(draft:RegistrationDraft)=>JSON.stringify({...draft,profile:{...draft.profile,avatarFile:null,avatarUrl:draft.profile.avatarUrl.startsWith("blob:")?"":draft.profile.avatarUrl}});
export function DemoRegistrationBridge({children,context}:Props){const workspace=useDemoWorkspace();if(!workspace.state)return <div className="campus-page"><WorkspaceStatus/></div>;return <Session context={context}>{children}</Session>;}
function Session({children,context}:Props){
  const w=useDemoWorkspace(),router=useRouter();const {saveRegistration,getAsset}=w;
  const initial=()=>({...createDraftState(),draft:structuredClone(w.state!.draft)});
  const [form,localDispatch]=useReducer(draftReducer,undefined,initial),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const [avatarId,setAvatarId]=useState(w.state!.registrationAvatarId),[avatarAttempt,setAvatarAttempt]=useState(0),[avatarLoading,setAvatarLoading]=useState(!!w.state!.registrationAvatarId),[avatarError,setAvatarError]=useState("");
  const [avatarIntent,setAvatarIntent]=useState<"preserve"|"remove">("preserve");
  const latest=useRef(form.draft),dirty=useRef(false),baseRevision=useRef(w.state!.revision),writes=useRef<Promise<unknown>>(Promise.resolve()),pending=useRef(0),failed=useRef(false);
  const writeGeneration=useRef(0);
  const avatarPending=useRef(!!w.state!.registrationAvatarId),avatarFailed=useRef(false),avatarGeneration=useRef(0);
  useEffect(()=>{latest.current=form.draft;},[form.draft]);
  useEffect(()=>{
    if(!avatarId)return;let live=true,preview="";const generation=avatarGeneration.current;
    getAsset(avatarId).then(blob=>{if(!live||generation!==avatarGeneration.current)return;if(!blob)throw Error("Missing avatar");preview=URL.createObjectURL(blob);localDispatch({type:"profile",patch:{avatarFile:null,avatarUrl:preview}});avatarPending.current=false;avatarFailed.current=false;setAvatarLoading(false);setAvatarError("");})
      .catch(()=>{if(live&&generation===avatarGeneration.current){avatarPending.current=false;avatarFailed.current=true;setAvatarError("Сохранённый аватар недоступен. Повторите загрузку, выберите файл повторно или удалите аватар явно.");setAvatarLoading(false);}});
    return()=>{live=false;if(preview)URL.revokeObjectURL(preview);};
  },[avatarId,avatarAttempt,getAsset]);
  const avatarUrl=form.draft.profile.avatarUrl;
  useEffect(()=>()=>{if(avatarUrl.startsWith("blob:"))URL.revokeObjectURL(avatarUrl);},[avatarUrl]);
  // Adopt only a clean external draft; dirty input retains its reviewed revision.
  useEffect(()=>{let live=true;queueMicrotask(()=>{if(!live||!w.state||dirty.current||pending.current)return;baseRevision.current=w.state.revision;const changedAvatar=avatarId!==w.state.registrationAvatarId;if(changedAvatar){avatarGeneration.current++;avatarPending.current=!!w.state.registrationAvatarId;avatarFailed.current=false;setAvatarLoading(avatarPending.current);setAvatarError("");setAvatarId(w.state.registrationAvatarId);setAvatarIntent("preserve");}if(changedAvatar||signature(form.draft)!==signature(w.state.draft)){const incoming=structuredClone(w.state.draft);if(!changedAvatar&&avatarId&&!avatarPending.current&&!avatarFailed.current&&form.draft.profile.avatarUrl.startsWith("blob:"))incoming.profile.avatarUrl=form.draft.profile.avatarUrl;localDispatch({type:"restore",draft:incoming});}});return()=>{live=false;};},[w.state,form.draft,avatarId]);
  const dispatch=(action:DraftAction)=>{
    if(action.type==="profile"&&Object.hasOwn(action.patch,"avatarUrl")){
      // Only user dispatch enters here. Restoring a missing/pending preview uses localDispatch.
      const remove=action.patch.avatarUrl===""&&!action.patch.avatarFile;
      setAvatarIntent(remove?"remove":"preserve");avatarGeneration.current++;avatarPending.current=false;avatarFailed.current=false;setAvatarLoading(false);setAvatarError("");setAvatarId(null);
    }
    dirty.current=true;localDispatch(action);
  };
  useEffect(()=>{if(!dirty.current||avatarLoading||avatarError||avatarPending.current||avatarFailed.current)return;const draft=form.draft,intent=avatarIntent,generation=writeGeneration.current;pending.current++;
    const job=writes.current.catch(()=>{}).then(()=>{if(generation!==writeGeneration.current)return baseRevision.current;if(failed.current)throw Error("Черновик изменился или не сохранён. Загрузите актуальные данные.");return saveRegistration(draft,undefined,baseRevision.current,intent);}).then(revision=>{if(generation!==writeGeneration.current)return;baseRevision.current=revision;if(latest.current===draft){dirty.current=false;setError("");if(draft.profile.avatarFile)localDispatch({type:"profile",patch:{avatarFile:null}});}}).catch(e=>{if(generation!==writeGeneration.current)return;failed.current=true;setError(e instanceof Error?e.message:"Черновик не сохранён.");throw e;}).finally(()=>{pending.current--;});
    writes.current=job;void job.catch(()=>{});
  },[form.draft,avatarLoading,avatarError,avatarIntent,saveRegistration]);
  const retry=()=>{if(!w.state){w.retry();return;}writeGeneration.current++;writes.current=writes.current.catch(()=>{});dirty.current=false;failed.current=false;baseRevision.current=w.state.revision;avatarGeneration.current++;avatarPending.current=!!w.state.registrationAvatarId;avatarFailed.current=false;setAvatarLoading(avatarPending.current);setAvatarError("");setAvatarIntent("preserve");localDispatch({type:"restore",draft:structuredClone(w.state.draft)});setAvatarId(w.state.registrationAvatarId);setAvatarAttempt(n=>n+1);setError("");w.retry();};
  const retryAvatar=()=>{avatarGeneration.current++;avatarPending.current=!!avatarId;avatarFailed.current=false;setAvatarLoading(avatarPending.current);setAvatarError("");setAvatarAttempt(n=>n+1);};
  const saveStep=async(step:RegistrationStep,skip=false)=>{if(busy||avatarLoading||avatarPending.current||avatarFailed.current)return;setBusy(true);setError("");const generation=writeGeneration.current;try{await writes.current;if(generation!==writeGeneration.current||avatarPending.current||avatarFailed.current)return;if(failed.current)throw Error("Сначала загрузите актуальный черновик.");const draft=latest.current;const target=step==="roles"?"profile":step==="profile"&&draft.roles.includes("performer")?"performer":step;
    const revision=await saveRegistration(draft,target,baseRevision.current,avatarIntent);baseRevision.current=revision;dirty.current=false;
    if(step==="roles"){router.push("/register/profile");return;}if(step==="profile"&&draft.roles.includes("performer")){router.push("/register/performer");return;}
    void skip;await w.run({type:"register"});router.replace("/profile");
  }catch(e){failed.current=true;setError(e instanceof Error?e.message:"Не удалось сохранить регистрацию.");}finally{setBusy(false);}};
  const Provided=context.Provider;
  return <><Provided value={{draft:form.draft,dispatch,client:registrationClient,previewComplete:false,returnToForm:()=>{},ready:true,loading:avatarLoading,busy,error:error||avatarError||w.error,retry,saveStep}}>{children}</Provided>{(error||avatarError)&&<p className="dw-note" role="alert">{error||avatarError} {avatarError&&<><button className="page-button-secondary" type="button" onClick={retryAvatar}>Повторить загрузку аватара</button> <button className="page-button-secondary" type="button" onClick={()=>dispatch({type:"profile",patch:{avatarFile:null,avatarUrl:""}})}>Удалить недоступный аватар</button></>} <button className="page-button-secondary" type="button" onClick={retry}>Загрузить актуальный черновик</button> Несохранённые изменения этой формы будут заменены только при загрузке актуального черновика.</p>}</>;
}
