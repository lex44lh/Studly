import { demoMode } from "@/lib/data-mode";
import AccountWorkspace from "@/features/demo-workspace/AccountWorkspace";
import LiveAccountWorkspace from "@/features/live-account/LiveAccountWorkspace";

export default function ProfilePage() {
  if (demoMode) return <AccountWorkspace />;
  return <LiveAccountWorkspace />;
}
