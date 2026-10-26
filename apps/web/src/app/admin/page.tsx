import Link from "next/link";
import { demoMode } from "@/lib/data-mode";
import AdminWorkspace from "@/features/demo-workspace/AdminWorkspace";
export default function AdminPage(){
  const available=demoMode&&(process.env.NODE_ENV==="development"||process.env.NEXT_PUBLIC_STUDLY_DEMO_ADMIN==="enabled");
  if(!available)return <div className="campus-page"><section className="page-panel dw-state"><p className="page-eyebrow">Административный доступ</p><h1 className="page-heading">Раздел закрыт</h1><p>{demoMode?"Административный sandbox не включён в этой сборке Demo.":"Рабочее место сотрудников открывается отдельно после подтверждения серверных полномочий."}</p>{!demoMode && <Link className="page-button" href="/staff">Рабочее место сотрудника</Link>}<Link className="page-button" href="/">На главную</Link></section></div>;
  return <AdminWorkspace/>;
}
