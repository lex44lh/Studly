"use client";
import Link from "next/link";
import { Icon } from "@/components/studly/Icon";
import { useOptionalDemoWorkspace } from "./Provider";
export default function WelcomeAction({className}:{className:string}){const w=useOptionalDemoWorkspace();const account=w?.state?.account;const continued=!!w?.state?.draft.roles.length;const href=account?"/profile":continued?`/register/${w!.state!.registrationStep}`:"/register/roles";return <Link href={href} className={className}>{account?"В мой кабинет":continued?"Продолжить регистрацию":"Начать"}<Icon name="arrow"/></Link>;}
