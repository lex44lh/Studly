import type { Viewport } from "next";

// This route owns its safe-area layout; leave legacy pages' viewport unchanged.
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export { default } from "@/components/catalog/LiveSearch";
