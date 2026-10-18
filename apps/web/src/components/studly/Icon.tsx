import type { ReactNode } from "react";

const paths: Record<string, ReactNode> = {
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
  heart: <path d="M20.8 4.8a5.5 5.5 0 0 0-7.8 0L12 5.9l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z" />,
  home: <path d="m3 10 9-7 9 7v10H15v-6H9v6H3Z" />,
  chat: <><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2v-10a9 9 0 0 1 19-.5Z" /><path d="M7 10h10M7 14h6" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 22v-3a8 8 0 0 1 16 0v3" /></>,
  filter: <><path d="M4 6h16M4 12h16M4 18h16" /><path d="M8 3v6M16 9v6M10 15v6" /></>,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5" /></>,
  moon: <path d="M21 13a9 9 0 0 1-10-10 9 9 0 1 0 10 10Z" />,
  book: <><path d="M3 4h7l2 2 2-2h7v16h-7l-2 2-2-2H3Z" /><path d="M12 6v16" /></>,
  pen: <><path d="m4 17-1 4 4-1L20 7l-4-4Z" /><path d="m13 6 4 4" /></>,
  code: <path d="m8 6-6 6 6 6M16 6l6 6-6 6M14 3l-4 18" />,
  video: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m10 9 5 3-5 3Z" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  bell: <><path d="M5 17h14l-2-4V9a5 5 0 0 0-10 0v4Z" /><path d="M10 21h4" /></>,
};

export type IconName = "search" | "heart" | "home" | "chat" | "user" | "filter" | "close" | "arrow" | "clock" | "sun" | "moon" | "book" | "pen" | "code" | "video" | "grid" | "menu" | "bell";
export function Icon({ name, className = "", size }: { name: IconName; className?: string; size?: number }) {
  return <svg className={`icon ${className}`} viewBox="0 0 24 24" width={size ?? 20} height={size ?? 20} aria-hidden="true" focusable="false">{paths[name]}</svg>;
}
