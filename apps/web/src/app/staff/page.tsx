import Link from "next/link";
import { demoMode } from "@/lib/data-mode";
import LiveStaffWorkspace from "@/features/live-staff/LiveStaffWorkspace";

export default function StaffPage() {
  if (demoMode) return <div className="campus-page"><section className="page-panel"><h1 className="page-heading">Рабочее место сотрудника</h1><p>Этот раздел доступен после серверного входа в режиме Live.</p><Link href="/admin">Перейти в Demo sandbox</Link></section></div>;
  return <LiveStaffWorkspace />;
}
