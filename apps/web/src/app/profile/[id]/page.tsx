import { demoMode } from "@/lib/api/catalog";
import LivePerformer from "@/components/catalog/LivePerformer";
import PublicPerformer from "@/features/demo-workspace/PublicPerformer";
type Props={params:Promise<{id:string}>};
export default async function PerformerPage({params}:Props){const {id}=await params;return demoMode?<PublicPerformer key={id} id={id}/>:<LivePerformer key={id} id={id}/>;}
