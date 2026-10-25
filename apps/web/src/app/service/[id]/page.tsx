"use client";
import { use } from "react";
import { demoMode } from "@/lib/api/catalog";
import LiveService from "@/components/catalog/LiveService";
import ServiceWorkspace from "@/features/demo-workspace/ServiceWorkspace";
type Props={params:Promise<{id:string}>};
export default function ServicePage({params}:Props){const {id}=use(params);return demoMode?<ServiceWorkspace key={id} id={id}/>:<LiveService key={id} id={id}/>;}
