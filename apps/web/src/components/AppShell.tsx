"use client";

import { usePathname } from "next/navigation";
import { FavoritesProvider } from "@/context/FavoritesContext";
import { demoMode } from "@/lib/api/catalog";
import { DemoWorkspaceProvider, useOptionalDemoWorkspace } from "@/features/demo-workspace/Provider";
import { CampusShell } from "./studly/CampusShell";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const content = <FavoritesProvider><AppShellContent>{children}</AppShellContent></FavoritesProvider>;
  return demoMode ? <DemoWorkspaceProvider>{content}</DemoWorkspaceProvider> : content;
}

function AppShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const workspace = useOptionalDemoWorkspace();
  const onboarding = pathname === "/welcome" || pathname === "/register" || pathname.startsWith("/register/");
  if (pathname === "/search") return <CampusShell>{children}</CampusShell>;
  if (/^\/service\/[^/]+\/?$/.test(pathname)) return <CampusShell contentId="service-title" skipLabel="Перейти к услуге" isSearchPage={false}>{children}</CampusShell>;
  return <CampusShell contentId="campus-content" skipLabel="Перейти к содержимому" isSearchPage={false} variant={onboarding ? "onboarding" : "standard"}>
    {workspace?.error && <div className="dw-global-error" role="alert"><p>{workspace.error}</p><button className="page-button" onClick={workspace.retry}>Повторить загрузку</button></div>}
    {demoMode && !onboarding && <p className="page-mode-note" role="note">Демонстрационный режим · Данные не являются реальными</p>}
    {children}
  </CampusShell>;
}
