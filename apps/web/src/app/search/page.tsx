import type { Viewport } from "next";
import LiveSearch from "@/components/catalog/LiveSearch";

// This route owns its safe-area layout; leave legacy pages' viewport unchanged.
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function SearchPage() { return <LiveSearch />; }
