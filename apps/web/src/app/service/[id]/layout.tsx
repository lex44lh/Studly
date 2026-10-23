import type { ReactNode } from "react";
import type { Viewport } from "next";

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function ServiceLayout({ children }: { children: ReactNode }) {
  return children;
}
